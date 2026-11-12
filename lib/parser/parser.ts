import * as path from 'node:path';
import * as fs from 'node:fs';
import { Project, SyntaxKind, Node } from 'ts-morph';
import type {
  ParserOptions,
  ParserResult,
  ParserFileNode,
  ParserEdge,
  ImportRecord,
  EdgeType,
} from './types.ts';
import { fallbackAdapter } from './adapter.ts';
import { walkRepository } from './walker.ts';
import { ModuleResolver } from './resolver.ts';
import { calculateFanInOut, deduplicateEdges } from './graph.ts';

function normalizePath(p: string): string {
  const posix = p.split(path.sep).join('/');
  const normalized = path.posix.normalize(posix);
  return normalized === '.' ? '.' : normalized.replace(/^\.\//, '');
}

/**
 * Main parser entry point: parses a repository directory on disk and returns
 * structural file nodes, real edges, and a comprehensive coverage report.
 */
export function parseRepository(
  repoPath: string,
  options?: ParserOptions,
): ParserResult {
  const resolvedRoot = path.resolve(repoPath);
  const adapter = options?.adapter ?? fallbackAdapter;

  // 1. Walk repository to collect source candidates and skipped files
  const walkResult = walkRepository(resolvedRoot, options?.customIgnores);
  const codeFilePaths = walkResult.sourceCandidates.map(c => c.relPath);
  const allRepoFilePaths = [
    ...codeFilePaths,
    ...walkResult.skippedFiles.map(s => s.path),
  ];

  // 2. Initialize AST project and module resolver
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });
  const resolver = new ModuleResolver(resolvedRoot, codeFilePaths, allRepoFilePaths);

  const rawEdges: ParserEdge[] = [];
  const unresolvedImports: ImportRecord[] = [];

  let totalImportsFound = 0;
  let importsResolved = 0;
  let importsExternal = 0;
  let importsExcluded = 0;
  let importsUnresolved = 0;

  let reExportsFound = 0;
  let reExportsResolved = 0;
  let reExportsExternal = 0;
  let reExportsExcluded = 0;
  let reExportsUnresolved = 0;

  const fileNodes: ParserFileNode[] = [];

  // 3. Parse each source file with ts-morph
  for (const candidate of walkResult.sourceCandidates) {
    let sourceFile;
    try {
      sourceFile = project.createSourceFile(
        candidate.absPath,
        candidate.content,
        { overwrite: true },
      );
    } catch (err) {
      walkResult.skippedFiles.push({
        path: candidate.relPath,
        folder: candidate.folder,
        extension: candidate.extension,
        reason: `AST parse failure: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    interface ExtractedImport {
      specifier: string;
      type: EdgeType;
      line: number;
    }

    const extracted: ExtractedImport[] = [];

    // A. Plain imports
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const specifier = importDecl.getModuleSpecifierValue();
      if (specifier !== undefined) {
        extracted.push({
          specifier,
          type: 'import',
          line: importDecl.getStartLineNumber(),
        });
      }
    }

    // B. Re-exports
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      if (exportDecl.hasModuleSpecifier()) {
        const specifier = exportDecl.getModuleSpecifierValue();
        if (specifier !== undefined) {
          extracted.push({
            specifier,
            type: 're-export',
            line: exportDecl.getStartLineNumber(),
          });
        }
      }
    }

    // C. Dynamic imports with literal strings
    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (callExpr.getExpression().getKind() === SyntaxKind.ImportKeyword) {
        const args = callExpr.getArguments();
        const line = callExpr.getStartLineNumber();

        if (args.length > 0) {
          const firstArg = args[0];
          if (
            firstArg.getKind() === SyntaxKind.StringLiteral ||
            firstArg.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral
          ) {
            extracted.push({
              specifier: (firstArg as unknown as { getLiteralText: () => string }).getLiteralText(),
              type: 'dynamic-import',
              line,
            });
          } else {
            // Non-literal dynamic import
            totalImportsFound += 1;
            importsUnresolved += 1;
            unresolvedImports.push({
              sourceFile: candidate.relPath,
              specifier: firstArg.getText(),
              type: 'dynamic-import',
              status: 'unresolved',
              reason: `Dynamic import uses non-literal expression: ${firstArg.getText()}`,
              line,
            });
          }
        }
      }
    }

    // Work out what a module is
    const hasExports =
      sourceFile.getExportDeclarations().length > 0 ||
      sourceFile.getExportAssignments().length > 0 ||
      sourceFile.getStatements().some(s => Node.isExportable(s) && s.isExported());
    const isModule = extracted.length > 0 || hasExports;

    // Framework classification via adapter
    const classification = adapter.classifyFile({
      path: candidate.relPath,
      isModule,
      lines: candidate.lines,
      content: candidate.content,
    });

    // Resolve all extracted imports and re-exports
    for (const item of extracted) {
      totalImportsFound += 1;
      const isReExport = item.type === 're-export';
      if (isReExport) {
        reExportsFound += 1;
      }

      const res = resolver.resolve(candidate.relPath, item.specifier);

      if (res.status === 'resolved' && res.targetFile) {
        importsResolved += 1;
        if (isReExport) reExportsResolved += 1;

        rawEdges.push({
          source: candidate.relPath,
          target: res.targetFile,
          type: item.type,
          specifier: item.specifier,
        });
      } else if (res.status === 'external') {
        importsExternal += 1;
        if (isReExport) reExportsExternal += 1;
      } else if (res.status === 'excluded') {
        importsExcluded += 1;
        if (isReExport) reExportsExcluded += 1;
      } else {
        importsUnresolved += 1;
        if (isReExport) reExportsUnresolved += 1;

        unresolvedImports.push({
          sourceFile: candidate.relPath,
          specifier: item.specifier,
          type: item.type,
          status: 'unresolved',
          reason: res.reason ?? `Cannot resolve '${item.specifier}'`,
          line: item.line,
        });
      }
    }

    fileNodes.push({
      path: candidate.relPath,
      name: candidate.name,
      folder: candidate.folder,
      extension: candidate.extension,
      lines: candidate.lines,
      bytes: candidate.bytes,
      hash: candidate.hash,
      isModule,
      role: String(classification.role ?? 'module'),
      kind: String(classification.kind ?? 'file'),
      fanIn: 0,
      fanOut: 0,
    });
  }

  // 4. Deduplicate edges and compute fan-in / fan-out
  const edges = deduplicateEdges(rawEdges);
  const fanInOutMap = calculateFanInOut(
    fileNodes.map(f => f.path),
    edges,
  );

  for (const node of fileNodes) {
    const stats = fanInOutMap.get(node.path);
    if (stats) {
      node.fanIn = stats.fanIn;
      node.fanOut = stats.fanOut;
    }
  }

  // 5. Aggregate skip reasons summary
  const skipReasonsSummary: Record<string, number> = {};
  for (const skipped of walkResult.skippedFiles) {
    skipReasonsSummary[skipped.reason] = (skipReasonsSummary[skipped.reason] ?? 0) + 1;
  }

  const distinctFoldersCount = new Set(fileNodes.map(f => f.folder)).size;

  const result: ParserResult = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    rootDir: normalizePath(path.relative(process.cwd(), resolvedRoot)) || '.',
    files: fileNodes,
    edges,
    skippedFiles: walkResult.skippedFiles,
    coverage: {
      totalFilesFound: fileNodes.length + walkResult.skippedFiles.length,
      filesParsed: fileNodes.length,
      filesSkipped: walkResult.skippedFiles.length,
      skipReasonsSummary,
      distinctFoldersCount,
      totalImportsFound,
      importsResolved,
      importsExternal,
      importsExcluded,
      importsUnresolved,
      reExportsFound,
      reExportsResolved,
      reExportsExternal,
      reExportsExcluded,
      reExportsUnresolved,
      unresolvedImports,
    },
  };

  if (options?.outputFilePath) {
    const outPath = path.resolve(options.outputFilePath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  }

  return result;
}

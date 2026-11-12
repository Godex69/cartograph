import * as path from 'node:path';
import * as fs from 'node:fs';
import ts from 'typescript';
import type { ImportResolutionStatus } from './types.ts';

export interface ResolutionResult {
  status: ImportResolutionStatus;
  targetFile?: string;
  reason?: string;
}

const ASSET_EXTENSION_REGEX = /\.(css|scss|sass|less|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$/i;

const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'fs/promises', 'http', 'http2', 'https', 'inspector',
  'module', 'net', 'os', 'path', 'path/posix', 'path/win32', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl', 'stream',
  'stream/consumers', 'stream/promises', 'stream/web', 'string_decoder',
  'test', 'timers', 'timers/promises', 'tls', 'trace_events', 'tty',
  'url', 'util', 'util/types', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
]);

const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

function normalizePath(p: string): string {
  const posix = p.split(path.sep).join('/');
  const normalized = path.posix.normalize(posix);
  return normalized === '.' ? '.' : normalized.replace(/^\.\//, '');
}

export class ModuleResolver {
  private readonly rootDir: string;
  private readonly knownCodeFiles: Set<string>;
  private readonly allRepoFiles: Set<string>;
  private readonly compilerOptions: ts.CompilerOptions;
  private readonly pathAliases: Array<{ prefix: string; suffix: string; targets: string[] }> = [];

  constructor(rootDir: string, codeFilePaths: string[], allRepoFilePaths?: string[]) {
    this.rootDir = path.resolve(rootDir);
    this.knownCodeFiles = new Set(codeFilePaths.map(p => normalizePath(p)));
    this.allRepoFiles = new Set((allRepoFilePaths ?? codeFilePaths).map(p => normalizePath(p)));

    // Load tsconfig.json or jsconfig.json if available
    this.compilerOptions = this.loadCompilerOptions();
    this.initPathAliases();
  }

  private loadCompilerOptions(): ts.CompilerOptions {
    const tsconfigPath = path.join(this.rootDir, 'tsconfig.json');
    const jsconfigPath = path.join(this.rootDir, 'jsconfig.json');
    const configFile = fs.existsSync(tsconfigPath)
      ? tsconfigPath
      : fs.existsSync(jsconfigPath)
      ? jsconfigPath
      : undefined;

    if (!configFile) {
      return {
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
      };
    }

    try {
      const readResult = ts.readConfigFile(configFile, ts.sys.readFile);
      if (readResult.error) {
        return { moduleResolution: ts.ModuleResolutionKind.Bundler };
      }
      const parsed = ts.parseJsonConfigFileContent(
        readResult.config,
        ts.sys,
        this.rootDir,
      );
      return parsed.options;
    } catch {
      return { moduleResolution: ts.ModuleResolutionKind.Bundler };
    }
  }

  private initPathAliases(): void {
    const paths = this.compilerOptions.paths;
    if (!paths) return;

    for (const [pattern, targets] of Object.entries(paths)) {
      const starIndex = pattern.indexOf('*');
      if (starIndex !== -1) {
        const prefix = pattern.slice(0, starIndex);
        const suffix = pattern.slice(starIndex + 1);
        this.pathAliases.push({ prefix, suffix, targets });
      } else {
        this.pathAliases.push({ prefix: pattern, suffix: '', targets });
      }
    }
  }

  private checkCandidates(baseRelPath: string): { matched?: string; isDeclaration?: boolean; isAsset?: boolean } {
    const normalizedBase = normalizePath(baseRelPath);

    // 1. Exact match (e.g. if import had extension)
    if (this.knownCodeFiles.has(normalizedBase)) {
      return { matched: normalizedBase };
    }

    // 2. Check code extensions
    for (const ext of CODE_EXTENSIONS) {
      const candidate = normalizedBase + ext;
      if (this.knownCodeFiles.has(candidate)) {
        return { matched: candidate };
      }
    }

    // 3. Check directory index files
    for (const ext of CODE_EXTENSIONS) {
      const candidate = `${normalizedBase}/index${ext}`;
      if (this.knownCodeFiles.has(candidate)) {
        return { matched: candidate };
      }
    }

    // 4. Check if exists on disk inside repo as declaration (.d.ts) or non-code
    const absPath = path.join(this.rootDir, normalizedBase);
    if (fs.existsSync(absPath + '.d.ts') || fs.existsSync(path.join(absPath, 'index.d.ts'))) {
      return { isDeclaration: true };
    }

    if (this.allRepoFiles.has(normalizedBase) || fs.existsSync(absPath)) {
      return { isAsset: true };
    }

    return {};
  }

  resolve(sourceFileRelPath: string, specifier: string): ResolutionResult {
    // 1. Asset or stylesheet exclusion
    if (ASSET_EXTENSION_REGEX.test(specifier)) {
      return {
        status: 'excluded',
        reason: `Deliberately excluded non-code asset / stylesheet (${path.extname(specifier)})`,
      };
    }

    // 2. Node.js built-in modules
    if (specifier.startsWith('node:') || NODE_BUILTINS.has(specifier)) {
      return {
        status: 'external',
        reason: 'Node.js built-in module',
      };
    }

    const sourceFolder = path.dirname(sourceFileRelPath);

    // 3. Relative import (./... or ../...)
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const targetRelBase = normalizePath(path.join(sourceFolder, specifier));
      const res = this.checkCandidates(targetRelBase);

      if (res.matched) {
        return {
          status: 'resolved',
          targetFile: res.matched,
        };
      }
      if (res.isDeclaration) {
        return {
          status: 'excluded',
          reason: 'Resolved to TypeScript ambient declaration file (.d.ts)',
        };
      }
      if (res.isAsset) {
        return {
          status: 'excluded',
          reason: 'Resolved to non-code repository file',
        };
      }

      return {
        status: 'unresolved',
        reason: `File does not exist: '${specifier}' (looked for .ts, .tsx, .js, .jsx, index.* in '${normalizePath(sourceFolder)}')`,
      };
    }

    // 4. Path alias matching (e.g. @/*)
    for (const alias of this.pathAliases) {
      if (alias.suffix === '' && specifier === alias.prefix) {
        for (const targetPattern of alias.targets) {
          const targetRel = normalizePath(targetPattern);
          const res = this.checkCandidates(targetRel);
          if (res.matched) {
            return { status: 'resolved', targetFile: res.matched };
          }
        }
      } else if (specifier.startsWith(alias.prefix) && specifier.endsWith(alias.suffix)) {
        const wildcard = specifier.slice(
          alias.prefix.length,
          specifier.length - alias.suffix.length,
        );

        for (const targetPattern of alias.targets) {
          const mappedTarget = normalizePath(targetPattern.replace('*', wildcard));
          const res = this.checkCandidates(mappedTarget);
          if (res.matched) {
            return { status: 'resolved', targetFile: res.matched };
          }
          if (res.isDeclaration) {
            return {
              status: 'excluded',
              reason: 'Resolved to TypeScript ambient declaration file (.d.ts)',
            };
          }
          if (res.isAsset) {
            return {
              status: 'excluded',
              reason: 'Resolved to non-code repository file',
            };
          }
        }

        return {
          status: 'unresolved',
          reason: `Path alias '${alias.prefix}*' matched '${specifier}', but target file was not found inside repository`,
        };
      }
    }

    // 5. Official TypeScript module resolution fallback
    const sourceAbs = path.join(this.rootDir, sourceFileRelPath);
    try {
      const tsResolved = ts.resolveModuleName(
        specifier,
        sourceAbs,
        this.compilerOptions,
        ts.sys,
      );

      if (tsResolved.resolvedModule) {
        const resolvedFile = tsResolved.resolvedModule.resolvedFileName;

        if (tsResolved.resolvedModule.isExternalLibraryImport) {
          return {
            status: 'external',
            reason: 'External dependency in node_modules',
          };
        }

        const resolvedRel = normalizePath(path.relative(this.rootDir, resolvedFile));
        if (!resolvedRel.startsWith('..') && !path.isAbsolute(resolvedRel)) {
          if (resolvedRel.endsWith('.d.ts')) {
            return {
              status: 'excluded',
              reason: 'Resolved to TypeScript ambient declaration file (.d.ts)',
            };
          }
          if (this.knownCodeFiles.has(resolvedRel)) {
            return {
              status: 'resolved',
              targetFile: resolvedRel,
            };
          }
        }
      }
    } catch {
      // Fall through to external check
    }

    // 6. External package check (e.g. 'react', '@clerk/nextjs', 'lodash')
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
      return {
        status: 'external',
        reason: 'External package dependency',
      };
    }

    // 7. Unresolved
    return {
      status: 'unresolved',
      reason: `Cannot resolve module specifier '${specifier}'`,
    };
  }
}

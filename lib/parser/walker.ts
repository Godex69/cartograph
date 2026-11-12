import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { SkippedFile } from './types.ts';

export interface SourceCandidate {
  relPath: string;
  absPath: string;
  folder: string;
  name: string;
  extension: string;
  lines: number;
  bytes: number;
  hash: string;
  content: string;
}

export interface WalkResult {
  totalFilesFound: number;
  sourceCandidates: SourceCandidate[];
  skippedFiles: SkippedFile[];
}

const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  '.turbo',
  '.vercel',
  '.cache',
  'coverage',
]);

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

function normalizePath(p: string): string {
  const posix = p.split(path.sep).join('/');
  const normalized = path.posix.normalize(posix);
  return normalized === '.' ? '.' : normalized.replace(/^\.\//, '');
}

function classifySkipReason(relPath: string, fileName: string, ext: string): string {
  if (relPath.endsWith('.d.ts')) {
    return 'Type declaration file (.d.ts)';
  }
  if (fileName.startsWith('.env')) {
    return 'Environment configuration / template';
  }
  if (fileName === '.gitignore' || fileName === '.gitattributes' || fileName === '.gitmodules') {
    return 'Git configuration file';
  }
  if (fileName === '.DS_Store') {
    return 'OS metadata file (.DS_Store)';
  }
  if (fileName.endsWith('.lock') || fileName === 'pnpm-lock.yaml' || fileName === 'package-lock.json' || fileName === 'yarn.lock') {
    return 'Package lockfile';
  }

  switch (ext) {
    case '.md':
      return 'Documentation / Markdown file (.md)';
    case '.json':
      return 'JSON configuration or data file (.json)';
    case '.yaml':
    case '.yml':
      return `YAML configuration file (${ext})`;
    case '.css':
    case '.scss':
    case '.sass':
    case '.less':
      return `Stylesheet file (${ext})`;
    case '.svg':
    case '.ico':
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.webp':
      return `Static image / asset (${ext})`;
    case '.sql':
      return 'SQL database script / migration (.sql)';
    case '.sh':
    case '.bash':
    case '.zsh':
      return `Shell script (${ext})`;
    case '.tsbuildinfo':
      return 'TypeScript build cache file (.tsbuildinfo)';
    case '.map':
      return 'Source map file (.map)';
    case '.txt':
      return 'Plain text file (.txt)';
    default:
      return ext ? `Non-code file (${ext})` : 'Non-code file (no extension)';
  }
}

/**
 * Walks a repository directory, identifying parseable code files and
 * recording skipped files with exact reasons.
 */
export function walkRepository(
  rootDir: string,
  customIgnores?: string[],
): WalkResult {
  const resolvedRoot = path.resolve(rootDir);
  const ignoredDirs = new Set(DEFAULT_IGNORED_DIRS);

  if (customIgnores) {
    for (const item of customIgnores) {
      ignoredDirs.add(item);
    }
  }

  const sourceCandidates: SourceCandidate[] = [];
  const skippedFiles: SkippedFile[] = [];

  function recurse(currentDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (err) {
      const rel = normalizePath(path.relative(resolvedRoot, currentDir));
      skippedFiles.push({
        path: rel,
        folder: normalizePath(path.dirname(rel)) || '.',
        extension: '',
        reason: `Directory unreadable: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    // Sort entries for deterministic walk order
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = normalizePath(path.relative(resolvedRoot, fullPath));

      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          continue; // Structural directory skip
        }
        recurse(fullPath);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        const folder = normalizePath(path.dirname(relPath)) || '.';
        const ext = path.extname(entry.name).toLowerCase();

        // Check if declaration file or non-code file
        if (relPath.endsWith('.d.ts') || !CODE_EXTENSIONS.has(ext)) {
          const reason = classifySkipReason(relPath, entry.name, ext);
          skippedFiles.push({
            path: relPath,
            folder,
            extension: ext,
            reason,
          });
          continue;
        }

        // Read source file content and compute structural properties
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split(/\r\n|\r|\n/).length;
          const bytes = Buffer.byteLength(content, 'utf8');
          const hash = crypto.createHash('sha256').update(content).digest('hex');

          sourceCandidates.push({
            relPath,
            absPath: fullPath,
            folder,
            name: entry.name,
            extension: ext,
            lines,
            bytes,
            hash,
            content,
          });
        } catch (err) {
          skippedFiles.push({
            path: relPath,
            folder,
            extension: ext,
            reason: `Unreadable file: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }
  }

  recurse(resolvedRoot);

  return {
    totalFilesFound: sourceCandidates.length + skippedFiles.length,
    sourceCandidates,
    skippedFiles,
  };
}

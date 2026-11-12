/**
 * Types and contract shapes for the Cartograph repository parser.
 * Everything built after Phase 3 reads this output contract.
 */

export type EdgeType = 'import' | 're-export' | 'dynamic-import';

export interface ParserFileNode {
  path: string;
  name: string;
  folder: string;
  extension: string;
  lines: number;
  bytes: number;
  hash: string;
  isModule: boolean;
  role: string;
  kind: string;
  fanIn: number;
  fanOut: number;
}

export interface ParserEdge {
  source: string;
  target: string;
  type: EdgeType;
  specifier: string;
}

export interface SkippedFile {
  path: string;
  folder: string;
  extension: string;
  reason: string;
}

export type ImportResolutionStatus = 'resolved' | 'external' | 'excluded' | 'unresolved';

export interface ImportRecord {
  sourceFile: string;
  specifier: string;
  type: EdgeType;
  status: ImportResolutionStatus;
  targetFile?: string;
  reason?: string;
  line?: number;
}

export interface ParserCoverageReport {
  totalFilesFound: number;
  filesParsed: number;
  filesSkipped: number;
  skipReasonsSummary: Record<string, number>;
  distinctFoldersCount: number;

  totalImportsFound: number;
  importsResolved: number;
  importsExternal: number;
  importsExcluded: number;
  importsUnresolved: number;

  reExportsFound: number;
  reExportsResolved: number;
  reExportsExternal: number;
  reExportsExcluded: number;
  reExportsUnresolved: number;

  unresolvedImports: ImportRecord[];
}

export interface ParserResult {
  version: '1.0.0';
  timestamp: string;
  rootDir: string;
  files: ParserFileNode[];
  edges: ParserEdge[];
  skippedFiles: SkippedFile[];
  coverage: ParserCoverageReport;
}

export interface FrameworkAdapter {
  name: string;
  classifyFile(file: {
    path: string;
    isModule: boolean;
    lines: number;
    content: string;
  }): {
    role: string;
    kind: string;
    [key: string]: unknown;
  };
}

export interface ParserOptions {
  adapter?: FrameworkAdapter;
  customIgnores?: string[];
  outputFilePath?: string;
}

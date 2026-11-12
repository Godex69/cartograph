import type { ParserResult, ParserFileNode, ParserEdge, SkippedFile } from './types.ts';

/**
 * Validates that an arbitrary JSON object conforms to the ParserResult contract.
 */
export function validateParserResult(data: unknown): data is ParserResult {
  if (!data || typeof data !== 'object') {
    throw new Error('ParserResult must be an object');
  }

  const obj = data as Partial<ParserResult>;

  if (obj.version !== '1.0.0') {
    throw new Error(`Invalid version: expected '1.0.0', got '${obj.version}'`);
  }

  if (typeof obj.timestamp !== 'string') {
    throw new Error('timestamp must be an ISO string');
  }

  if (typeof obj.rootDir !== 'string') {
    throw new Error('rootDir must be a string');
  }

  if (!Array.isArray(obj.files)) {
    throw new Error('files must be an array');
  }

  for (const [i, file] of obj.files.entries()) {
    const f = file as Partial<ParserFileNode>;
    if (typeof f.path !== 'string') throw new Error(`files[${i}].path must be a string`);
    if (typeof f.name !== 'string') throw new Error(`files[${i}].name must be a string`);
    if (typeof f.folder !== 'string') throw new Error(`files[${i}].folder must be a string`);
    if (typeof f.extension !== 'string') throw new Error(`files[${i}].extension must be a string`);
    if (typeof f.lines !== 'number') throw new Error(`files[${i}].lines must be a number`);
    if (typeof f.bytes !== 'number') throw new Error(`files[${i}].bytes must be a number`);
    if (typeof f.hash !== 'string') throw new Error(`files[${i}].hash must be a string`);
    if (typeof f.isModule !== 'boolean') throw new Error(`files[${i}].isModule must be a boolean`);
    if (typeof f.role !== 'string') throw new Error(`files[${i}].role must be a string`);
    if (typeof f.kind !== 'string') throw new Error(`files[${i}].kind must be a string`);
    if (typeof f.fanIn !== 'number') throw new Error(`files[${i}].fanIn must be a number`);
    if (typeof f.fanOut !== 'number') throw new Error(`files[${i}].fanOut must be a number`);
  }

  if (!Array.isArray(obj.edges)) {
    throw new Error('edges must be an array');
  }

  for (const [i, edge] of obj.edges.entries()) {
    const e = edge as Partial<ParserEdge>;
    if (typeof e.source !== 'string') throw new Error(`edges[${i}].source must be a string`);
    if (typeof e.target !== 'string') throw new Error(`edges[${i}].target must be a string`);
    if (e.type !== 'import' && e.type !== 're-export' && e.type !== 'dynamic-import') {
      throw new Error(`edges[${i}].type must be 'import' | 're-export' | 'dynamic-import'`);
    }
    if (typeof e.specifier !== 'string') throw new Error(`edges[${i}].specifier must be a string`);
  }

  if (!Array.isArray(obj.skippedFiles)) {
    throw new Error('skippedFiles must be an array');
  }

  for (const [i, skipped] of obj.skippedFiles.entries()) {
    const s = skipped as Partial<SkippedFile>;
    if (typeof s.path !== 'string') throw new Error(`skippedFiles[${i}].path must be a string`);
    if (typeof s.folder !== 'string') throw new Error(`skippedFiles[${i}].folder must be a string`);
    if (typeof s.reason !== 'string') throw new Error(`skippedFiles[${i}].reason must be a string`);
  }

  if (!obj.coverage || typeof obj.coverage !== 'object') {
    throw new Error('coverage must be an object');
  }

  const cov = obj.coverage;
  const numericFields = [
    'totalFilesFound',
    'filesParsed',
    'filesSkipped',
    'distinctFoldersCount',
    'totalImportsFound',
    'importsResolved',
    'importsExternal',
    'importsExcluded',
    'importsUnresolved',
    'reExportsFound',
    'reExportsResolved',
    'reExportsExternal',
    'reExportsExcluded',
    'reExportsUnresolved',
  ] as const;

  for (const field of numericFields) {
    if (typeof cov[field] !== 'number') {
      throw new Error(`coverage.${field} must be a number`);
    }
  }

  if (!Array.isArray(cov.unresolvedImports)) {
    throw new Error('coverage.unresolvedImports must be an array');
  }

  return true;
}

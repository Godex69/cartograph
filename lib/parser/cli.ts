import * as path from 'node:path';
import * as fs from 'node:fs';
import { parseRepository } from './parser.ts';
import { validateParserResult } from './validator.ts';

function printReport(result: ReturnType<typeof parseRepository>): void {
  const { coverage, edges, rootDir } = result;

  console.log('=== Cartograph Repository Parser ===');
  console.log(`Directory:        ${rootDir}`);
  console.log(`Contract Version: ${result.version}`);
  console.log(`Timestamp:        ${result.timestamp}`);
  console.log('');

  console.log('--- Files Summary ---');
  console.log(`  Total files found:  ${coverage.totalFilesFound}`);
  console.log(`  Files parsed:       ${coverage.filesParsed}`);
  console.log(`  Files skipped:      ${coverage.filesSkipped}`);
  console.log(`  Distinct folders:   ${coverage.distinctFoldersCount}`);
  console.log(`  Edges (deduped):    ${edges.length}`);
  console.log('');

  console.log('--- Skip Reasons Breakdown ---');
  const sortedReasons = Object.entries(coverage.skipReasonsSummary).sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of sortedReasons) {
    console.log(`  ${reason.padEnd(45)} : ${count}`);
  }
  console.log('');

  console.log('--- Imports Coverage ---');
  console.log(`  Total imports seen:   ${coverage.totalImportsFound}`);
  console.log(`  Resolved (in repo):   ${coverage.importsResolved}`);
  console.log(`  External packages:    ${coverage.importsExternal}`);
  console.log(`  Deliberately excluded:${coverage.importsExcluded}`);
  console.log(`  Unresolved failures:  ${coverage.importsUnresolved}`);
  console.log('');

  console.log('--- Re-exports Coverage ---');
  console.log(`  Re-exports found:     ${coverage.reExportsFound}`);
  console.log(`  Re-exports resolved:  ${coverage.reExportsResolved}`);
  console.log(`  Re-exports external:  ${coverage.reExportsExternal}`);
  console.log(`  Re-exports excluded:  ${coverage.reExportsExcluded}`);
  console.log(`  Re-exports unresolved:${coverage.reExportsUnresolved}`);
  console.log('');

  if (coverage.unresolvedImports.length > 0) {
    console.log(`--- Unresolved Imports (${coverage.unresolvedImports.length}) ---`);
    for (const item of coverage.unresolvedImports) {
      const loc = item.line ? `:${item.line}` : '';
      console.log(`  ! ${item.sourceFile}${loc}`);
      console.log(`    Specifier: "${item.specifier}" (${item.type})`);
      console.log(`    Reason:    ${item.reason}`);
    }
    console.log('');
  } else {
    console.log('--- Unresolved Imports: 0 (All resolved, external, or deliberately excluded) ---');
    console.log('');
  }
}

export function runCLI(): void {
  const args = process.argv.slice(2);
  let targetDir = '.';
  let outputFilePath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' || arg === '-o') {
      outputFilePath = args[++i];
    } else if (!arg.startsWith('-')) {
      targetDir = arg;
    }
  }

  const result = parseRepository(targetDir, { outputFilePath });
  printReport(result);

  if (outputFilePath) {
    const absOut = path.resolve(outputFilePath);
    console.log(`Contract data written to: ${absOut}`);
    // Read back and validate contract types
    const rawData = fs.readFileSync(absOut, 'utf8');
    const parsedData = JSON.parse(rawData);
    validateParserResult(parsedData);
    console.log('Verification: Output successfully read back and contract types hold.');
  }
}

// Run when executed directly
runCLI();

import * as path from 'node:path';
import * as fs from 'node:fs';
import { CanvasShell } from '@/components/canvas-shell';
import type { ParserResult } from '@/lib/parser/types';


export default function PreviewPage() {
  const filePath = path.join(process.cwd(), 'data', 'sample-analysis.json');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const data: ParserResult = JSON.parse(fileContent);

  return <CanvasShell data={data} repoName="honojs/hono" />;
}

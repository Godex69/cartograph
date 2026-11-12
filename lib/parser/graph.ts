import type { ParserEdge } from './types.ts';

/**
 * Pure function: removes duplicate connections between (source, target, type)
 * or between (source, target).
 */
export function deduplicateEdges(edges: ParserEdge[]): ParserEdge[] {
  const seen = new Set<string>();
  const unique: ParserEdge[] = [];

  for (const edge of edges) {
    const key = `${edge.source}-->${edge.target}::${edge.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(edge);
    }
  }

  return unique;
}

/**
 * Pure function: computes fan-in and fan-out for each file.
 * Computed from the edge list after duplicates between (source, target) pairs are removed.
 */
export function calculateFanInOut(
  filePaths: string[],
  edges: Array<{ source: string; target: string }>,
): Map<string, { fanIn: number; fanOut: number }> {
  const counts = new Map<string, { fanIn: number; fanOut: number }>();

  for (const file of filePaths) {
    counts.set(file, { fanIn: 0, fanOut: 0 });
  }

  // Deduplicate directed connections between source and target pairs
  const uniquePairs = new Set<string>();
  for (const edge of edges) {
    if (edge.source === edge.target) {
      continue; // Self-references do not increment inter-file fan-in/fan-out
    }
    const pairKey = `${edge.source}-->${edge.target}`;
    if (uniquePairs.has(pairKey)) {
      continue;
    }
    uniquePairs.add(pairKey);

    const sourceStats = counts.get(edge.source) ?? { fanIn: 0, fanOut: 0 };
    sourceStats.fanOut += 1;
    counts.set(edge.source, sourceStats);

    const targetStats = counts.get(edge.target) ?? { fanIn: 0, fanOut: 0 };
    targetStats.fanIn += 1;
    counts.set(edge.target, targetStats);
  }

  return counts;
}

import type { ParserResult, ParserFileNode, ParserEdge } from '../parser/types';

export interface FoldedNode {
  id: string;
  label: string;
  folder: string;
  files: ParserFileNode[];
  fanIn: number;
  fanOut: number;
  width: number;
  height: number;
}

export interface FoldedEdge {
  id: string;
  source: string;
  target: string;
  count: number;
  rawEdges: ParserEdge[];
}

export interface FoldingResult {
  nodes: FoldedNode[];
  edges: FoldedEdge[];
  fileToNodeMap: Map<string, string>;
  threshold: number;
  acceptance: {
    nodeCount: number;
    hasSingleFileNodes: boolean;
    allEdgesTerminateOnValidNodes: boolean;
    averageFilesPerNode: number;
  };
}

/**
 * Calculates the shortest unique suffix/segments for each directory path
 * so that labels are minimal while guaranteeing uniqueness on canvas.
 */
export function computeShortestUniqueLabels(paths: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const pathParts = new Map<string, string[]>();

  for (const p of paths) {
    if (p === '.' || !p) {
      pathParts.set(p, ['root']);
    } else {
      pathParts.set(p, p.split('/'));
    }
  }

  for (const p of paths) {
    const parts = pathParts.get(p)!;
    let numSegments = 1;
    let label = parts.slice(-numSegments).join('/');
    let isUnique = false;

    while (!isUnique && numSegments <= parts.length) {
      label = parts.slice(-numSegments).join('/');
      const collision = paths.some((other) => {
        if (other === p) return false;
        const otherParts = pathParts.get(other)!;
        const otherLabel = otherParts.slice(-numSegments).join('/');
        return otherLabel === label;
      });

      if (!collision) {
        isUnique = true;
      } else {
        numSegments++;
      }
    }

    result.set(p, label);
  }

  return result;
}

/**
 * Executes a single bottom-up folding pass at a fixed threshold T.
 * Any directory with fewer than T files merges into its parent.
 */
function runSingleFoldingPass(
  files: ParserFileNode[],
  threshold: number,
): {
  mergedTarget: Map<string, string>;
  activeFolders: Map<string, ParserFileNode[]>;
} {
  const dirFiles = new Map<string, ParserFileNode[]>();
  for (const f of files) {
    const dir = f.folder || '.';
    if (!dirFiles.has(dir)) dirFiles.set(dir, []);
    dirFiles.get(dir)!.push(f);
  }

  const allDirs = new Set<string>(dirFiles.keys());
  for (const dir of dirFiles.keys()) {
    let cur = dir;
    while (cur && cur !== '.') {
      const parent = cur.includes('/') ? cur.slice(0, cur.lastIndexOf('/')) : '.';
      allDirs.add(parent);
      if (!dirFiles.has(parent)) dirFiles.set(parent, []);
      cur = parent;
    }
  }

  // Deepest directory upward: depth descending
  const dirsByDepth = Array.from(allDirs).sort((a, b) => {
    const depthA = a === '.' ? 0 : a.split('/').length;
    const depthB = b === '.' ? 0 : b.split('/').length;
    return depthB - depthA;
  });

  const mergedInto = new Map<string, string>();
  for (const d of allDirs) {
    mergedInto.set(d, d);
  }

  function resolveTarget(d: string): string {
    let curr = d;
    while (mergedInto.get(curr) !== curr) {
      curr = mergedInto.get(curr)!;
    }
    return curr;
  }

  const dirCounts = new Map<string, number>();
  for (const [d, list] of dirFiles.entries()) {
    dirCounts.set(d, list.length);
  }

  for (const dir of dirsByDepth) {
    if (dir === '.') continue; // Root directory cannot merge
    const count = dirCounts.get(dir) || 0;
    if (count < threshold) {
      const parent = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '.';
      mergedInto.set(dir, parent);
      dirCounts.set(parent, (dirCounts.get(parent) || 0) + count);
      dirCounts.delete(dir);
    }
  }

  const activeFolders = new Map<string, ParserFileNode[]>();
  for (const f of files) {
    const origDir = f.folder || '.';
    const finalDir = resolveTarget(origDir);
    if (!activeFolders.has(finalDir)) {
      activeFolders.set(finalDir, []);
    }
    activeFolders.get(finalDir)!.push(f);
  }

  return { mergedTarget: mergedInto, activeFolders };
}

/**
 * Pure folding calculation over a repository's files and edges.
 * Automatically discovers the lowest threshold that brings node count under ~24.
 */
export function foldRepository(
  data: ParserResult,
  targetNodeMax = 24,
): FoldingResult {
  const { files, edges } = data;

  // Search for the lowest threshold >= 2 that lands under roughly two dozen nodes
  let bestThreshold = 2;
  let passResult = runSingleFoldingPass(files, bestThreshold);

  while (passResult.activeFolders.size > targetNodeMax && bestThreshold < 50) {
    bestThreshold++;
    passResult = runSingleFoldingPass(files, bestThreshold);
  }

  const { activeFolders } = passResult;
  const activePaths = Array.from(activeFolders.keys());
  const labelMap = computeShortestUniqueLabels(activePaths);

  // Map each file to its active folder node
  const fileToNodeMap = new Map<string, string>();
  for (const [folderId, folderFiles] of activeFolders.entries()) {
    for (const f of folderFiles) {
      fileToNodeMap.set(f.path, folderId);
    }
  }

  // Calculate fan-in and fan-out across folded nodes
  const nodeFanIn = new Map<string, number>();
  const nodeFanOut = new Map<string, number>();
  const nodeEdgeMap = new Map<string, ParserEdge[]>();

  for (const edge of edges) {
    const sNode = fileToNodeMap.get(edge.source);
    const tNode = fileToNodeMap.get(edge.target);
    if (sNode && tNode) {
      if (sNode !== tNode) {
        nodeFanOut.set(sNode, (nodeFanOut.get(sNode) || 0) + 1);
        nodeFanIn.set(tNode, (nodeFanIn.get(tNode) || 0) + 1);

        const edgeKey = `${sNode}->${tNode}`;
        if (!nodeEdgeMap.has(edgeKey)) {
          nodeEdgeMap.set(edgeKey, []);
        }
        nodeEdgeMap.get(edgeKey)!.push(edge);
      }
    }
  }

  // Construct folded nodes with dimensions
  // Node height carries how many things depend on it (fanIn)
  // Width comes from the label so long names do not artificially look important
  const nodes: FoldedNode[] = [];
  for (const [folderId, folderFiles] of activeFolders.entries()) {
    const label = labelMap.get(folderId) || folderId;
    const fanIn = nodeFanIn.get(folderId) || 0;
    const fanOut = nodeFanOut.get(folderId) || 0;

    // Base height 66px, scaling with fan-in up to 110px
    const height = Math.round(Math.min(110, 66 + Math.sqrt(fanIn) * 4));
    // Width derived from label length: 12px per char + padding
    const width = Math.max(130, Math.min(260, label.length * 10 + 44));

    nodes.push({
      id: folderId,
      label,
      folder: folderId,
      files: folderFiles,
      fanIn,
      fanOut,
      width,
      height,
    });
  }

  // Deterministic sorting by folder id
  nodes.sort((a, b) => a.id.localeCompare(b.id));

  // Construct folded edges
  const foldedEdges: FoldedEdge[] = [];
  for (const [key, rawList] of nodeEdgeMap.entries()) {
    const [source, target] = key.split('->');
    foldedEdges.push({
      id: key,
      source,
      target,
      count: rawList.length,
      rawEdges: rawList,
    });
  }

  foldedEdges.sort((a, b) => a.id.localeCompare(b.id));

  // Acceptance checks verification
  const validNodeIds = new Set(nodes.map((n) => n.id));
  const hasSingleFileNodes = nodes.some((n) => n.files.length <= 1);
  const allEdgesTerminateOnValidNodes = edges.every((e) => {
    const s = fileToNodeMap.get(e.source);
    const t = fileToNodeMap.get(e.target);
    return s !== undefined && t !== undefined && validNodeIds.has(s) && validNodeIds.has(t);
  });

  return {
    nodes,
    edges: foldedEdges,
    fileToNodeMap,
    threshold: bestThreshold,
    acceptance: {
      nodeCount: nodes.length,
      hasSingleFileNodes,
      allEdgesTerminateOnValidNodes,
      averageFilesPerNode: Math.round((files.length / nodes.length) * 10) / 10,
    },
  };
}

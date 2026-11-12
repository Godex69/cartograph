import dagre from 'dagre';
import { MarkerType } from '@xyflow/react';
import type { Node, BuiltInEdge } from '@xyflow/react';
import type { ParserResult, ParserEdge } from '../parser/types';
import type { FoldingResult, FoldedNode } from './folding';

export const MAX_VISIBLE_ROWS = 9;
export const ROW_HEIGHT = 28;
export const PANEL_HEADER_HEIGHT = 40;
export const PANEL_WIDTH = 290;
export const FOLDED_WIDTH = 210;

export type NodeData = {
  folder: FoldedNode;
  isOpen: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  isHovered: boolean;
  connectedFilesCount: number;
  selectedFileId: string | null;
  hoveredId: string | null;
  activeFilePaths: string[];
  incomingFilePaths: string[];
  outgoingFilePaths: string[];
  isSelectionActive: boolean;
  onOpenFolder: (id: string) => void;
  onCloseFolder: (id: string) => void;
  onSelectNode: (id: string) => void;
  onSelectFile: (filePath: string) => void;
  onHoverNode?: (id: string | null) => void;
  onHoverFile?: (path: string | null) => void;
  [key: string]: unknown;
};

export type AppNode = Node<NodeData>;

export interface ComputedGraphLayout {
  nodes: AppNode[];
  edges: BuiltInEdge[];
}

export interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphLayoutPositions {
  nodePositions: Map<string, NodePosition>;
}

/**
 * Computes deterministic dagre layout positions for nodes.
 * Separated from selection/hover state so it only runs when folders open or close,
 * keeping hover and selection updates instantaneous.
 */
export function computeGraphPositions(
  foldingResult: FoldingResult,
  openNodeIds: Set<string>,
): GraphLayoutPositions {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    nodesep: 60,
    ranksep: 140,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of foldingResult.nodes) {
    const isOpen = openNodeIds.has(n.id);
    let width = FOLDED_WIDTH;
    let height = Math.max(66, n.height);

    if (isOpen) {
      const visibleCount = Math.min(n.files.length, MAX_VISIBLE_ROWS);
      width = PANEL_WIDTH;
      const footerHeight = n.files.length > MAX_VISIBLE_ROWS ? 24 : 8;
      height = PANEL_HEADER_HEIGHT + visibleCount * ROW_HEIGHT + footerHeight;
    }

    g.setNode(n.id, { width, height });
  }

  for (const fe of foldingResult.edges) {
    g.setEdge(fe.source, fe.target);
  }

  dagre.layout(g);

  const nodePositions = new Map<string, NodePosition>();
  for (const n of foldingResult.nodes) {
    const dagreNode = g.node(n.id);
    if (dagreNode) {
      nodePositions.set(n.id, {
        x: dagreNode.x,
        y: dagreNode.y,
        width: dagreNode.width,
        height: dagreNode.height,
      });
    }
  }

  return { nodePositions };
}

/**
 * Computes React Flow nodes and edges based on open states, selection, and hover.
 * Uses cached positions if provided to avoid re-running dagre.
 */
export function computeGraphLayout(
  data: ParserResult,
  foldingResult: FoldingResult,
  openNodeIds: Set<string>,
  selectedId: string | null,
  hoveredId: string | null,
  callbacks: {
    onOpenFolder: (id: string) => void;
    onCloseFolder: (id: string) => void;
    onSelectNode: (id: string) => void;
    onSelectFile: (filePath: string) => void;
    onHoverNode?: (id: string | null) => void;
    onHoverFile?: (path: string | null) => void;
  },
  cachedPositions?: GraphLayoutPositions,
): ComputedGraphLayout {
  const { nodes: foldedNodes, fileToNodeMap } = foldingResult;
  const { edges: rawEdges } = data;

  // 1. Determine active selection sets for highlighting and dimming
  const isSelectedActive = selectedId !== null;
  const activeNodeIds = new Set<string>();
  const activeFilePaths = new Set<string>();
  const incomingFilePaths = new Set<string>();
  const outgoingFilePaths = new Set<string>();

  const isFolder = selectedId ? foldedNodes.some((n) => n.id === selectedId) : false;
  const selectedFileId = !isFolder ? selectedId : null;

  if (selectedId) {
    if (isFolder) {
      activeNodeIds.add(selectedId);
      const selectedFolderNode = foldedNodes.find((n) => n.id === selectedId);
      if (selectedFolderNode) {
        for (const f of selectedFolderNode.files) {
          activeFilePaths.add(f.path);
        }
      }

      for (const e of rawEdges) {
        const sNode = fileToNodeMap.get(e.source);
        const tNode = fileToNodeMap.get(e.target);
        if (sNode && tNode && sNode !== tNode) {
          if (sNode === selectedId) {
            activeNodeIds.add(tNode);
            outgoingFilePaths.add(e.source);
            incomingFilePaths.add(e.target);
            activeFilePaths.add(e.source);
            activeFilePaths.add(e.target);
          }
          if (tNode === selectedId) {
            activeNodeIds.add(sNode);
            outgoingFilePaths.add(e.source);
            incomingFilePaths.add(e.target);
            activeFilePaths.add(e.source);
            activeFilePaths.add(e.target);
          }
        }
      }
    } else {
      activeFilePaths.add(selectedId);
      const parentNode = fileToNodeMap.get(selectedId);
      if (parentNode) activeNodeIds.add(parentNode);

      for (const e of rawEdges) {
        if (e.source === selectedId) {
          activeFilePaths.add(e.target);
          outgoingFilePaths.add(e.target);
          const tNode = fileToNodeMap.get(e.target);
          if (tNode) activeNodeIds.add(tNode);
        }
        if (e.target === selectedId) {
          activeFilePaths.add(e.source);
          incomingFilePaths.add(e.source);
          const sNode = fileToNodeMap.get(e.source);
          if (sNode) activeNodeIds.add(sNode);
        }
      }
    }
  }

  const activeFilesArr = Array.from(activeFilePaths);
  const incomingFilesArr = Array.from(incomingFilePaths);
  const outgoingFilesArr = Array.from(outgoingFilePaths);

  // 2. Positions from cache or compute
  const positions =
    cachedPositions ?? computeGraphPositions(foldingResult, openNodeIds);

  // 3. Build React Flow Nodes
  const rfNodes: AppNode[] = foldedNodes.map((n) => {
    const isOpen = openNodeIds.has(n.id);
    const pos = positions.nodePositions.get(n.id) ?? {
      x: 0,
      y: 0,
      width: FOLDED_WIDTH,
      height: 66,
    };
    const isSelected = selectedId === n.id;
    const isDimmed = isSelectedActive && !activeNodeIds.has(n.id);
    const connectedCount = n.files.filter((f) => activeFilePaths.has(f.path)).length;
    const isNodeHovered =
      hoveredId === n.id || n.files.some((f) => f.path === hoveredId);

    return {
      id: n.id,
      type: isOpen ? 'panelNode' : 'folderNode',
      position: {
        x: pos.x - pos.width / 2,
        y: pos.y - pos.height / 2,
      },
      data: {
        folder: n,
        isOpen,
        isSelected,
        isDimmed,
        isHovered: isNodeHovered,
        connectedFilesCount: connectedCount,
        selectedFileId,
        hoveredId,
        activeFilePaths: activeFilesArr,
        incomingFilePaths: incomingFilesArr,
        outgoingFilePaths: outgoingFilesArr,
        isSelectionActive: isSelectedActive,
        onOpenFolder: callbacks.onOpenFolder,
        onCloseFolder: callbacks.onCloseFolder,
        onSelectNode: callbacks.onSelectNode,
        onSelectFile: callbacks.onSelectFile,
        onHoverNode: callbacks.onHoverNode,
        onHoverFile: callbacks.onHoverFile,
      },
    };
  });

  // 4. Build React Flow Edges with loop-free handle assignments
  const rfEdges: BuiltInEdge[] = [];
  const edgeDedupe = new Map<string, { count: number; rawEdges: ParserEdge[] }>();

  for (const e of rawEdges) {
    const sNode = fileToNodeMap.get(e.source);
    const tNode = fileToNodeMap.get(e.target);
    if (!sNode || !tNode || sNode === tNode) continue;

    const sPos = positions.nodePositions.get(sNode);
    const tPos = positions.nodePositions.get(tNode);
    const isForward = sPos && tPos ? sPos.x <= tPos.x : true;

    // Always use FOLDER-LEVEL handles — one wire per folder pair direction
    // File-level connections shown via row highlighting (IMP/EXP badges + colored backgrounds)
    const sourceHandle = isForward ? 'source-right' : 'source-left';
    const targetHandle = isForward ? 'target-left' : 'target-right';

    const edgeKey = `${sNode}:${sourceHandle}->${tNode}:${targetHandle}`;

    const existing = edgeDedupe.get(edgeKey);
    if (existing) {
      existing.count++;
      existing.rawEdges.push(e);
    } else {
      edgeDedupe.set(edgeKey, { count: 1, rawEdges: [e] });
    }
  }

  // Construct styled React Flow edge definitions
  for (const [key, { count: edgeCount, rawEdges: groupEdges }] of edgeDedupe.entries()) {
    const [fromPart, toPart] = key.split('->');
    const [source, sourceHandle] = fromPart.split(':');
    const [target, targetHandle] = toPart.split(':');

    let isIncoming = false;
    let isOutgoing = false;

    if (isSelectedActive) {
      if (isFolder) {
        if (source === selectedId) {
          isOutgoing = true;
        } else if (target === selectedId) {
          isIncoming = true;
        }
      } else {
        for (const raw of groupEdges) {
          if (raw.source === selectedId) {
            isOutgoing = true;
          }
          if (raw.target === selectedId) {
            isIncoming = true;
          }
        }
      }
    }

    // Check if edge is hovered
    let isHoveredEdge = false;
    if (hoveredId) {
      if (source === hoveredId || target === hoveredId) {
        isHoveredEdge = true;
      } else {
        for (const raw of groupEdges) {
          if (raw.source === hoveredId || raw.target === hoveredId) {
            isHoveredEdge = true;
            break;
          }
        }
      }
    }

    let strokeColor = 'var(--color-border)';
    let strokeWidth = 1;
    let opacity = isSelectedActive ? 0.06 : 0.3;
    let zIndex = 1;
    const animated = false;
    let markerEnd: BuiltInEdge['markerEnd'] = undefined;

    if (isSelectedActive) {
      if (isIncoming) {
        strokeColor = 'var(--color-incoming)';
        strokeWidth = 1.8;
        opacity = 0.85;
        zIndex = 3;
        markerEnd = {
          type: MarkerType.ArrowClosed,
          color: 'var(--color-incoming)',
          width: 10,
          height: 10,
        };
      } else if (isOutgoing) {
        strokeColor = 'var(--color-outgoing)';
        strokeWidth = 1.8;
        opacity = 0.85;
        zIndex = 3;
        markerEnd = {
          type: MarkerType.ArrowClosed,
          color: 'var(--color-outgoing)',
          width: 10,
          height: 10,
        };
      }
    }

    // Hovered edge gets slightly brighter, no glow
    if (isHoveredEdge) {
      strokeColor = isIncoming
        ? 'var(--color-incoming)'
        : isOutgoing
        ? 'var(--color-outgoing)'
        : 'var(--color-accent)';
      strokeWidth = 2.2;
      opacity = 1;
      zIndex = 5;
      markerEnd = {
        type: MarkerType.ArrowClosed,
        color: strokeColor,
        width: 12,
        height: 12,
      };
    }

    // Show connection count label on active edges with multiple bundled connections
    const isActiveEdge = isIncoming || isOutgoing || isHoveredEdge;
    const edgeLabel = isActiveEdge && edgeCount > 1 ? `${edgeCount}` : undefined;

    rfEdges.push({
      id: key,
      source,
      target,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',
      pathOptions: {
        borderRadius: 12,
        offset: 30,
      },
      label: edgeLabel,
      labelStyle: edgeLabel
        ? {
            fill: strokeColor,
            fontSize: 9,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
          }
        : undefined,
      labelBgStyle: edgeLabel
        ? {
            fill: 'var(--color-surface)',
            fillOpacity: 0.9,
            stroke: strokeColor,
            strokeWidth: 0.5,
            rx: 4,
            ry: 4,
          }
        : undefined,
      labelBgPadding: edgeLabel ? [4, 3] as [number, number] : undefined,
      style: {
        stroke: strokeColor,
        strokeWidth,
        opacity,
        transition: 'stroke 0.2s ease, stroke-width 0.2s ease, opacity 0.2s ease',
      },
      zIndex,
      animated,
      markerEnd,
    });
  }

  return { nodes: rfNodes, edges: rfEdges };
}

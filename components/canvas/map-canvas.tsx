'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  BackgroundVariant,
  Controls,
} from '@xyflow/react';

import type { NodeTypes, Node } from '@xyflow/react';
import type { ParserResult } from '@/lib/parser/types';
import type { AppNode } from '@/lib/canvas/layout';
import { foldRepository } from '@/lib/canvas/folding';
import { computeGraphLayout, computeGraphPositions } from '@/lib/canvas/layout';
import { FolderNode } from './folder-node';
import { PanelNode } from './panel-node';

const nodeTypes: NodeTypes = {
  folderNode: FolderNode as unknown as NodeTypes[string],
  panelNode: PanelNode as unknown as NodeTypes[string],
};

interface MapCanvasProps {
  data: ParserResult;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
}

function InnerMapCanvas({
  data,
  selectedId,
  onSelect,
  hoveredId = null,
  onHover,
}: MapCanvasProps) {
  const { getViewport, fitView } = useReactFlow();
  const [openNodeIds, setOpenNodeIds] = useState<Set<string>>(() => new Set());
  // Scoped manually closed folders per selection ID (zero-effect, pure derivation)
  const [closedBySelection, setClosedBySelection] = useState<Record<string, string[]>>({});
  const initialFitDone = useRef(false);
  const prevSelectedRef = useRef<string | null>(null);

  // Compute folding hierarchy once from data
  const foldingResult = useMemo(() => foldRepository(data), [data]);

  const manuallyClosedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set<string>(closedBySelection[selectedId] || []);
  }, [selectedId, closedBySelection]);

  // Derived: expand parent folder + connected folders (capped to avoid layout explosion)
  // Each folder pair gets one clean wire; file-level connections shown via row highlighting
  const effectiveOpenNodeIds = useMemo(() => {
    const result = new Set<string>(openNodeIds);

    if (!selectedId) {
      return result;
    }

    const isFolderSelection = foldingResult.nodes.some((n) => n.id === selectedId);

    if (isFolderSelection) {
      if (!manuallyClosedIds.has(selectedId)) {
        result.add(selectedId);
      }
      return result;
    }

    // 1. Always unfold parent folder of the selected file
    const parentFolder = foldingResult.fileToNodeMap.get(selectedId);
    if (parentFolder && !manuallyClosedIds.has(parentFolder)) {
      result.add(parentFolder);
    }

    // 2. Collect connected folders with connection counts
    const connectedCounts = new Map<string, number>();
    for (const e of data.edges) {
      if (e.source === selectedId) {
        const tFolder = foldingResult.fileToNodeMap.get(e.target);
        if (tFolder && tFolder !== parentFolder && !manuallyClosedIds.has(tFolder)) {
          connectedCounts.set(tFolder, (connectedCounts.get(tFolder) || 0) + 1);
        }
      }
      if (e.target === selectedId) {
        const sFolder = foldingResult.fileToNodeMap.get(e.source);
        if (sFolder && sFolder !== parentFolder && !manuallyClosedIds.has(sFolder)) {
          connectedCounts.set(sFolder, (connectedCounts.get(sFolder) || 0) + 1);
        }
      }
    }

    // 3. Auto-expand up to MAX_AUTO_EXPAND connected folders (sorted by most connections first)
    const MAX_AUTO_EXPAND = 8;
    const sorted = [...connectedCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_AUTO_EXPAND);

    for (const [folderId] of sorted) {
      result.add(folderId);
    }

    return result;
  }, [openNodeIds, selectedId, foldingResult, data.edges, manuallyClosedIds]);

  // Open folder explicitly (idempotent, only zooms out)
  const handleOpenFolder = useCallback(
    (folderId: string) => {
      const currentZoom = getViewport().zoom;

      setOpenNodeIds((prev) => {
        const next = new Set(prev);
        next.add(folderId);
        return next;
      });

      if (selectedId) {
        setClosedBySelection((prev) => {
          const list = prev[selectedId] || [];
          if (!list.includes(folderId)) return prev;
          return {
            ...prev,
            [selectedId]: list.filter((id) => id !== folderId),
          };
        });
      }

      // Refit gently after render: strictly zoom out only, never in
      setTimeout(() => {
        fitView({
          duration: 250,
          padding: 0.12,
          maxZoom: currentZoom,
        });
      }, 50);
    },
    [selectedId, getViewport, fitView],
  );

  // Close folder explicitly (idempotent)
  const handleCloseFolder = useCallback(
    (folderId: string) => {
      setOpenNodeIds((prev) => {
        if (!prev.has(folderId)) return prev;
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });

      if (selectedId) {
        setClosedBySelection((prev) => {
          const list = prev[selectedId] || [];
          if (list.includes(folderId)) return prev;
          return {
            ...prev,
            [selectedId]: [...list, folderId],
          };
        });
      }
    },
    [selectedId],
  );

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      onSelect(selectedId === nodeId ? null : nodeId);
    },
    [selectedId, onSelect],
  );

  const handleSelectFile = useCallback(
    (filePath: string) => {
      onSelect(selectedId === filePath ? null : filePath);
    },
    [selectedId, onSelect],
  );

  const handlePaneClick = useCallback(() => {
    onSelect(null);
  }, [onSelect]);

  // Pressing Escape deselects
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelect(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelect]);

  // Dagre layout positions are cached and only recalculated when open panels change
  const cachedPositions = useMemo(() => {
    return computeGraphPositions(foldingResult, effectiveOpenNodeIds);
  }, [foldingResult, effectiveOpenNodeIds]);

  // Hover and selection updates compute in sub-millisecond time without re-running dagre
  const { nodes, edges } = useMemo(() => {
    return computeGraphLayout(
      data,
      foldingResult,
      effectiveOpenNodeIds,
      selectedId,
      hoveredId,
      {
        onOpenFolder: handleOpenFolder,
        onCloseFolder: handleCloseFolder,
        onSelectNode: handleSelectNode,
        onSelectFile: handleSelectFile,
        onHoverNode: onHover,
        onHoverFile: onHover,
      },
      cachedPositions,
    );
  }, [
    data,
    foldingResult,
    effectiveOpenNodeIds,
    selectedId,
    hoveredId,
    handleOpenFolder,
    handleCloseFolder,
    handleSelectNode,
    handleSelectFile,
    onHover,
    cachedPositions,
  ]);

  // Initial fit: deterministic, uses canvas nicely
  useEffect(() => {
    if (!initialFitDone.current) {
      initialFitDone.current = true;
      const timer = setTimeout(() => {
        fitView({ padding: 0.1, minZoom: 0.35, maxZoom: 1 });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [fitView]);

  // When a new file is clicked, refit gently if new connected panels unfold (strictly zoom out only)
  useEffect(() => {
    if (selectedId && selectedId !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedId;
      const currentZoom = getViewport().zoom;
      const timer = setTimeout(() => {
        fitView({
          duration: 300,
          padding: 0.14,
          maxZoom: currentZoom,
        });
      }, 60);
      return () => clearTimeout(timer);
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId, getViewport, fitView]);

  return (
    <div className="relative h-full w-full select-none bg-background">
      <ReactFlow<AppNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onPaneClick={handlePaneClick}
        onNodeMouseEnter={(_: React.MouseEvent, node: Node) => onHover?.(node.id)}
        onNodeMouseLeave={() => onHover?.(null)}
        minZoom={0.15}
        maxZoom={2.0}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        className="cartograph-flow"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="var(--color-border)"
          className="opacity-40 dark:opacity-20"
        />
        <Controls
          showInteractive={false}
          className="!border !border-border !bg-surface !shadow-xs [&>button]:!border-border [&>button]:!bg-surface [&>button]:!text-foreground [&>button:hover]:!bg-surface-hover"
        />
      </ReactFlow>

      {/* Canvas Status Indicator overlay */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded border border-border bg-surface/90 px-2.5 py-1.5 font-mono text-[10px] text-foreground-muted backdrop-blur-xs shadow-xs">
        <span>
          Nodes: <strong className="text-foreground">{nodes.length}</strong>
        </span>
        <span>·</span>
        <span>
          Open Panels: <strong className="text-foreground">{effectiveOpenNodeIds.size}</strong>
        </span>
        <span>·</span>
        <span>
          Edges: <strong className="text-foreground">{edges.length}</strong>
        </span>
        {selectedId ? (
          <>
            <span>·</span>
            <span className="text-accent font-semibold truncate max-w-xs">
              Selected: {selectedId}
            </span>
            <button
              onClick={() => onSelect(null)}
              className="pointer-events-auto rounded bg-surface-raised px-1.5 py-0.5 text-[9px] text-foreground-muted hover:text-foreground border border-border-subtle cursor-pointer hover:bg-surface-hover transition-colors"
            >
              clear (Esc)
            </button>
          </>
        ) : (
          <>
            <span>·</span>
            <span className="text-foreground-dim">click node or row to inspect</span>
          </>
        )}
      </div>
    </div>
  );
}

export function MapCanvas(props: MapCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerMapCanvas {...props} />
    </ReactFlowProvider>
  );
}

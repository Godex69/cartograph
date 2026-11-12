'use client';

import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ParserFileNode } from '@/lib/parser/types';
import type { AppNode } from '@/lib/canvas/layout';
import { PANEL_WIDTH } from '@/lib/canvas/layout';

function PanelNodeComponent({ data }: NodeProps<AppNode>) {
  const {
    folder,
    isSelected,
    isDimmed,
    isHovered,
    selectedFileId,
    hoveredId,
    activeFilePaths,
    incomingFilePaths,
    outgoingFilePaths,
    isSelectionActive,
    onCloseFolder,
    onSelectNode,
    onSelectFile,
    onHoverNode,
    onHoverFile,
  } = data;

  const isConnectedNeighbour = isSelectionActive && !isDimmed && !isSelected;

  // Identify files in this folder connected to current selection
  const connectedFiles = useMemo(() => {
    if (!isSelectionActive) return [];
    return folder.files.filter(
      (f) =>
        selectedFileId === f.path ||
        incomingFilePaths.includes(f.path) ||
        outgoingFilePaths.includes(f.path) ||
        activeFilePaths.includes(f.path),
    );
  }, [folder.files, isSelectionActive, selectedFileId, incomingFilePaths, outgoingFilePaths, activeFilePaths]);

  const hasConnectedFiles = isSelectionActive && !isSelected && connectedFiles.length > 0;

  // Float active matching files to the top so connected files are visible without scrolling
  const displayFiles = useMemo(() => {
    if (!hasConnectedFiles && !selectedFileId) {
      return folder.files;
    }

    let selectedNode: ParserFileNode | null = null;
    const active: ParserFileNode[] = [];
    const inactive: ParserFileNode[] = [];

    for (const f of folder.files) {
      if (selectedFileId === f.path) {
        selectedNode = f;
      } else if (
        incomingFilePaths.includes(f.path) ||
        outgoingFilePaths.includes(f.path) ||
        activeFilePaths.includes(f.path)
      ) {
        active.push(f);
      } else {
        inactive.push(f);
      }
    }

    const result: ParserFileNode[] = [];
    if (selectedNode) result.push(selectedNode);
    result.push(...active, ...inactive);
    return result;
  }, [folder.files, hasConnectedFiles, selectedFileId, incomingFilePaths, outgoingFilePaths, activeFilePaths]);

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCloseFolder(folder.id);
  };

  const handleHeaderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectNode(folder.id);
  };

  const handleHeaderDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCloseFolder(folder.id);
  };

  const isHeaderHovered = hoveredId === folder.id;

  return (
    <div
      style={{ width: PANEL_WIDTH }}
      className={`rounded-md border font-mono select-none shadow-md transition-all bg-surface ${
        isSelected
          ? 'border-accent ring-2 ring-accent shadow-lg z-30'
          : isHovered
          ? 'border-accent ring-2 ring-accent/60 shadow-lg z-25'
          : isConnectedNeighbour
          ? 'border-accent/60 ring-1 ring-accent/30 shadow-sm z-20'
          : isDimmed
          ? 'border-border-subtle/80 z-10'
          : 'border-border z-10'
      }`}
    >
      {/* Node-Level Loop-Free Handles (Fallback when folder level is connected) */}
      <Handle
        type="target"
        id="target-left"
        position={Position.Left}
        className="!h-2 !w-2 !rounded-full opacity-0 pointer-events-none"
      />
      <Handle
        type="source"
        id="source-left"
        position={Position.Left}
        className="!h-2 !w-2 !rounded-full opacity-0 pointer-events-none"
      />
      <Handle
        type="target"
        id="target-right"
        position={Position.Right}
        className="!h-2 !w-2 !rounded-full opacity-0 pointer-events-none"
      />
      <Handle
        type="source"
        id="source-right"
        position={Position.Right}
        className="!h-2 !w-2 !rounded-full opacity-0 pointer-events-none"
      />

      {/* Panel Header */}
      <div
        onClick={handleHeaderClick}
        onDoubleClick={handleHeaderDoubleClick}
        onMouseEnter={() => onHoverNode?.(folder.id)}
        onMouseLeave={() => onHoverNode?.(null)}
        title="Click to select folder, double-click to collapse"
        className={`flex h-10 items-center justify-between border-b border-border px-3 cursor-pointer transition-colors rounded-t-md ${
          isHeaderHovered ? 'bg-surface-hover border-accent' : 'bg-surface-raised hover:bg-surface-hover'
        } ${isDimmed && !isHovered ? 'opacity-40' : 'opacity-100'}`}
      >
        <div className="flex items-center gap-1.5 truncate pr-2">
          <span className="text-[11px] shrink-0 text-foreground-dim">📂</span>
          <span className="truncate text-xs font-semibold text-foreground">
            {folder.label}
          </span>
          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-foreground-muted border border-border-subtle tabular-nums font-medium">
            {folder.files.length}
          </span>
          {hasConnectedFiles && (
            <span
              className="rounded bg-accent/20 border border-accent/40 px-1.5 py-0.2 text-[9px] font-semibold text-accent tabular-nums shrink-0"
              title={`${connectedFiles.length} files connect to current selection`}
            >
              {connectedFiles.length} hit
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] tabular-nums shrink-0">
          <span
            className="text-incoming font-medium flex items-center gap-1"
            title={`Exports: ${folder.fanIn} external files import from this folder`}
          >
            <span className="text-[9px] uppercase tracking-wider font-semibold text-incoming/80">exp</span>
            <span className="font-semibold">{folder.fanIn}</span>
          </span>
          <span className="text-border">·</span>
          <span
            className="text-outgoing font-medium flex items-center gap-1"
            title={`Imports: ${folder.fanOut} external files imported by this folder`}
          >
            <span className="text-[9px] uppercase tracking-wider font-semibold text-outgoing/80">imp</span>
            <span className="font-semibold">{folder.fanOut}</span>
          </span>

          {/* Dedicated Close Button */}
          <button
            type="button"
            onClick={handleCloseClick}
            title="Close panel back to folded node"
            className="flex items-center gap-1 rounded bg-surface hover:bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground font-medium border border-border-subtle transition-colors cursor-pointer hover:border-accent ml-1"
          >
            <span>− Close</span>
          </button>
        </div>
      </div>

      {/* File Rows — Scrollable container with wheel isolation */}
      <div
        className="nowheel overflow-y-auto max-h-[252px] py-0.5 divide-y divide-border-subtle/50 select-none"
        onWheel={(e) => {
          e.stopPropagation();
        }}
      >
        {displayFiles.map((file: ParserFileNode, idx: number) => {
          const isFileSelected = selectedFileId === file.path;
          const isRowHovered = hoveredId === file.path;
          const isIncoming = isSelectionActive && incomingFilePaths.includes(file.path);
          const isOutgoing = isSelectionActive && outgoingFilePaths.includes(file.path);
          const isDirectlyActive =
            isFileSelected ||
            isRowHovered ||
            isIncoming ||
            isOutgoing ||
            (isSelected && !selectedFileId) ||
            activeFilePaths.includes(file.path);

          const isRowDimmed = isSelectionActive && !isDirectlyActive;

          // Divider between active matching files and other files
          const showDividerBefore =
            (hasConnectedFiles || selectedFileId) &&
            idx === (selectedFileId ? (folder.files.some(f => f.path === selectedFileId) ? 1 + (connectedFiles.length - 1) : connectedFiles.length) : connectedFiles.length) &&
            idx < folder.files.length &&
            idx > 0;

          return (
            <div key={file.path}>
              {showDividerBefore && (
                <div className="flex items-center justify-between px-3 py-1 bg-surface-raised/40 border-y border-border-subtle/60 text-[9px] text-foreground-dim uppercase tracking-wider">
                  <span>other files</span>
                  <span>{folder.files.length - idx} dimmed</span>
                </div>
              )}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectFile(file.path);
                }}
                onMouseEnter={() => onHoverFile?.(file.path)}
                onMouseLeave={() => onHoverFile?.(null)}
                title={`${file.path}\nLines: ${file.lines}\nExports (fan-in): ${file.fanIn}\nImports (fan-out): ${file.fanOut}`}
                className={`relative flex h-7 items-center justify-between px-3 text-[11px] cursor-pointer transition-colors ${
                  isFileSelected
                    ? 'bg-accent/25 border-l-2 border-accent text-accent font-semibold ring-1 ring-accent/50'
                    : isRowHovered
                    ? 'bg-accent/20 border-l-2 border-accent text-foreground font-semibold ring-1 ring-accent/60 !opacity-100'
                    : isIncoming
                    ? 'bg-incoming/20 border-l-2 border-incoming text-foreground font-medium ring-1 ring-incoming/30'
                    : isOutgoing
                    ? 'bg-outgoing/20 border-l-2 border-outgoing text-foreground font-medium ring-1 ring-outgoing/30'
                    : isRowDimmed
                    ? 'opacity-20 text-foreground-dim hover:opacity-75'
                    : 'text-foreground hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate pr-2">
                  {isFileSelected && (
                    <span className="shrink-0 rounded bg-accent px-1 py-0.2 text-[8px] font-bold text-white uppercase">
                      SEL
                    </span>
                  )}
                  {isRowHovered && !isFileSelected && (
                    <span className="shrink-0 rounded bg-accent/30 border border-accent/50 px-1 py-0.2 text-[8px] font-bold text-accent uppercase">
                      HOV
                    </span>
                  )}
                  {isIncoming && !isFileSelected && !isRowHovered && (
                    <span className="shrink-0 rounded bg-incoming/25 border border-incoming/40 px-1 py-0.2 text-[8px] font-bold text-incoming uppercase">
                      EXP
                    </span>
                  )}
                  {isOutgoing && !isFileSelected && !isRowHovered && (
                    <span className="shrink-0 rounded bg-outgoing/25 border border-outgoing/40 px-1 py-0.2 text-[8px] font-bold text-outgoing uppercase">
                      IMP
                    </span>
                  )}
                  <span className={`truncate font-mono ${isDirectlyActive ? 'text-foreground font-medium' : ''}`}>
                    {file.name}
                  </span>
                </div>

                <span className="shrink-0 text-[10px] text-foreground-dim tabular-nums">
                  {file.lines}L
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Panel Footer: scroll indicator when folder has more than 9 files */}
      {folder.files.length > 9 ? (
        <div className="flex items-center justify-between px-3 py-1 bg-surface-raised/80 border-t border-border-subtle text-[10px] text-foreground-muted tabular-nums rounded-b-md">
          <span>{folder.files.length} total files</span>
          <span className="text-[9px] text-foreground-dim font-mono">↕ scroll to view all</span>
        </div>
      ) : null}
    </div>
  );
}

export const PanelNode = memo(PanelNodeComponent);

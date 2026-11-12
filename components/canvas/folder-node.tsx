'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { AppNode } from '@/lib/canvas/layout';
import { FOLDED_WIDTH } from '@/lib/canvas/layout';

function FolderNodeComponent({ data }: NodeProps<AppNode>) {
  const {
    folder,
    isSelected,
    isDimmed,
    isHovered,
    connectedFilesCount = 0,
    isSelectionActive,
    onOpenFolder,
    onSelectNode,
    onHoverNode,
  } = data;

  const isConnectedNeighbour = isSelectionActive && !isDimmed && !isSelected;

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectNode(folder.id);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectNode(folder.id);
    onOpenFolder(folder.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenFolder(folder.id);
  };

  const handleMouseEnter = () => {
    onHoverNode?.(folder.id);
  };

  const handleMouseLeave = () => {
    onHoverNode?.(null);
  };

  return (
    <div
      onClick={handleCardClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: FOLDED_WIDTH,
        height: Math.max(66, folder.height),
      }}
      className={`group relative flex flex-col justify-between rounded-md border p-2.5 font-mono select-none transition-all cursor-pointer shadow-xs bg-surface ${
        isSelected
          ? 'border-accent ring-2 ring-accent shadow-md z-30'
          : isHovered
          ? 'border-accent ring-2 ring-accent/70 shadow-md bg-surface-hover z-25'
          : isConnectedNeighbour
          ? 'border-accent/60 ring-1 ring-accent/30 shadow-xs z-20'
          : isDimmed
          ? 'border-border-subtle/80 z-10'
          : 'border-border hover:border-accent/70 hover:bg-surface-hover z-10'
      }`}
    >
      {/* Bidirectional Loop-Free Handles (Left & Right for both Source & Target) */}
      <Handle
        type="target"
        id="target-left"
        position={Position.Left}
        className="!h-2 !w-2 !rounded-full !border-border !bg-surface-raised opacity-0 pointer-events-none"
      />
      <Handle
        type="source"
        id="source-left"
        position={Position.Left}
        className="!h-2 !w-2 !rounded-full !border-border !bg-surface-raised opacity-0 pointer-events-none"
      />
      <Handle
        type="target"
        id="target-right"
        position={Position.Right}
        className="!h-2 !w-2 !rounded-full !border-border !bg-surface-raised opacity-0 pointer-events-none"
      />
      <Handle
        type="source"
        id="source-right"
        position={Position.Right}
        className="!h-2 !w-2 !rounded-full !border-border !bg-surface-raised opacity-0 pointer-events-none"
      />

      {/* Internal Content (Dimmed inside while card background remains 100% solid and opaque) */}
      <div
        className={`flex flex-col justify-between h-full transition-opacity ${
          isDimmed && !isHovered ? 'opacity-30 group-hover:opacity-85' : 'opacity-100'
        }`}
      >
        {/* Top Row: Folder Icon, Label, Connection Hit Badge & File Count */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[11px] shrink-0 text-foreground-dim">📁</span>
            <span className="font-semibold text-xs text-foreground tracking-tight truncate">
              {folder.label}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isSelectionActive && !isSelected && connectedFilesCount > 0 && (
              <span
                className="rounded bg-accent/20 border border-accent/40 px-1 py-0.2 text-[9px] font-semibold text-accent tabular-nums"
                title={`${connectedFilesCount} files connected to current selection`}
              >
                {connectedFilesCount} hit
              </span>
            )}
            <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-foreground-muted border border-border-subtle tabular-nums font-medium">
              {folder.files.length}
            </span>
          </div>
        </div>

        {/* Bottom Row: Total Export & Import counts & Explicit Expand Action */}
        <div className="flex items-center justify-between border-t border-border-subtle/80 pt-1.5 mt-1.5 text-[10px]">
          <div className="flex items-center gap-2 tabular-nums text-[10px]">
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
          </div>

          {/* Clear, dedicated Expand button */}
          <button
            type="button"
            onClick={handleExpandClick}
            title="Open folder into panel"
            className="flex items-center gap-1 rounded bg-surface-raised hover:bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground font-medium border border-border-subtle transition-colors cursor-pointer hover:border-accent hover:text-accent"
          >
            <span>+ Expand</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export const FolderNode = memo(FolderNodeComponent);

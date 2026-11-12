'use client';

import { useMemo, useState } from 'react';
import type { ParserResult } from '@/lib/parser/types';
import { foldRepository } from '@/lib/canvas/folding';
import { deriveFileCategories } from '@/lib/canvas/categories';
import { ThemeToggle } from './theme-toggle';
import { MapCanvas } from './canvas/map-canvas';
import { DetailPane } from './canvas/detail-pane';

interface CanvasShellProps {
  data: ParserResult;
  repoName?: string;
}

export function CanvasShell({ data, repoName = 'honojs/hono' }: CanvasShellProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'structure' | 'explanation'>('structure');

  const categories = useMemo(() => deriveFileCategories(data.files), [data.files]);
  const foldingResult = useMemo(() => foldRepository(data), [data]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground antialiased selection:bg-accent/20">
      {/* Top Application Header */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-surface px-3 select-none">
        {/* Left: Brand + Context */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-wider text-foreground">
              CARTOGRAPH
            </span>
            <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-foreground-muted border border-border-subtle">
              canvas
            </span>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Repository Info */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-foreground-muted text-[11px]">repo:</span>
            <span className="font-semibold text-foreground">{repoName}</span>
            <span className="rounded bg-accent/10 px-1.5 py-0.2 text-[10px] font-medium text-accent border border-accent/20">
              preview
            </span>
          </div>
        </div>

        {/* Right: Metrics + Theme Switcher */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-foreground-muted">
            <span>
              <strong className="text-foreground font-medium">{data.files.length}</strong> files
            </span>
            <span className="text-foreground-dim">·</span>
            <span>
              <strong className="text-foreground font-medium">{data.edges.length}</strong> edges
            </span>
            <span className="text-foreground-dim">·</span>
            <span>
              <strong className="text-foreground font-medium">{data.coverage.distinctFoldersCount}</strong> folders
            </span>
          </div>

          <div className="h-4 w-px bg-border" />

          <ThemeToggle />
        </div>
      </header>

      {/* Three Column Canvas Shell */}
      <div className="flex flex-1 overflow-hidden">
        {/* Column 1: Left Rail (Categories) */}
        <aside
          aria-label="File categories rail"
          className="w-56 shrink-0 flex flex-col border-r border-border bg-surface font-mono select-none"
        >
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3 text-[11px] font-medium text-foreground-muted">
            <span className="tracking-wider uppercase">Categories</span>
            <span className="text-[10px] text-foreground-dim tabular-nums">
              {categories.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-2 rounded px-2 py-1 text-[11px] transition-colors"
              >
                {/* Colour swatch */}
                <span
                  className="h-2 w-2 rounded-xs shrink-0"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden="true"
                />
                {/* Category name */}
                <span className="truncate text-foreground font-mono">{cat.name}</span>
                {/* File count */}
                <span className="ml-auto tabular-nums text-foreground-muted font-mono">
                  {cat.count}
                </span>
              </div>
            ))}
          </div>

          {/* Footer in left rail */}
          <div className="h-7 shrink-0 border-t border-border px-3 flex items-center justify-between text-[10px] text-foreground-dim">
            <span>TOTAL FILES</span>
            <span className="tabular-nums font-semibold text-foreground">
              {data.files.length}
            </span>
          </div>
        </aside>

        {/* Column 2: Center Map Canvas */}
        <main
          aria-label="Map Canvas"
          className="flex-1 relative flex flex-col overflow-hidden bg-background"
        >
          {/* Canvas Sub-header */}
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-border bg-surface/50 px-3 font-mono text-[11px] text-foreground-muted select-none">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground uppercase tracking-wider">Canvas</span>
              <span className="text-foreground-dim">|</span>
              <span className="truncate max-w-md text-foreground-dim">
                {data.rootDir}
              </span>
            </div>
            <div className="text-[10px] text-foreground-dim">
              Folding: Deepest-first (deterministic)
            </div>
          </div>

          {/* Map Canvas Viewport with Folded Nodes and Panels */}
          <div className="flex-1 relative overflow-hidden">
            <MapCanvas
              data={data}
              selectedId={selectedId}
              onSelect={setSelectedId}
              hoveredId={hoveredId}
              onHover={setHoveredId}
            />
          </div>
        </main>

        {/* Column 3: Right Detail Pane */}
        <aside
          aria-label="Detail inspector pane"
          className="w-80 shrink-0 flex flex-col border-l border-border bg-surface font-mono select-none overflow-hidden"
        >
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3 text-[11px] font-medium text-foreground-muted">
            <span className="tracking-wider uppercase">Detail</span>
            <span className="text-[10px] text-foreground-dim">
              {selectedId ? 'INSPECTING' : 'INSPECTOR'}
            </span>
          </div>

          <DetailPane
            data={data}
            foldingResult={foldingResult}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            repoName={repoName}
          />
        </aside>
      </div>
    </div>
  );
}

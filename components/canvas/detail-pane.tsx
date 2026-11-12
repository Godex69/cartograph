'use client';

import { useMemo } from 'react';
import type { ParserResult, ParserFileNode } from '@/lib/parser/types';
import type { FoldingResult } from '@/lib/canvas/folding';
import {
  getFileCategory,
  countUnidentifiedFiles,
  getFolderCategoryBreakdown,
  detectFramework,
} from '@/lib/canvas/categories';

export interface DetailPaneProps {
  data: ParserResult;
  foldingResult: FoldingResult;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  activeTab?: 'structure' | 'explanation';
  onTabChange?: (tab: 'structure' | 'explanation') => void;
  repoName?: string;
  onOpenFolder?: (id: string) => void;
  openNodeIds?: Set<string>;
}

export function DetailPane({
  data,
  foldingResult,
  selectedId,
  onSelect,
  hoveredId = null,
  onHover,
  activeTab = 'structure',
  onTabChange,
  repoName = 'honojs/hono',
  onOpenFolder,
  openNodeIds,
}: DetailPaneProps) {
  const { files, edges } = data;
  const { nodes: foldedNodes, fileToNodeMap } = foldingResult;

  const isFolder = selectedId ? foldedNodes.some((n) => n.id === selectedId) : false;

  // Selected Folder Data
  const selectedFolder = useMemo(() => {
    if (!isFolder || !selectedId) return null;
    return foldedNodes.find((n) => n.id === selectedId) || null;
  }, [isFolder, selectedId, foldedNodes]);

  // Selected File Data
  const selectedFile = useMemo(() => {
    if (isFolder || !selectedId) return null;
    return files.find((f) => f.path === selectedId) || null;
  }, [isFolder, selectedId, files]);

  // Index files and edges for fast O(1) dependency resolution
  const { fileMap, incomingEdgesMap, outgoingEdgesMap } = useMemo(() => {
    const fMap = new Map<string, ParserFileNode>();
    for (const f of files) {
      fMap.set(f.path, f);
    }

    const inMap = new Map<string, Set<string>>();
    const outMap = new Map<string, Set<string>>();

    for (const e of edges) {
      if (e.source === e.target) continue;

      let inSet = inMap.get(e.target);
      if (!inSet) {
        inSet = new Set();
        inMap.set(e.target, inSet);
      }
      inSet.add(e.source);

      let outSet = outMap.get(e.source);
      if (!outSet) {
        outSet = new Set();
        outMap.set(e.source, outSet);
      }
      outSet.add(e.target);
    }

    return { fileMap: fMap, incomingEdgesMap: inMap, outgoingEdgesMap: outMap };
  }, [files, edges]);

  // Exact file dependencies and dependents (guaranteed count === rows)
  const fileDeps = useMemo(() => {
    if (!selectedFile) return { dependencies: [], dependents: [] };

    const outSet = outgoingEdgesMap.get(selectedFile.path) ?? new Set<string>();
    const inSet = incomingEdgesMap.get(selectedFile.path) ?? new Set<string>();

    const dependencies: ParserFileNode[] = [];
    for (const targetPath of outSet) {
      const f = fileMap.get(targetPath);
      if (f) dependencies.push(f);
    }
    dependencies.sort((a, b) => a.path.localeCompare(b.path));

    const dependents: ParserFileNode[] = [];
    for (const sourcePath of inSet) {
      const f = fileMap.get(sourcePath);
      if (f) dependents.push(f);
    }
    dependents.sort((a, b) => a.path.localeCompare(b.path));

    return { dependencies, dependents };
  }, [selectedFile, outgoingEdgesMap, incomingEdgesMap, fileMap]);

  // Folder dependencies and breakdown of kinds
  const folderDeps = useMemo(() => {
    if (!selectedFolder) {
      return {
        folderDependencies: [],
        folderDependents: [],
        categoryBreakdown: [],
      };
    }

    const folderFilesSet = new Set(selectedFolder.files.map((f) => f.path));
    const externalImportsMap = new Map<string, { file: ParserFileNode; count: number }>();
    const externalImportedByMap = new Map<string, { file: ParserFileNode; count: number }>();

    for (const e of edges) {
      const sIn = folderFilesSet.has(e.source);
      const tIn = folderFilesSet.has(e.target);

      if (sIn && !tIn) {
        const targetFile = fileMap.get(e.target);
        if (targetFile) {
          const prev = externalImportsMap.get(targetFile.path);
          if (prev) prev.count += 1;
          else externalImportsMap.set(targetFile.path, { file: targetFile, count: 1 });
        }
      }

      if (!sIn && tIn) {
        const sourceFile = fileMap.get(e.source);
        if (sourceFile) {
          const prev = externalImportedByMap.get(sourceFile.path);
          if (prev) prev.count += 1;
          else externalImportedByMap.set(sourceFile.path, { file: sourceFile, count: 1 });
        }
      }
    }

    const categoryBreakdown = getFolderCategoryBreakdown(selectedFolder.files);

    const folderDependencies = Array.from(externalImportsMap.values()).sort(
      (a, b) => b.count - a.count || a.file.path.localeCompare(b.file.path),
    );
    const folderDependents = Array.from(externalImportedByMap.values()).sort(
      (a, b) => b.count - a.count || a.file.path.localeCompare(b.file.path),
    );

    return {
      folderDependencies,
      folderDependents,
      categoryBreakdown,
    };
  }, [selectedFolder, edges, fileMap]);

  // Repository summary metrics and ranked lists
  const repoSummary = useMemo(() => {
    const framework = detectFramework(files);
    const routesCount = files.filter(
      (f) => f.role === 'route' || f.kind === 'route',
    ).length;

    // What the rest of the repository leans on most
    const mostDependedOn = [...files]
      .filter((f) => f.fanIn > 0)
      .sort((a, b) => b.fanIn - a.fanIn || a.path.localeCompare(b.path));

    // The files nothing imports at all (where reading starts)
    const readingStarts = [...files]
      .filter((f) => f.fanIn === 0)
      .sort((a, b) => b.fanOut - a.fanOut || b.lines - a.lines || a.path.localeCompare(b.path));

    const unidentifiedCount = countUnidentifiedFiles(files);

    return {
      framework,
      routesCount,
      mostDependedOn,
      readingStarts,
      unidentifiedCount,
    };
  }, [files]);

  const selectedCategory = selectedFile ? getFileCategory(selectedFile) : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden font-mono select-none">
      {/* Tabs Header: Structure & Explanation (Survives selection changes) */}
      <div className="flex shrink-0 items-center border-b border-border bg-surface p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => onTabChange?.('structure')}
          className={`flex-1 rounded py-1 px-2 text-center text-[11px] font-medium transition-colors cursor-pointer ${
            activeTab === 'structure'
              ? 'bg-surface-raised text-foreground font-semibold border border-border shadow-xs'
              : 'text-foreground-muted hover:text-foreground hover:bg-surface-raised/60'
          }`}
        >
          Structure
        </button>
        <button
          type="button"
          onClick={() => onTabChange?.('explanation')}
          className={`flex-1 rounded py-1 px-2 text-center text-[11px] font-medium transition-colors cursor-pointer ${
            activeTab === 'explanation'
              ? 'bg-surface-raised text-foreground font-semibold border border-border shadow-xs'
              : 'text-foreground-muted hover:text-foreground hover:bg-surface-raised/60'
          }`}
        >
          Explanation
        </button>
      </div>

      {/* Tab: Explanation (Empty state for now, filled when model call is integrated) */}
      {activeTab === 'explanation' && (
        <div className="flex flex-1 flex-col p-4 text-[11px] overflow-y-auto">
          <div className="rounded border border-border bg-surface-raised/40 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-xs">Explanation</span>
              <span className="rounded bg-surface px-1.5 py-0.5 text-[9px] text-foreground-dim border border-border-subtle uppercase">
                AI Model
              </span>
            </div>

            <div className="text-foreground-muted text-[11px] leading-relaxed">
              {selectedFile ? (
                <>
                  <div className="font-medium text-foreground truncate">{selectedFile.name}</div>
                  <div className="text-[10px] text-foreground-dim truncate mb-2">
                    {selectedFile.path}
                  </div>
                  <p className="italic text-foreground-dim">
                    No explanation generated yet. Explanations will appear here once connected to the AI client.
                  </p>
                </>
              ) : selectedFolder ? (
                <>
                  <div className="font-medium text-foreground truncate">📁 {selectedFolder.label}</div>
                  <div className="text-[10px] text-foreground-dim truncate mb-2">
                    {selectedFolder.folder}
                  </div>
                  <p className="italic text-foreground-dim">
                    No module explanation generated yet. Explanations will appear here once connected to the AI client.
                  </p>
                </>
              ) : (
                <>
                  <div className="font-medium text-foreground truncate">Repository Overview</div>
                  <div className="text-[10px] text-foreground-dim truncate mb-2">{repoName}</div>
                  <p className="italic text-foreground-dim">
                    No repository overview explanation generated yet. Explanations will appear here once connected to the AI client.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Structure */}
      {activeTab === 'structure' && (
        <>
          {/* 1. RESTING STATE: When nothing is selected */}
          {!selectedId && (
            <div className="flex flex-1 flex-col overflow-y-auto p-3 space-y-4">
              {/* Repository Header Summary */}
              <div className="rounded border border-border bg-surface-raised/40 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground truncate">{repoName}</div>
                  <span className="rounded bg-accent/15 border border-accent/30 px-1.5 py-0.2 text-[9px] font-semibold text-accent uppercase">
                    Repository
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-foreground-dim border-t border-border-subtle pt-2">
                  <span>Framework detected:</span>
                  <span className="font-medium text-foreground">{repoSummary.framework}</span>
                </div>

                {/* Counts of files, imports and routes */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-center text-[10px]">
                  <div className="bg-surface rounded p-1.5 border border-border-subtle">
                    <div className="text-foreground-dim text-[9px]">FILES</div>
                    <div className="font-bold text-foreground text-xs mt-0.5">{files.length}</div>
                  </div>
                  <div className="bg-surface rounded p-1.5 border border-border-subtle">
                    <div className="text-foreground-dim text-[9px]">IMPORTS</div>
                    <div className="font-bold text-foreground text-xs mt-0.5">{edges.length}</div>
                  </div>
                  <div className="bg-surface rounded p-1.5 border border-border-subtle">
                    <div className="text-foreground-dim text-[9px]">ROUTES</div>
                    <div className="font-bold text-foreground text-xs mt-0.5">{repoSummary.routesCount}</div>
                  </div>
                </div>

                {/* Count of files no convention could identify */}
                <div className="flex items-center justify-between rounded bg-surface px-2 py-1 text-[10px] border border-border-subtle">
                  <span className="text-foreground-dim">Unidentified by convention:</span>
                  <span className="font-semibold text-foreground">{repoSummary.unidentifiedCount} files</span>
                </div>
              </div>

              {/* Ranked List 1: What the rest of the repository leans on most */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-foreground mb-1.5">
                  <span className="text-incoming flex items-center gap-1">
                    <span>↓</span>
                    <span>Most Depended On ({repoSummary.mostDependedOn.length})</span>
                  </span>
                  <span className="text-[9px] text-foreground-dim">by imports</span>
                </div>

                <div className="space-y-1">
                  {repoSummary.mostDependedOn.slice(0, 15).map((file) => {
                    const isHovered = hoveredId === file.path;
                    const cat = getFileCategory(file);

                    return (
                      <div
                        key={file.path}
                        onClick={() => onSelect(file.path)}
                        onMouseEnter={() => onHover?.(file.path)}
                        onMouseLeave={() => onHover?.(null)}
                        className={`flex items-center justify-between rounded p-1.5 text-[11px] cursor-pointer transition-colors border ${
                          isHovered
                            ? 'bg-accent/20 border-accent ring-1 ring-accent text-foreground'
                            : 'bg-surface hover:bg-surface-hover border-border-subtle text-foreground'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                              title={cat.name}
                            />
                            <span className="font-medium text-foreground truncate">{file.name}</span>
                          </div>
                          <div className="text-[9px] text-foreground-dim truncate ml-3">{file.path}</div>
                        </div>

                        <span className="rounded bg-incoming/15 text-incoming text-[9px] font-semibold px-1 py-0.2 shrink-0">
                          {file.fanIn} deps
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ranked List 2: The files nothing imports at all (where reading starts) */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-foreground mb-1.5">
                  <span className="text-outgoing flex items-center gap-1">
                    <span>↑</span>
                    <span>Where Reading Starts ({repoSummary.readingStarts.length})</span>
                  </span>
                  <span className="text-[9px] text-foreground-dim">0 dependents</span>
                </div>

                <div className="space-y-1">
                  {repoSummary.readingStarts.slice(0, 15).map((file) => {
                    const isHovered = hoveredId === file.path;
                    const cat = getFileCategory(file);

                    return (
                      <div
                        key={file.path}
                        onClick={() => onSelect(file.path)}
                        onMouseEnter={() => onHover?.(file.path)}
                        onMouseLeave={() => onHover?.(null)}
                        className={`flex items-center justify-between rounded p-1.5 text-[11px] cursor-pointer transition-colors border ${
                          isHovered
                            ? 'bg-accent/20 border-accent ring-1 ring-accent text-foreground'
                            : 'bg-surface hover:bg-surface-hover border-border-subtle text-foreground'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                              title={cat.name}
                            />
                            <span className="font-medium text-foreground truncate">{file.name}</span>
                          </div>
                          <div className="text-[9px] text-foreground-dim truncate ml-3">{file.path}</div>
                        </div>

                        <span className="rounded bg-outgoing/15 text-outgoing text-[9px] font-semibold px-1 py-0.2 shrink-0">
                          {file.fanOut} imp
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. FOLDER SELECTED VIEW */}
          {selectedFolder && (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Folder Header */}
              <div className="border-b border-border bg-surface-raised/50 p-3 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-accent/15 border border-accent/30 px-1.5 py-0.5 text-[9px] font-semibold text-accent uppercase">
                    Folded Module
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelect(null)}
                    className="text-[10px] text-foreground-dim hover:text-foreground cursor-pointer"
                  >
                    clear (Esc)
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="truncate">
                    <div className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                      <span>📁</span>
                      <span>{selectedFolder.label}</span>
                    </div>
                    <div className="text-[10px] text-foreground-dim truncate mt-0.5">
                      path: {selectedFolder.folder}
                    </div>
                  </div>

                  {onOpenFolder && (
                    <button
                      type="button"
                      onClick={() => onOpenFolder(selectedFolder.id)}
                      className="shrink-0 rounded bg-surface hover:bg-surface-hover border border-border px-2 py-1 text-[10px] font-medium text-foreground transition-colors cursor-pointer hover:border-accent"
                    >
                      {openNodeIds?.has(selectedFolder.id) ? 'View Panel' : '+ Expand'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border-subtle text-center text-[10px]">
                  <div className="bg-surface rounded p-1 border border-border-subtle">
                    <div className="text-foreground-dim text-[9px]">FILES</div>
                    <div className="font-semibold text-foreground">{selectedFolder.files.length}</div>
                  </div>
                  <div className="bg-surface rounded p-1 border border-border-subtle">
                    <div className="text-incoming text-[9px]">EXPORTS</div>
                    <div className="font-semibold text-incoming">{folderDeps.folderDependents.length}</div>
                  </div>
                  <div className="bg-surface rounded p-1 border border-border-subtle">
                    <div className="text-outgoing text-[9px]">IMPORTS</div>
                    <div className="font-semibold text-outgoing">{folderDeps.folderDependencies.length}</div>
                  </div>
                </div>
              </div>

              {/* Scrollable Contents */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* What kind of files are inside it and how many of each */}
                <div>
                  <div className="text-[11px] font-semibold text-foreground mb-1.5">
                    File Kinds in Module ({folderDeps.categoryBreakdown.length})
                  </div>
                  <div className="space-y-1">
                    {folderDeps.categoryBreakdown.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between rounded p-1.5 text-[11px] bg-surface border border-border-subtle"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-xs shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-foreground font-mono">{cat.name}</span>
                        </div>
                        <span className="tabular-nums font-semibold text-foreground">
                          {cat.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* External Dependents */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-foreground mb-1.5">
                    <span className="text-incoming flex items-center gap-1">
                      <span>↓</span>
                      <span>Exported To ({folderDeps.folderDependents.length} files)</span>
                    </span>
                  </div>
                  {folderDeps.folderDependents.length === 0 ? (
                    <div className="text-[10px] text-foreground-dim italic p-1.5 bg-surface-raised/20 rounded">
                      No external files depend on this module.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {folderDeps.folderDependents.map(({ file, count }) => {
                        const isHovered = hoveredId === file.path;
                        return (
                          <div
                            key={file.path}
                            onClick={() => onSelect(file.path)}
                            onMouseEnter={() => onHover?.(file.path)}
                            onMouseLeave={() => onHover?.(null)}
                            className={`flex items-center justify-between rounded p-1.5 text-[11px] cursor-pointer transition-colors border ${
                              isHovered
                                ? 'bg-accent/20 border-accent ring-1 ring-accent text-foreground'
                                : 'bg-surface hover:bg-surface-hover border-border-subtle text-foreground'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="text-foreground font-medium truncate">{file.name}</div>
                              <div className="text-[9px] text-foreground-dim truncate">{file.path}</div>
                            </div>
                            <span className="rounded bg-incoming/15 text-incoming text-[9px] font-semibold px-1 py-0.2 shrink-0">
                              {count}x
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* External Dependencies */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-foreground mb-1.5">
                    <span className="text-outgoing flex items-center gap-1">
                      <span>↑</span>
                      <span>Imports ({folderDeps.folderDependencies.length} files)</span>
                    </span>
                  </div>
                  {folderDeps.folderDependencies.length === 0 ? (
                    <div className="text-[10px] text-foreground-dim italic p-1.5 bg-surface-raised/20 rounded">
                      This module does not import external files.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {folderDeps.folderDependencies.map(({ file, count }) => {
                        const isHovered = hoveredId === file.path;
                        return (
                          <div
                            key={file.path}
                            onClick={() => onSelect(file.path)}
                            onMouseEnter={() => onHover?.(file.path)}
                            onMouseLeave={() => onHover?.(null)}
                            className={`flex items-center justify-between rounded p-1.5 text-[11px] cursor-pointer transition-colors border ${
                              isHovered
                                ? 'bg-accent/20 border-accent ring-1 ring-accent text-foreground'
                                : 'bg-surface hover:bg-surface-hover border-border-subtle text-foreground'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="text-foreground font-medium truncate">{file.name}</div>
                              <div className="text-[9px] text-foreground-dim truncate">{file.path}</div>
                            </div>
                            <span className="rounded bg-outgoing/15 text-outgoing text-[9px] font-semibold px-1 py-0.2 shrink-0">
                              {count}x
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Files Inside Folder */}
                <div>
                  <div className="text-[11px] font-semibold text-foreground mb-1.5">
                    Files in Module ({selectedFolder.files.length})
                  </div>
                  <div className="space-y-1">
                    {selectedFolder.files.map((file) => {
                      const isHovered = hoveredId === file.path;
                      const cat = getFileCategory(file);
                      return (
                        <div
                          key={file.path}
                          onClick={() => onSelect(file.path)}
                          onMouseEnter={() => onHover?.(file.path)}
                          onMouseLeave={() => onHover?.(null)}
                          className={`flex items-center justify-between rounded p-1.5 text-[11px] cursor-pointer transition-colors border ${
                            isHovered
                              ? 'bg-accent/20 border-accent ring-1 ring-accent text-foreground'
                              : 'bg-surface hover:bg-surface-hover border-border-subtle text-foreground'
                          }`}
                        >
                          <div className="truncate pr-2 flex items-center gap-1.5">
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color }}
                              title={cat.name}
                            />
                            <span className="truncate font-medium text-foreground">{file.name}</span>
                          </div>
                          <span className="text-[10px] text-foreground-dim tabular-nums shrink-0">
                            {file.lines}L
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. FILE SELECTED VIEW */}
          {selectedFile && (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Header Summary */}
              <div className="border-b border-border bg-surface-raised/50 p-3 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {selectedCategory && (
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase border"
                        style={{
                          backgroundColor: `${selectedCategory.color}15`,
                          borderColor: `${selectedCategory.color}40`,
                          color: selectedCategory.color,
                        }}
                      >
                        {selectedCategory.name}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(null)}
                    className="text-[10px] text-foreground-dim hover:text-foreground cursor-pointer"
                  >
                    clear (Esc)
                  </button>
                </div>

                <div>
                  <div className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                    <span>📄</span>
                    <span>{selectedFile.name}</span>
                  </div>
                  <div className="text-[10px] text-foreground-dim truncate mt-0.5 select-all">
                    {selectedFile.path}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border-subtle text-[10px]">
                  <span className="text-foreground-muted">Length:</span>
                  <span className="text-foreground font-semibold">
                    {selectedFile.lines} lines{' '}
                    <span className="text-foreground-dim font-normal">
                      ({(selectedFile.bytes / 1024).toFixed(1)} KB)
                    </span>
                  </span>
                </div>

                {/* Parent Folder navigation */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-foreground-muted">Module:</span>
                  {(() => {
                    const parentFolderId = fileToNodeMap.get(selectedFile.path) || '.';
                    const parentFolderNode = foldedNodes.find((n) => n.id === parentFolderId);
                    return parentFolderNode ? (
                      <button
                        type="button"
                        onClick={() => onSelect(parentFolderNode.id)}
                        className="text-accent hover:underline font-medium cursor-pointer"
                      >
                        📁 {parentFolderNode.label}
                      </button>
                    ) : (
                      <span className="text-foreground">root</span>
                    );
                  })()}
                </div>

                {/* Metrics Grid: Lines, Dependents (fanIn), Dependencies (fanOut) */}
                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border-subtle text-center text-[10px]">
                  <div className="bg-surface rounded p-1 border border-border-subtle">
                    <div className="text-foreground-dim text-[9px]">LINES</div>
                    <div className="font-semibold text-foreground">{selectedFile.lines}</div>
                  </div>
                  <div className="bg-surface rounded p-1 border border-border-subtle">
                    <div className="text-incoming text-[9px]">DEPENDENTS</div>
                    <div className="font-semibold text-incoming">{fileDeps.dependents.length}</div>
                  </div>
                  <div className="bg-surface rounded p-1 border border-border-subtle">
                    <div className="text-outgoing text-[9px]">DEPENDENCIES</div>
                    <div className="font-semibold text-outgoing">{fileDeps.dependencies.length}</div>
                  </div>
                </div>
              </div>

              {/* Scrollable Dependencies & Dependents */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Files that Depend on this file (Incoming) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-foreground mb-1.5">
                    <span className="text-incoming flex items-center gap-1">
                      <span>↓</span>
                      <span>Dependents ({fileDeps.dependents.length})</span>
                    </span>
                  </div>
                  {fileDeps.dependents.length === 0 ? (
                    <div className="text-[10px] text-foreground-dim italic p-1.5 bg-surface-raised/20 rounded">
                      No files import this file (reading entry point).
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {fileDeps.dependents.map((file) => {
                        const isHovered = hoveredId === file.path;
                        const cat = getFileCategory(file);

                        return (
                          <div
                            key={file.path}
                            onClick={() => onSelect(file.path)}
                            onMouseEnter={() => onHover?.(file.path)}
                            onMouseLeave={() => onHover?.(null)}
                            className={`flex items-center justify-between rounded p-1.5 text-[11px] cursor-pointer transition-colors border ${
                              isHovered
                                ? 'bg-accent/20 border-accent ring-1 ring-accent text-foreground'
                                : 'bg-surface hover:bg-surface-hover border-border-subtle text-foreground'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="flex items-center gap-1.5 truncate">
                                <span
                                  className="h-1.5 w-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: cat.color }}
                                  title={cat.name}
                                />
                                <span className="text-foreground font-medium truncate">{file.name}</span>
                              </div>
                              <div className="text-[9px] text-foreground-dim truncate ml-3">{file.path}</div>
                            </div>
                            <span className="text-[10px] text-foreground-dim tabular-nums shrink-0">
                              {file.lines}L
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Files this file Depends on (Outgoing) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-foreground mb-1.5">
                    <span className="text-outgoing flex items-center gap-1">
                      <span>↑</span>
                      <span>Dependencies ({fileDeps.dependencies.length})</span>
                    </span>
                  </div>
                  {fileDeps.dependencies.length === 0 ? (
                    <div className="text-[10px] text-foreground-dim italic p-1.5 bg-surface-raised/20 rounded">
                      This file imports no local files (leaf module).
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {fileDeps.dependencies.map((file) => {
                        const isHovered = hoveredId === file.path;
                        const cat = getFileCategory(file);

                        return (
                          <div
                            key={file.path}
                            onClick={() => onSelect(file.path)}
                            onMouseEnter={() => onHover?.(file.path)}
                            onMouseLeave={() => onHover?.(null)}
                            className={`flex items-center justify-between rounded p-1.5 text-[11px] cursor-pointer transition-colors border ${
                              isHovered
                                ? 'bg-accent/20 border-accent ring-1 ring-accent text-foreground'
                                : 'bg-surface hover:bg-surface-hover border-border-subtle text-foreground'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="flex items-center gap-1.5 truncate">
                                <span
                                  className="h-1.5 w-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: cat.color }}
                                  title={cat.name}
                                />
                                <span className="text-foreground font-medium truncate">{file.name}</span>
                              </div>
                              <div className="text-[9px] text-foreground-dim truncate ml-3">{file.path}</div>
                            </div>
                            <span className="text-[10px] text-foreground-dim tabular-nums shrink-0">
                              {file.lines}L
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

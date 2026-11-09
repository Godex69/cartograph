'use client';

import { Analysis, AnalysisStatus } from '@/lib/types';
import { useState } from 'react';

interface DashboardProps {
  analyses: Analysis[];
  organizationName: string;
}

function StatusBadge({ status }: { status: AnalysisStatus }) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-incoming/30 bg-incoming/10 px-2 py-0.5 font-mono text-[11px] font-medium text-incoming">
          <span className="h-1.5 w-1.5 rounded-full bg-incoming" />
          completed
        </span>
      );
    case 'parsing':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-medium text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          parsing
        </span>
      );
    case 'cloning':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[11px] font-medium text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          cloning
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-rose-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          failed
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-border bg-surface-raised px-2 py-0.5 font-mono text-[11px] font-medium text-foreground-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-foreground-dim" />
          pending
        </span>
      );
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toISOString().split('T')[0];
  } catch {
    return dateString;
  }
}

function extractRepoName(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return url;
  } catch {
    return url;
  }
}

export function Dashboard({ analyses, organizationName }: DashboardProps) {
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  if (analyses.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 select-none">
        <div className="max-w-md w-full rounded border border-border bg-surface p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded border border-border bg-surface-raised font-mono text-base text-foreground-muted">
            ∅
          </div>
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
            No analyses found
          </h2>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-foreground-muted">
            <span className="text-foreground font-medium">{organizationName}</span> has never run a repository analysis.
          </p>
          <div className="mt-4 rounded border border-dashed border-border-subtle bg-surface-raised/40 p-3 text-left font-mono text-[10px] text-foreground-dim leading-relaxed">
            <div>• Database policies are enforcing workspace isolation via auth token claims.</div>
            <div>• Seeded runs for other teams are prevented from appearing in this workspace.</div>
            <div>• Real repository ingestion pipeline will connect to this view in subsequent phases.</div>
          </div>
        </div>
      </div>
    );
  }

  const completedCount = analyses.filter((a) => a.status === 'completed').length;
  const inProgressCount = analyses.filter((a) => a.status === 'parsing' || a.status === 'cloning' || a.status === 'pending').length;
  const failedCount = analyses.filter((a) => a.status === 'failed').length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Top statistics summary bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-surface/50 px-4 font-mono text-xs">
        <div className="flex items-center gap-4">
          <span className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
            Analyses ({analyses.length})
          </span>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-foreground-muted">
              completed: <strong className="text-incoming font-medium">{completedCount}</strong>
            </span>
            {inProgressCount > 0 && (
              <span className="text-foreground-muted">
                in progress: <strong className="text-accent font-medium">{inProgressCount}</strong>
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-foreground-muted">
                failed: <strong className="text-rose-400 font-medium">{failedCount}</strong>
              </span>
            )}
          </div>
        </div>
        <div className="text-[10px] text-foreground-dim">
          Database tenant RLS enforced
        </div>
      </div>

      {/* Main analyses list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="overflow-hidden rounded border border-border bg-surface">
          <table className="w-full border-collapse text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-raised/60 text-[10px] font-medium text-foreground-muted uppercase tracking-wider">
                <th className="py-2 px-3">Repository</th>
                <th className="py-2 px-3">Branch / Ref</th>
                <th className="py-2 px-3">State</th>
                <th className="py-2 px-3">Parsed Metrics</th>
                <th className="py-2 px-3 text-right">Run Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {analyses.map((analysis) => {
                const repoName = extractRepoName(analysis.repository_url);
                const hasError = Boolean(analysis.error_message);
                const isErrorExpanded = expandedErrorId === analysis.id;

                return (
                  <tr
                    key={analysis.id}
                    className="group hover:bg-surface-hover/60 transition-colors"
                  >
                    {/* Repository column */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground hover:text-accent">
                          {repoName}
                        </span>
                        {analysis.summary?.framework && (
                          <span className="rounded bg-surface-raised px-1.5 py-0.2 text-[9px] font-mono text-foreground-dim border border-border-subtle">
                            {analysis.summary.framework}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-foreground-dim truncate max-w-xs">
                        {analysis.repository_url}
                      </div>
                      {/* Optional inline error toggle */}
                      {hasError && (
                        <div className="mt-1">
                          <button
                            onClick={() => setExpandedErrorId(isErrorExpanded ? null : analysis.id)}
                            className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                          >
                            {isErrorExpanded ? 'hide error log' : 'show error log'}
                          </button>
                          {isErrorExpanded && (
                            <div className="mt-1.5 rounded border border-rose-500/20 bg-rose-500/5 p-2 font-mono text-[10px] text-rose-300 whitespace-pre-wrap leading-relaxed">
                              {analysis.error_message}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Branch / Commit */}
                    <td className="py-2.5 px-3 text-[11px] text-foreground-muted whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground">{analysis.branch}</span>
                        {analysis.commit_hash && (
                          <span className="rounded bg-surface-raised px-1 py-0.2 text-[10px] font-mono text-foreground-dim border border-border-subtle">
                            {analysis.commit_hash.slice(0, 7)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* State badge */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge status={analysis.status} />
                    </td>

                    {/* Summary metrics */}
                    <td className="py-2.5 px-3 text-[11px] text-foreground-muted whitespace-nowrap">
                      {analysis.summary && (analysis.summary.files_count !== undefined || analysis.summary.edges_count !== undefined) ? (
                        <div className="flex items-center gap-2">
                          {analysis.summary.files_count !== undefined && (
                            <span>
                              <strong className="text-foreground font-medium">
                                {analysis.summary.files_count.toLocaleString()}
                              </strong>{' '}
                              files
                            </span>
                          )}
                          {analysis.summary.edges_count !== undefined && (
                            <>
                              <span className="text-foreground-dim">·</span>
                              <span>
                                <strong className="text-foreground font-medium">
                                  {analysis.summary.edges_count.toLocaleString()}
                                </strong>{' '}
                                edges
                              </span>
                            </>
                          )}
                          {analysis.summary.coverage_percentage !== undefined && (
                            <>
                              <span className="text-foreground-dim">·</span>
                              <span className="text-incoming">
                                {analysis.summary.coverage_percentage}% cov
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-foreground-dim text-[10px]">
                          {analysis.status === 'pending' ? 'awaiting parser' : 'no metrics recorded'}
                        </span>
                      )}
                    </td>

                    {/* Created at / timestamp */}
                    <td className="py-2.5 px-3 text-right text-[11px] text-foreground-dim whitespace-nowrap">
                      {formatRelativeTime(analysis.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

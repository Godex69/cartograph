'use client';

import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { ThemeToggle } from './theme-toggle';
import { InviteModal } from './invite-modal';
import { OrgSync } from './org-sync';
import { Dashboard } from './dashboard';
import { Analysis } from '@/lib/types';

export interface ActiveOrganizationData {
  id: string;
  name: string;
  slug: string | null;
  role: string | null;
  membersCount?: number;
}

interface AppShellProps {
  organization: ActiveOrganizationData;
  userEmail?: string | null;
  analyses: Analysis[];
}

export function AppShell({ organization, userEmail, analyses }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground antialiased selection:bg-accent/20">
      {/* Background session sync */}
      <OrgSync targetOrgId={organization.id} />

      {/* Primary Top Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-3">
        {/* Left: Brand + Org Context */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-wider text-foreground">
              CARTOGRAPH
            </span>
            <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-foreground-muted border border-border-subtle">
              v0.1.0
            </span>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Server-Rendered Active Organization Information */}
          <div
            data-testid="current-org-display"
            className="flex items-center gap-2 font-mono text-xs"
          >
            <span className="text-foreground-muted text-[11px]">team:</span>
            <span className="font-semibold text-foreground">{organization.name}</span>
            {organization.slug && (
              <span className="text-foreground-dim text-[11px]">({organization.slug})</span>
            )}
            <span className="rounded bg-accent/10 px-1.5 py-0.2 text-[10px] font-medium text-accent border border-accent/20">
              {organization.role ?? 'member'}
            </span>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Org Switcher & Inviter */}
          <div className="flex items-center gap-2">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/"
              afterCreateOrganizationUrl="/"
              appearance={{
                elements: {
                  rootBox: 'flex items-center',
                  organizationSwitcherTrigger:
                    'h-7 px-2.5 text-xs font-mono rounded border border-border bg-surface-raised text-foreground hover:bg-surface-hover hover:border-border transition-colors focus:outline-hidden',
                  organizationPreviewTextContainer: 'font-mono text-xs',
                },
              }}
            />
            <InviteModal organizationName={organization.name} />
          </div>
        </div>

        {/* Right: Theme Toggle + User Button */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            {userEmail && (
              <span className="hidden font-mono text-[11px] text-foreground-muted sm:inline-block">
                {userEmail}
              </span>
            )}
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: 'h-6 w-6 rounded border border-border',
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Developer Interface Grid / Panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel 1: Left Explorer / File Tree */}
        <aside className="w-64 shrink-0 flex flex-col border-r border-border bg-surface font-mono text-xs select-none">
          <div className="flex h-8 items-center justify-between border-b border-border px-3 text-[11px] font-medium text-foreground-muted">
            <span>REPOSITORY FILES</span>
            <span className="text-[10px] text-foreground-dim">AST</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 text-foreground-muted">
            <div className="rounded border border-dashed border-border p-3 text-center text-[11px] leading-relaxed">
              No repository loaded yet.
              <div className="mt-1 text-[10px] text-foreground-dim">
                Phase 3 parses AST imports and edges from public repositories.
              </div>
            </div>
          </div>
        </aside>

        {/* Panel 2: Center Map Canvas / Analyses Dashboard */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-background">
          <Dashboard analyses={analyses} organizationName={organization.name} />

          {/* Panel 4: Bottom Collapsible Query / Trace Panel */}
          <div className="h-24 border-t border-border bg-surface px-3 py-2 flex flex-col justify-between font-mono text-xs shrink-0">
            <div className="flex items-center justify-between text-[11px] text-foreground-muted">
              <span>REPOSITORY QUERY / AGENT TRACE</span>
              <span className="text-[10px] text-foreground-dim">Verification: Strict AST match</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                disabled
                placeholder="Ask what depends on a file or trace blast radius... (Coming in later phase)"
                className="flex-1 rounded border border-border bg-surface-raised px-3 py-1.5 text-xs text-foreground placeholder:text-foreground-dim focus:outline-hidden disabled:cursor-not-allowed"
              />
              <button
                disabled
                className="rounded border border-border bg-surface-raised px-3 py-1.5 text-xs text-foreground-dim disabled:opacity-60"
              >
                Inspect
              </button>
            </div>
          </div>
        </main>

        {/* Panel 3: Right Inspector Panel */}
        <aside className="w-72 shrink-0 flex flex-col border-l border-border bg-surface font-mono text-xs select-none">
          <div className="flex h-8 items-center justify-between border-b border-border px-3 text-[11px] font-medium text-foreground-muted">
            <span>FILE INSPECTOR</span>
            <span className="text-[10px] text-foreground-dim">METRICS</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4 text-foreground-muted">
            <div className="rounded border border-border-subtle bg-surface-raised p-2.5">
              <div className="text-[10px] text-foreground-dim uppercase tracking-wider">
                Current Organization
              </div>
              <div className="mt-1 font-medium text-foreground text-xs">{organization.name}</div>
              <div className="mt-0.5 text-[10px] text-foreground-muted break-all">
                ID: {organization.id}
              </div>
            </div>

            <div className="rounded border border-border-subtle bg-surface-raised p-2.5">
              <div className="text-[10px] text-foreground-dim uppercase tracking-wider">
                Workspace Status
              </div>
              <div className="mt-2 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Analyses:</span>
                  <span className="text-foreground font-medium">{analyses.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Security:</span>
                  <span className="text-incoming font-medium">RLS Enforced</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Isolation:</span>
                  <span className="text-foreground font-medium">Token Claims</span>
                </div>
              </div>
            </div>

            <div className="rounded border border-border-subtle bg-surface-raised p-2.5">
              <div className="text-[10px] text-foreground-dim uppercase tracking-wider">
                Graph Arithmetic
              </div>
              <div className="mt-2 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-incoming">Incoming (Fan-in):</span>
                  <span className="text-foreground">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outgoing">Outgoing (Fan-out):</span>
                  <span className="text-foreground">0</span>
                </div>
                <div className="flex justify-between">
                  <span>Blast Radius:</span>
                  <span className="text-foreground">0 levels</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

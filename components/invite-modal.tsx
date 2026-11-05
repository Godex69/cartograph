'use client';

import { useState, useTransition } from 'react';
import { inviteMemberAction, InviteResult } from '@/app/actions/invite';

interface InviteModalProps {
  organizationName: string;
}

export function InviteModal({ organizationName }: InviteModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await inviteMemberAction(null, formData);
      setResult(res);
      if (res.success) {
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded border border-border bg-surface text-foreground hover:bg-surface-hover hover:border-border transition-colors select-none"
      >
        <span className="text-accent">+</span> invite
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div
            className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-2xl text-foreground font-sans animate-in fade-in-0 zoom-in-95 duration-100"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Invite Teammate</h3>
                <p className="text-xs text-foreground-muted font-mono mt-0.5">
                  to {organizationName}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-foreground-muted hover:text-foreground text-base px-1.5 py-0.5 rounded font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email-input"
                  className="block text-xs font-mono text-foreground-muted mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="email-input"
                  type="email"
                  name="email"
                  required
                  placeholder="colleague@company.com"
                  className="w-full rounded border border-border bg-surface-raised px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-foreground-dim focus:outline-hidden focus:border-accent"
                />
              </div>

              <div className="rounded bg-surface-raised p-2.5 text-[11px] font-mono text-foreground-muted border border-border-subtle">
                Accepting this invitation will direct them to the Cartograph sign-in page, landing them straight into this team workspace.
              </div>

              {result?.error && (
                <div className="rounded border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400 font-mono">
                  {result.error}
                </div>
              )}

              {result?.success && (
                <div className="rounded border border-incoming/30 bg-incoming/10 p-2.5 text-xs text-incoming font-mono">
                  ✓ Invitation sent to {result.email}!
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 py-1.5 text-xs font-mono rounded border border-border bg-surface hover:bg-surface-hover text-foreground-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs font-mono font-medium rounded bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

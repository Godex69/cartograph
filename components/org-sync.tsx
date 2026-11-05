'use client';

import { useClerk, useAuth } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface OrgSyncProps {
  targetOrgId?: string | null;
}

/**
 * Ensures the user's active session token is synchronized with their organization.
 * When a user signs in for the first time or joins a team, this syncs the active
 * org claim into the session token without prompting the user.
 */
export function OrgSync({ targetOrgId }: OrgSyncProps) {
  const { orgId, isLoaded } = useAuth();
  const { setActive } = useClerk();
  const router = useRouter();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || attemptedRef.current) return;
    if (targetOrgId && orgId !== targetOrgId && setActive) {
      attemptedRef.current = true;
      setActive({ organization: targetOrgId }).then(() => {
        router.refresh();
      }).catch((err) => {
        console.warn('[Cartograph] Auto-activating organization error:', err);
      });
    }
  }, [isLoaded, orgId, targetOrgId, setActive, router]);

  return null;
}

import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { AppShell, ActiveOrganizationData } from '@/components/app-shell';
import { createAuthenticatedSupabaseClient } from '@/lib/supabase';
import { Analysis } from '@/lib/types';
import { Suspense } from 'react';

async function WorkspaceContent() {
  // Defense-in-depth resource protection
  const authData = await auth.protect();
  const userId = authData.userId;
  let activeOrgId = authData.orgId;
  let activeOrgRole = authData.orgRole;

  const clerk = await clerkClient();
  const user = await currentUser();

  // If no active organization in the session token:
  // Auto-discover existing membership or auto-create one so user is never prompted
  if (!activeOrgId) {
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId,
      limit: 1,
    });

    if (memberships.totalCount > 0 && memberships.data[0]) {
      const primaryMembership = memberships.data[0];
      activeOrgId = primaryMembership.organization.id;
      activeOrgRole = primaryMembership.role;
    } else {
      // Auto-create organization for first-time sign-in
      const orgName = user?.firstName
        ? `${user.firstName}'s Workspace`
        : user?.username
        ? `${user.username}'s Workspace`
        : 'Primary Workspace';

      const newOrg = await clerk.organizations.createOrganization({
        name: orgName,
        createdBy: userId,
      });

      activeOrgId = newOrg.id;
      activeOrgRole = 'org:admin';
    }
  }

  // Read organization details on the server during server rendering
  const organization = await clerk.organizations.getOrganization({
    organizationId: activeOrgId,
  });

  const orgData: ActiveOrganizationData = {
    id: organization.id,
    name: organization.name,
    slug: organization.slug ?? null,
    role: activeOrgRole ?? null,
    membersCount: organization.membersCount,
  };

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? null;

  // Database access happens in server code, not inside components.
  // The client carries the signed-in token with every request.
  // Authorization is a property of the database (RLS), not a check in application code.
  // CRITICAL CONSTRAINT: We do NOT filter by organization in application code!
  const supabase = await createAuthenticatedSupabaseClient();

  // Ensure current organization exists in the database organizations table
  try {
    await supabase.from('organizations').upsert(
      {
        id: organization.id,
        name: organization.name,
        slug: organization.slug ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch {
    // Non-fatal if already present or restricted
  }

  const { data: analysesData, error } = await supabase
    .from('analyses')
    .select('id, organization_id, project_id, repository_url, branch, commit_hash, status, error_message, summary, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error querying analyses from Supabase:', error);
  }

  const analyses: Analysis[] = (analysesData as Analysis[]) ?? [];

  return <AppShell organization={orgData} userEmail={userEmail} analyses={analyses} />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground-muted font-mono text-xs">
          loading workspace...
        </div>
      }
    >
      <WorkspaceContent />
    </Suspense>
  );
}

import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { AppShell, ActiveOrganizationData } from '@/components/app-shell';
import { Suspense } from 'react';

async function WorkspaceContent() {
  // Defense-in-depth resource protection
  const authData = await auth.protect();
  const userId = authData.userId;
  let activeOrgId = authData.orgId;
  let activeOrgRole = authData.orgRole;
  let activeOrgSlug = authData.orgSlug;

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
      activeOrgSlug = primaryMembership.organization.slug;
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
      activeOrgSlug = newOrg.slug;
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

  return <AppShell organization={orgData} userEmail={userEmail} />;
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

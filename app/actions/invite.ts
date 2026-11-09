'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { headers } from 'next/headers';

export interface InviteResult {
  success: boolean;
  error?: string;
  invitationId?: string;
  email?: string;
}

export async function inviteMemberAction(prevState: InviteResult | null, formData: FormData): Promise<InviteResult> {
  const email = formData.get('email')?.toString().trim();
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const { userId, orgId, has } = await auth();
  if (!userId || !orgId) {
    return { success: false, error: 'No active organization found.' };
  }

  // Inviting requires admin role
  if (!has({ role: 'org:admin' })) {
    return { success: false, error: 'Only organization admins can invite members.' };
  }

  const headerList = await headers();
  const host = headerList.get('host') || 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') || 'http';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

  try {
    const clerk = await clerkClient();
    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: orgId,
      inviterUserId: userId,
      emailAddress: email,
      role: 'org:member',
      redirectUrl: `${appUrl}/sign-in`,
    });

    return {
      success: true,
      invitationId: invitation.id,
      email: invitation.emailAddress,
    };
  } catch (err: unknown) {
    const errorObj = err as { errors?: Array<{ message?: string }>; message?: string };
    const message =
      errorObj?.errors?.[0]?.message ||
      errorObj?.message ||
      'Failed to send invitation. Check if member is already invited.';
    return {
      success: false,
      error: message,
    };
  }
}

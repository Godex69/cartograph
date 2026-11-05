import { auth } from '@clerk/nextjs/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * Creates a server-side Supabase client authenticated with the user's Clerk session token.
 * 
 * In accordance with Phase 1 constraints:
 * - One session system: Clerk owns sessions and tokens; no secondary cookie session is used.
 * - The database client carries the signed-in token with every request so RLS policies
 *   can read the user and organization claims.
 */
export async function createAuthenticatedSupabaseClient(): Promise<SupabaseClient> {
  const { getToken } = await auth();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      accessToken: async () => {
        try {
          const token = await getToken({ template: 'supabase' });
          if (token) return token;
        } catch {
          // Fall back if custom supabase template is not configured
        }
        const token = await getToken();
        return token ?? null;
      },
    }
  );
}

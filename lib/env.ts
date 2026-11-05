/**
 * Validates and exposes application environment variables.
 * Fails loudly at startup if any required variable is missing or blank.
 */

function getEnv(key: string, isPublic = false): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `\n\n❌ [STARTUP FAILURE] Missing required environment variable: ${key}\n` +
      `Check your .env.local file. Application cannot start without this value.\n`
    );
  }
  return value.trim();
}

export const env = {
  get NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY() {
    return getEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', true);
  },
  get CLERK_SECRET_KEY() {
    return getEnv('CLERK_SECRET_KEY');
  },
  get NEXT_PUBLIC_SUPABASE_URL() {
    return getEnv('NEXT_PUBLIC_SUPABASE_URL', true);
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', true);
  },
};

// Immediate loud check on module load for server environments
if (typeof window === 'undefined') {
  // Trigger getters to fail fast on boot
  void env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  void env.CLERK_SECRET_KEY;
  void env.NEXT_PUBLIC_SUPABASE_URL;
  void env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/**
 * lib/supabase.js — Shared Supabase client instances
 *
 * Two clients:
 *   - supabaseAnon    — safe to use in API routes (respects RLS)
 *   - supabaseAdmin   — service role, bypasses RLS (server-only)
 *
 * Both are lazily initialised — only created on first use.
 * Import from here rather than calling createClient() yourself.
 */

import { serverEnv } from "@/lib/env.js";

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let _anonClient = null;

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let _adminClient = null;

/**
 * Anon client — honours Row Level Security.
 * Use for most reads where RLS scoping is correct.
 *
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
export async function getSupabaseAnon() {
  if (_anonClient) {
    return _anonClient;
  }

  requireSupabase();

  const { createClient } = await import("@supabase/supabase-js");
  _anonClient = createClient(serverEnv.SUPABASE_URL, serverEnv.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  return _anonClient;
}

/**
 * Admin client — service role key, bypasses RLS.
 * Use only in server-side code where you need full access.
 *
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
export async function getSupabaseAdmin() {
  if (_adminClient) {
    return _adminClient;
  }

  requireSupabase();

  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin operations.\n" +
        "Add it to your .env.local file."
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  _adminClient = createClient(
    serverEnv.SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  return _adminClient;
}

/**
 * Throws a helpful error if Supabase credentials are not configured.
 */
function requireSupabase() {
  if (!serverEnv.SUPABASE_URL || !serverEnv.SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase is not configured.\n" +
        "Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env.local file.\n" +
        "Get a free project at https://supabase.com"
    );
  }
}

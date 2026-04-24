/**
 * Server-only Supabase admin client using the service role key.
 * Bypasses RLS — only use in Server Components or API routes (never client-side).
 *
 * Uses @supabase/ssr createServerClient with no-op cookie handlers so the
 * service role key is correctly passed as both apikey + Authorization headers,
 * matching the same auth path as the REST API.
 */
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}

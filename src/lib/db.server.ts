import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Returns the service-role client when the host provides a service key, otherwise
 * falls back to the caller's own RLS-scoped client. Admin reads/writes are allowed
 * through admin RLS policies, and privileged flows run through guarded app_* RPCs,
 * so both paths behave the same for a verified admin or for the member themselves.
 */
export async function serverDb(caller: SupabaseClient<Database>): Promise<SupabaseClient<Database>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Touch the proxy so missing env vars throw here instead of at first query.
    void supabaseAdmin.from;
    return supabaseAdmin as unknown as SupabaseClient<Database>;
  } catch {
    console.warn("[db] service key unavailable on this host — using the caller's own session");
    return caller;
  }
}

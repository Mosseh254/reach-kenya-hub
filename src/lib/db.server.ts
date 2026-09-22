import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Always uses the caller's own RLS-scoped client so every host behaves identically
 * (the production host has no service key). Admin reads/writes go through admin RLS
 * policies, and privileged flows run through guarded app_* RPCs.
 */
export async function serverDb(caller: SupabaseClient<Database>): Promise<SupabaseClient<Database>> {
  return caller;
}

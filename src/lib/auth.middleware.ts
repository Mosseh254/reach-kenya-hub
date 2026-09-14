// Project-owned auth middleware for server functions.
// Kept outside src/integrations/supabase/ so it is not overwritten by generated files.
// Verifies the caller's bearer token with getClaims(), and falls back to
// getUser() when local/JWKS claim verification is unavailable (e.g. other hosts).
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const SUPABASE_URL = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}.`;
    console.error(`[auth] ${message}`);
    throw new Error(message);
  }

  const request = getRequest();
  if (!request?.headers) throw new Error("Unauthorized: No request headers available");

  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new Error("Unauthorized: No token provided");
  if (token.split(".").length !== 3) throw new Error("Unauthorized: Invalid token");

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  // 1) Preferred: verify claims (local JWKS verification when available).
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (!error && data?.claims?.sub) {
      return next({ context: { supabase, userId: data.claims.sub as string, claims: data.claims } });
    }
    if (error) console.warn(`[auth] getClaims failed, falling back to getUser: ${error.message}`);
  } catch (err) {
    console.warn(
      `[auth] getClaims threw, falling back to getUser: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }

  // 2) Fallback: ask Supabase Auth directly (works without JWKS access).
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    console.error(`[auth] getUser verification failed: ${userError?.message ?? "no user returned"}`);
    throw new Error("Unauthorized: Invalid token");
  }

  const user = userData.user;
  return next({
    context: {
      supabase,
      userId: user.id,
      claims: {
        sub: user.id,
        email: user.email ?? undefined,
        role: user.role ?? "authenticated",
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getClaims>>["data"] extends null
        ? never
        : Record<string, unknown>,
    },
  });
});

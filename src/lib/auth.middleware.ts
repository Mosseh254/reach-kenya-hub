// Project-owned auth middleware for server functions.
// Kept outside src/integrations/supabase/ so it is not overwritten by generated files.
// Verifies the caller's bearer token with the Auth API. The verification client
// is deliberately separate from the RLS database client so API-key header
// handling can never replace the member's bearer token during verification.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type ErrorMetadata = {
  name: string;
  message: string;
  code?: string;
  status?: number;
};

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function errorMetadata(error: unknown): ErrorMetadata {
  if (error == null || typeof error !== "object") {
    return { name: typeof error, message: String(error) };
  }
  const value = error as { name?: unknown; message?: unknown; code?: unknown; status?: unknown };
  return {
    name: typeof value.name === "string" ? value.name : "Error",
    message: typeof value.message === "string" ? value.message : "Unknown error",
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value.status === "number" ? { status: value.status } : {}),
  };
}

function tokenIssuerMatchesBackend(token: string, supabaseUrl: string): boolean | null {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as { iss?: unknown };
    if (typeof payload.iss !== "string") return null;
    return new URL(payload.iss).origin === new URL(supabaseUrl).origin;
  } catch {
    return null;
  }
}

async function responseErrorMetadata(response: Response): Promise<ErrorMetadata> {
  let payload: { message?: unknown; msg?: unknown; error?: unknown; error_code?: unknown; code?: unknown } = {};
  try {
    payload = (await response.clone().json()) as typeof payload;
  } catch {
    // A non-JSON response still has useful HTTP status metadata.
  }
  const message = payload.message ?? payload.msg ?? payload.error;
  const code = payload.code ?? payload.error_code;
  return {
    name: "DatabaseResponseError",
    message: typeof message === "string" ? message : response.statusText || "Database request failed",
    ...(typeof code === "string" ? { code } : {}),
    status: response.status,
  };
}

function createAuthenticatedDatabaseFetch(supabaseKey: string, token: string, requestId: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    // Opaque API keys belong in apikey. RLS must receive the member JWT.
    if (isNewSupabaseApiKey(supabaseKey) || headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    headers.set("apikey", supabaseKey);
    try {
      const response = await fetch(input, { ...init, headers });
      if (!response.ok) {
        console.error("[auth-diagnostic] database_query_failed", {
          requestId,
          phase: "database_query",
          ...(await responseErrorMetadata(response)),
        });
      }
      return response;
    } catch (error) {
      console.error("[auth-diagnostic] database_query_threw", {
        requestId,
        phase: "database_query",
        ...errorMetadata(error),
      });
      throw error;
    }
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

  const requestId = crypto.randomUUID();
  const issuerMatchesConfiguredBackend = tokenIssuerMatchesBackend(token, SUPABASE_URL);
  console.info("[auth-diagnostic] verification_started", {
    requestId,
    method: "getUser",
    getClaims: "not_attempted",
    issuerMatchesConfiguredBackend,
  });

  // Use the SDK's standard fetch path for Auth verification. In particular,
  // do not apply the opaque-key database shim to auth.getUser(token).
  const verificationClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  let user;
  try {
    const { data, error } = await verificationClient.auth.getUser(token);
    if (error || !data.user?.id) {
      console.error("[auth-diagnostic] get_user_failed", {
        requestId,
        phase: "getUser",
        issuerMatchesConfiguredBackend,
        ...errorMetadata(error ?? new Error("No user returned")),
      });
      throw new Error("Unauthorized: Invalid token");
    }
    user = data.user;
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized: Invalid token") throw error;
    console.error("[auth-diagnostic] get_user_threw", {
      requestId,
      phase: "getUser",
      issuerMatchesConfiguredBackend,
      ...errorMetadata(error),
    });
    throw new Error("Unauthorized: Invalid token");
  }

  console.info("[auth-diagnostic] verification_succeeded", {
    requestId,
    method: "getUser",
    issuerMatchesConfiguredBackend,
  });

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createAuthenticatedDatabaseFetch(SUPABASE_PUBLISHABLE_KEY, token, requestId),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const claims: Record<string, unknown> = {
    sub: user.id,
    email: user.email ?? undefined,
    role: user.role ?? "authenticated",
  };
  try {
    return await next({ context: { supabase, userId: user.id, claims } });
  } catch (error) {
    console.error("[auth-diagnostic] downstream_server_function_failed", {
      requestId,
      phase: "after_middleware",
      ...errorMetadata(error),
    });
    throw error;
  }
});

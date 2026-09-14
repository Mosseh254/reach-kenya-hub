// Project-owned auth middleware for server functions.
// Kept outside src/integrations/supabase/ so it is not overwritten by generated files.
// Verifies the caller's bearer token with the Auth API. The verification client
// is deliberately separate from the RLS database client so API-key header
// handling can never replace the member's bearer token during verification.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
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

function tokenIssuerOrigin(token: string): string | null {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as { iss?: unknown };
    if (typeof payload.iss !== "string") return null;
    return new URL(payload.iss).origin;
  } catch {
    return null;
  }
}

type BackendCandidate = { url: string; key: string };

function configuredBackendCandidates(): BackendCandidate[] {
  const candidates = [
    { url: process.env["SUPABASE_URL"], key: process.env["SUPABASE_PUBLISHABLE_KEY"] },
    {
      url: process.env["NEXT_PUBLIC_SUPABASE_URL"],
      key: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    },
    { url: process.env["VITE_SUPABASE_URL"], key: process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] },
    {
      url: import.meta.env["VITE_SUPABASE_URL"],
      key: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
    },
  ];
  const unique = new Map<string, BackendCandidate>();
  for (const candidate of candidates) {
    if (!candidate.url || !candidate.key) continue;
    try {
      const url = new URL(candidate.url).origin;
      unique.set(`${url}\u0000${candidate.key}`, { url, key: candidate.key });
    } catch {
      // Invalid configured URLs are ignored; a safe diagnostic is emitted below if none match.
    }
  }
  return [...unique.values()];
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
  const request = getRequest();
  if (!request?.headers) throw new Error("Unauthorized: No request headers available");

  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new Error("Unauthorized: No token provided");
  if (token.split(".").length !== 3) throw new Error("Unauthorized: Invalid token");

  const requestId = crypto.randomUUID();
  const issuerOrigin = tokenIssuerOrigin(token);
  const candidates = configuredBackendCandidates();
  const matchingCandidates = issuerOrigin
    ? candidates.filter((candidate) => candidate.url === issuerOrigin)
    : [];
  console.info("[auth-diagnostic] verification_started", {
    requestId,
    method: "getUser",
    getClaims: "not_attempted",
    issuerMatchesConfiguredBackend: matchingCandidates.length > 0,
    configuredCandidateCount: candidates.length,
    matchingCandidateCount: matchingCandidates.length,
  });

  if (matchingCandidates.length === 0) {
    console.error("[auth-diagnostic] auth_configuration_mismatch", {
      requestId,
      phase: "configuration",
      issuerAvailable: issuerOrigin !== null,
      configuredCandidateCount: candidates.length,
    });
    throw new Error("Unauthorized: Invalid token");
  }

  let user: User | undefined;
  let selectedBackend: BackendCandidate | undefined;
  for (const [attemptIndex, candidate] of matchingCandidates.entries()) {
    // Use the SDK's standard fetch path for Auth verification. In particular,
    // do not apply the opaque-key database shim to auth.getUser(token).
    const verificationClient = createClient<Database>(candidate.url, candidate.key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    try {
      const { data, error } = await verificationClient.auth.getUser(token);
      if (!error && data.user?.id) {
        user = data.user;
        selectedBackend = candidate;
        break;
      }
      console.error("[auth-diagnostic] get_user_failed", {
        requestId,
        phase: "getUser",
        attempt: attemptIndex + 1,
        issuerMatchesConfiguredBackend: true,
        ...errorMetadata(error ?? new Error("No user returned")),
      });
    } catch (error) {
      console.error("[auth-diagnostic] get_user_threw", {
        requestId,
        phase: "getUser",
        attempt: attemptIndex + 1,
        issuerMatchesConfiguredBackend: true,
        ...errorMetadata(error),
      });
    }
  }

  if (!user || !selectedBackend) {
    throw new Error("Unauthorized: Invalid token");
  }

  console.info("[auth-diagnostic] verification_succeeded", {
    requestId,
    method: "getUser",
    issuerMatchesConfiguredBackend: true,
  });

  const supabase = createClient<Database>(selectedBackend.url, selectedBackend.key, {
    global: {
      fetch: createAuthenticatedDatabaseFetch(selectedBackend.key, token, requestId),
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

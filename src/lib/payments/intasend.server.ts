/**
 * IntaSend M-Pesa STK Push integration (live-capable).
 *
 * Secrets (server-only):
 *  - INTASEND_PUBLISHABLE_KEY  ISPubKey_live_... / ISPubKey_test_...
 *  - INTASEND_SECRET_KEY       ISSecretKey_live_... / ISSecretKey_test_...
 *  - INTASEND_WEBHOOK_CHALLENGE  the challenge string configured on the IntaSend webhook
 *  - INTASEND_ENV              "live" (default when keys contain _live_) or "test"
 *
 * The browser never sees these values; every call happens inside a server function
 * or a server route handler.
 */

export interface IntasendPushInput {
  phone: string; // 2547XXXXXXXX
  amountKes: number;
  apiRef: string;
  narrative: string;
}

export interface IntasendPushResult {
  invoiceId: string;
  state: string;
}

export type IntasendState = "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED" | "RETRY" | string;

export interface IntasendInvoice {
  invoice_id: string;
  state: IntasendState;
  value?: string | number;
  net_amount?: string | number;
  mpesa_reference?: string | null;
  api_ref?: string | null;
  failed_reason?: string | null;
  failed_code?: string | null;
  account?: string | null;
}

export function intasendConfigured(): boolean {
  return Boolean(process.env["INTASEND_PUBLISHABLE_KEY"] && process.env["INTASEND_SECRET_KEY"]);
}

function keys() {
  const publishable = process.env["INTASEND_PUBLISHABLE_KEY"]!;
  const secret = process.env["INTASEND_SECRET_KEY"]!;
  const env = process.env["INTASEND_ENV"] ?? (publishable.includes("_live_") ? "live" : "test");
  const baseUrl = env === "live" ? "https://payment.intasend.com/api/v1" : "https://sandbox.intasend.com/api/v1";
  return { publishable, secret, env, baseUrl };
}

/** True when the configured keys are live keys (real money moves). */
export function intasendIsLive(): boolean {
  if (!intasendConfigured()) return false;
  return keys().env === "live";
}

function headersFor() {
  const { secret, publishable } = keys();
  return {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    // IntaSend sits behind a WAF that returns "403 error code: 1106" for
    // requests without a browser-like User-Agent (edge runtime sends none).
    "User-Agent": "StatusReachKenya/1.0 (+https://reach-kenya-hub.lovable.app)",
    "Accept-Language": "en-US,en;q=0.9",
    "X-IntaSend-Public-API-Key": publishable,
  } as Record<string, string>;
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return { detail: text };
  }
}

function fail(status: number, json: unknown): never {
  const j = json as { detail?: string; errors?: { detail?: string }[] };
  throw new Error(j.errors?.[0]?.detail ?? j.detail ?? `IntaSend request failed (${status})`);
}

/**
 * Sends the request from the database instead of the app's hosting edge.
 * IntaSend's Cloudflare WAF rejects worker-to-worker subrequests with
 * "error code: 1106", so the outbound call is relayed through pg_net.
 * Credentials are passed per call and never stored in the database.
 */
async function relay<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { baseUrl } = keys();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: requestId, error } = await supabaseAdmin.rpc("relay_http_post", {
    p_url: `${baseUrl}${path}`,
    p_headers: headersFor() as never,
    p_body: body as never,
  });
  if (error || requestId == null) throw new Error(error?.message ?? "Could not reach the payment provider");

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const { data } = await supabaseAdmin.rpc("relay_http_result", { p_request_id: requestId as never });
    const res = data as { status?: number; body?: string; error?: string | null } | null;
    if (!res) continue;
    if (res.error) throw new Error(res.error);
    const json = parse(res.body ?? "");
    if (!res.status || res.status >= 400) fail(res.status ?? 500, json);
    return json as T;
  }
  throw new Error("The payment provider did not respond in time. Please try again.");
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { baseUrl } = keys();
  // Try the direct call once. Anything that looks like a network/WAF block is
  // retried through the database relay exactly once, never a real API answer,
  // so a payment prompt can never be sent twice.
  let direct: { status: number; text: string } | null = null;
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: headersFor(),
      body: JSON.stringify(body),
    });
    direct = { status: res.status, text: await res.text() };
  } catch {
    direct = null;
  }

  if (direct && !(direct.status === 403 && direct.text.includes("1106"))) {
    const json = parse(direct.text);
    if (direct.status >= 400) fail(direct.status, json);
    return json as T;
  }

  return relay<T>(path, body);
}



/** Sends the M-Pesa PIN prompt to the payer's phone. */
export async function intasendStkPush(input: IntasendPushInput): Promise<IntasendPushResult> {
  const { publishable } = keys();
  const json = await call<{ invoice?: IntasendInvoice }>("/payment/mpesa-stk-push/", {
    public_key: publishable,
    amount: input.amountKes,
    phone_number: input.phone,
    api_ref: input.apiRef,
    narrative: input.narrative.slice(0, 40),
    currency: "KES",
  });
  const invoice = json.invoice;
  if (!invoice?.invoice_id) throw new Error("IntaSend did not return an invoice id");
  return { invoiceId: invoice.invoice_id, state: invoice.state ?? "PENDING" };
}

/** Authoritative status check, used for polling and as a webhook fallback. */
export async function intasendStatus(invoiceId: string): Promise<IntasendInvoice> {
  const { publishable } = keys();
  const json = await call<{ invoice?: IntasendInvoice }>("/payment/status/", {
    public_key: publishable,
    invoice_id: invoiceId,
  });
  if (!json.invoice) throw new Error("IntaSend status response was empty");
  return json.invoice;
}

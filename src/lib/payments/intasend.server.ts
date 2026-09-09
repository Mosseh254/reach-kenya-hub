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

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { secret, baseUrl, publishable } = keys();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      // IntaSend sits behind a WAF that returns "403 error code: 1106" for
      // requests without a browser-like User-Agent (edge runtime sends none).
      "User-Agent": "StatusReachKenya/1.0 (+https://reach-kenya-hub.lovable.app)",
      "Accept-Language": "en-US,en;q=0.9",
      "X-IntaSend-Public-API-Key": publishable,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text || "{}");
  } catch {
    json = { detail: text };
  }
  if (!res.ok) {
    const j = json as { detail?: string; errors?: { detail?: string }[] };
    throw new Error(j.errors?.[0]?.detail ?? j.detail ?? `IntaSend request failed (${res.status})`);
  }
  return json as T;
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

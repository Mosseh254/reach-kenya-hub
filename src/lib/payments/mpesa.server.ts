/**
 * M-Pesa payment integration layer.
 *
 * Two adapters implement the same interface:
 *  - MockMpesaAdapter  — DEVELOPMENT / SANDBOX ONLY. No money moves. The checkout page shows
 *                        "simulate success / failure" controls that resolve the order server-side.
 *  - DarajaMpesaAdapter — Safaricom Daraja STK Push. Activated automatically once the
 *                        MPESA_* secrets are configured (see .env.example / README).
 *
 * The adapter is chosen server-side only; the browser never sees credentials.
 */

export type PaymentMode = "mock" | "daraja" | "intasend";

export interface StkPushInput {
  phone: string; // 2547XXXXXXXX
  amountKes: number;
  orderId: string;
  accountReference: string;
  description: string;
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId?: string | undefined;
  customerMessage: string;
}

export interface MpesaAdapter {
  readonly mode: PaymentMode;
  stkPush(input: StkPushInput): Promise<StkPushResult>;
}

function darajaConfigured() {
  return Boolean(
    process.env["MPESA_CONSUMER_KEY"] &&
      process.env["MPESA_CONSUMER_SECRET"] &&
      process.env["MPESA_SHORTCODE"] &&
      process.env["MPESA_PASSKEY"] &&
      process.env["MPESA_CALLBACK_URL"],
  );
}

export function getPaymentMode(): PaymentMode {
  const forced = process.env["MPESA_MODE"];
  if (forced === "mock") return "mock";
  if (forced === "daraja" && darajaConfigured()) return "daraja";
  // IntaSend is the preferred live rail; Daraja stays supported as a fallback.
  if (intasendConfiguredSync()) return "intasend";
  return darajaConfigured() ? "daraja" : "mock";
}

function intasendConfiguredSync() {
  return Boolean(process.env["INTASEND_PUBLISHABLE_KEY"] && process.env["INTASEND_SECRET_KEY"]);
}

/** True when real money moves for new orders. */
export function isLivePayments(): boolean {
  const mode = getPaymentMode();
  if (mode === "intasend") {
    const pub = process.env["INTASEND_PUBLISHABLE_KEY"] ?? "";
    return (process.env["INTASEND_ENV"] ?? (pub.includes("_live_") ? "live" : "test")) === "live";
  }
  return mode === "daraja" && process.env["MPESA_ENV"] === "production";
}

class IntasendAdapter implements MpesaAdapter {
  readonly mode = "intasend" as const;
  async stkPush(input: StkPushInput): Promise<StkPushResult> {
    const { intasendStkPush } = await import("@/lib/payments/intasend.server");
    const res = await intasendStkPush({
      phone: input.phone,
      amountKes: input.amountKes,
      apiRef: input.accountReference,
      narrative: input.description,
    });
    return {
      checkoutRequestId: res.invoiceId,
      customerMessage: "Check your phone and enter your M-Pesa PIN to complete the payment.",
    };
  }
}

class MockMpesaAdapter implements MpesaAdapter {
  readonly mode = "mock" as const;
  async stkPush(input: StkPushInput): Promise<StkPushResult> {
    return {
      checkoutRequestId: `MOCK-${input.orderId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      customerMessage:
        "SANDBOX: No real STK prompt was sent. Use the simulate buttons to complete or fail this payment.",
    };
  }
}

class DarajaMpesaAdapter implements MpesaAdapter {
  readonly mode = "daraja" as const;

  private baseUrl() {
    return process.env["MPESA_ENV"] === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";
  }

  private async accessToken() {
    const key = process.env["MPESA_CONSUMER_KEY"]!;
    const secret = process.env["MPESA_CONSUMER_SECRET"]!;
    const basic = Buffer.from(`${key}:${secret}`).toString("base64");
    const res = await fetch(`${this.baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${basic}` },
    });
    if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
    const json = (await res.json()) as { access_token: string };
    return json.access_token;
  }

  async stkPush(input: StkPushInput): Promise<StkPushResult> {
    const shortcode = process.env["MPESA_SHORTCODE"]!;
    const passkey = process.env["MPESA_PASSKEY"]!;
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
    const callbackToken = process.env["MPESA_CALLBACK_TOKEN"];
    const callbackUrl = new URL(process.env["MPESA_CALLBACK_URL"]!);
    if (callbackToken) callbackUrl.searchParams.set("token", callbackToken);

    const token = await this.accessToken();
    const res = await fetch(`${this.baseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: process.env["MPESA_TRANSACTION_TYPE"] ?? "CustomerPayBillOnline",
        Amount: input.amountKes,
        PartyA: input.phone,
        PartyB: shortcode,
        PhoneNumber: input.phone,
        CallBackURL: callbackUrl.toString(),
        AccountReference: input.accountReference,
        TransactionDesc: input.description.slice(0, 13),
      }),
    });
    const json = (await res.json()) as Record<string, string>;
    if (!res.ok || json["ResponseCode"] !== "0") {
      throw new Error(json["errorMessage"] ?? json["ResponseDescription"] ?? "STK push failed");
    }
    return {
      checkoutRequestId: json["CheckoutRequestID"]!,
      merchantRequestId: json["MerchantRequestID"],
      customerMessage: json["CustomerMessage"] ?? "Check your phone and enter your M-Pesa PIN.",
    };
  }
}

export function getMpesaAdapter(): MpesaAdapter {
  const mode = getPaymentMode();
  if (mode === "intasend") return new IntasendAdapter();
  return mode === "daraja" ? new DarajaMpesaAdapter() : new MockMpesaAdapter();
}

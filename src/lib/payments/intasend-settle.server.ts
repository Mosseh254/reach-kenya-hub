/**
 * Single place where an IntaSend invoice decides an order's fate.
 * Used by the webhook and by status polling, so both paths behave identically
 * and stay idempotent (the order must still be pending).
 */
import { intasendStatus } from "@/lib/payments/intasend.server";

export type SettleResult = "paid" | "failed" | "pending";

export async function settleIntasendOrder(
  orderId: string,
  invoiceId: string,
  amountKes: number,
): Promise<SettleResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let invoice;
  try {
    invoice = await intasendStatus(invoiceId);
  } catch (e) {
    await supabaseAdmin.from("payment_events").insert({
      order_id: orderId,
      provider: "mpesa_intasend",
      event_type: "status_check_error",
      payload: { error: e instanceof Error ? e.message : String(e) } as never,
    });
    return "pending";
  }

  const state = String(invoice.state ?? "").toUpperCase();
  await supabaseAdmin.from("payment_events").insert({
    order_id: orderId,
    provider: "mpesa_intasend",
    event_type: `status_${state.toLowerCase() || "unknown"}`,
    payload: invoice as never,
  });

  if (state === "COMPLETE") {
    const paid = Number(invoice.value ?? 0);
    if (paid && paid + 0.01 < amountKes) {
      await supabaseAdmin.rpc("fail_order", {
        p_order_id: orderId,
        p_reason: `Amount mismatch (KES ${paid} received, KES ${amountKes} expected). Contact support.`,
        p_payload: invoice as never,
      });
      return "failed";
    }
    const { error } = await supabaseAdmin.rpc("confirm_order_paid", {
      p_order_id: orderId,
      p_provider_ref: invoiceId,
      p_receipt: String(invoice.mpesa_reference ?? ""),
      p_payload: invoice as never,
    });
    if (error) return "pending";
    return "paid";
  }

  if (state === "FAILED") {
    await supabaseAdmin.rpc("fail_order", {
      p_order_id: orderId,
      p_reason: invoice.failed_reason || "The M-Pesa payment was not completed. No money was taken.",
      p_payload: invoice as never,
    });
    return "failed";
  }

  return "pending";
}

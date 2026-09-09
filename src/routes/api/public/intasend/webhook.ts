import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * IntaSend payment webhook.
 *
 * Security: IntaSend posts the `challenge` string configured on the webhook.
 * We compare it against INTASEND_WEBHOOK_CHALLENGE and reject mismatches.
 * The payload is never trusted for the amount — we re-read the invoice from
 * IntaSend's status API before marking the order paid, and `confirm_order_paid`
 * validates the amount server-side. Repeated callbacks are ignored (idempotent).
 */
const Payload = z.object({
  invoice_id: z.string().min(4),
  state: z.string().optional(),
  challenge: z.string().optional(),
  api_ref: z.string().nullish(),
});

export const Route = createFileRoute("/api/public/intasend/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["INTASEND_WEBHOOK_CHALLENGE"];
        const raw = await request.text();
        const parsed = Payload.safeParse(JSON.parse(raw || "{}"));
        if (!parsed.success) return Response.json({ ok: false, error: "Bad payload" }, { status: 400 });
        if (expected && parsed.data.challenge !== expected) {
          return new Response("Forbidden", { status: 403 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id,status,amount_kes")
          .eq("provider_ref", parsed.data.invoice_id)
          .maybeSingle();
        if (!order) return Response.json({ ok: true, note: "Unknown invoice ignored" });

        await supabaseAdmin.from("payment_events").insert({
          order_id: order.id,
          provider: "mpesa_intasend",
          event_type: "intasend_webhook",
          payload: parsed.data as never,
        });
        if (order.status !== "pending") return Response.json({ ok: true, note: "Already processed" });

        const { settleIntasendOrder } = await import("@/lib/payments/intasend-settle.server");
        await settleIntasendOrder(order.id, parsed.data.invoice_id, order.amount_kes);
        return Response.json({ ok: true });
      },
    },
  },
});

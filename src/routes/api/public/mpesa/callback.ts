import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Safaricom Daraja STK Push result callback.
 * Security: when MPESA_CALLBACK_TOKEN is set, the URL registered with Daraja
 * includes ?token=..., which we verify here. The order is only marked paid via
 * the server-side `confirm_order_paid` function, which also checks the amount.
 * Idempotent: repeated callbacks for a paid/failed order are ignored.
 */
const CallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string().optional(),
      CheckoutRequestID: z.string(),
      ResultCode: z.number(),
      ResultDesc: z.string().optional(),
      CallbackMetadata: z
        .object({ Item: z.array(z.object({ Name: z.string(), Value: z.union([z.string(), z.number()]).optional() })) })
        .optional(),
    }),
  }),
});

export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedToken = process.env["MPESA_CALLBACK_TOKEN"];
        if (expectedToken) {
          const token = new URL(request.url).searchParams.get("token");
          if (token !== expectedToken) return new Response("Forbidden", { status: 403 });
        }
        const raw = await request.text();
        const parsed = CallbackSchema.safeParse(JSON.parse(raw || "{}"));
        if (!parsed.success) return Response.json({ ResultCode: 1, ResultDesc: "Bad payload" }, { status: 400 });

        const cb = parsed.data.Body.stkCallback;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id,status,amount_kes")
          .eq("provider_ref", cb.CheckoutRequestID)
          .maybeSingle();
        if (!order) return Response.json({ ResultCode: 0, ResultDesc: "Unknown order ignored" });

        await supabaseAdmin.from("payment_events").insert({
          order_id: order.id,
          provider: "mpesa_daraja",
          event_type: "stk_callback",
          payload: parsed.data as never,
        });
        if (order.status !== "pending") return Response.json({ ResultCode: 0, ResultDesc: "Already processed" });

        if (cb.ResultCode === 0) {
          const items = Object.fromEntries((cb.CallbackMetadata?.Item ?? []).map((i) => [i.Name, i.Value]));
          const amount = Number(items["Amount"] ?? 0);
          if (amount < order.amount_kes) {
            await supabaseAdmin.rpc("fail_order", {
              p_order_id: order.id,
              p_reason: `Amount mismatch (${amount} < ${order.amount_kes})`,
              p_payload: parsed.data as never,
            });
          } else {
            await supabaseAdmin.rpc("confirm_order_paid", {
              p_order_id: order.id,
              p_provider_ref: cb.CheckoutRequestID,
              p_receipt: String(items["MpesaReceiptNumber"] ?? ""),
              p_payload: parsed.data as never,
            });
          }
        } else {
          await supabaseAdmin.rpc("fail_order", {
            p_order_id: order.id,
            p_reason: cb.ResultDesc ?? `M-Pesa result code ${cb.ResultCode}`,
            p_payload: parsed.data as never,
          });
        }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});

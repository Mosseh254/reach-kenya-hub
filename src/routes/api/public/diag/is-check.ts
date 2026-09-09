import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/diag/is-check")({
  server: {
    handlers: {
      GET: async () => {
        const pub = process.env["INTASEND_PUBLISHABLE_KEY"] ?? "";
        const sec = process.env["INTASEND_SECRET_KEY"] ?? "";
        const out: Record<string, unknown> = {
          hasPub: Boolean(pub),
          hasSec: Boolean(sec),
          env: process.env["INTASEND_ENV"] ?? null,
        };
        try {
          const res = await fetch("https://payment.intasend.com/api/v1/payment/status/", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sec}`,
              "Content-Type": "application/json",
              Accept: "application/json",
              "X-IntaSend-Public-API-Key": pub,
              "User-Agent": "StatusReachKenya/1.0",
            },
            body: JSON.stringify({ public_key: pub, invoice_id: "KOOV523" }),
          });
          out["status"] = res.status;
          out["body"] = (await res.text()).slice(0, 400);
        } catch (e) {
          out["threw"] = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        }
        return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
      },
    },
  },
});

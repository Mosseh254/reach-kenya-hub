import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { PageTitle, SandboxBanner, StatusBadge } from "@/components/site/Bits";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate, kes, maskPhone } from "@/lib/format";
import { getOrder, simulatePayment } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Payment status — StatusReach Kenya" },
      { name: "description", content: "Follow your M-Pesa payment and campaign activation status." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Payment status — StatusReach Kenya" },
      { property: "og:description", content: "Follow your M-Pesa payment and activation status." },
    ],
  }),
  component: OrderStatusPage,
});

function OrderStatusPage() {
  const { orderId } = Route.useParams();
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder({ data: { orderId } }),
    refetchInterval: (q) => {
      const status = (q.state.data as { order?: { status?: string } } | undefined)?.order?.status;
      return status === "pending" ? 4000 : false;
    },
  });

  const simulate = useMutation({
    mutationFn: (outcome: "success" | "failure") => simulatePayment({ data: { orderId, outcome } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["order", orderId] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">Checking your payment…</span>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not find this order</h2>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void refetch()}>Try again</Button>
          <Button asChild variant="outline"><Link to="/dashboard">Back to overview</Link></Button>
        </div>
      </div>
    );
  }

  const order = data.order as unknown as {
    id: string;
    status: string;
    amount_kes: number;
    phone: string;
    created_at: string;
    paid_at: string | null;
    mpesa_receipt: string | null;
    failure_reason: string | null;
    package?: { name?: string; duration_days?: number } | null;
    campaign?: { title?: string } | null;
  };

  const Icon = order.status === "paid" ? CheckCircle2 : order.status === "pending" ? Clock : XCircle;
  const headline =
    order.status === "paid"
      ? "Payment confirmed — your campaign is active"
      : order.status === "pending"
        ? "Waiting for your M-Pesa confirmation"
        : "Payment was not completed";

  return (
    <>
      <PageTitle title="Payment status" subtitle="This page updates by itself while we wait for M-Pesa." />

      <div className="space-y-6">
        <SandboxBanner mode={data.paymentMode} />

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <Icon
              className={`h-6 w-6 shrink-0 ${order.status === "paid" ? "text-success" : order.status === "pending" ? "text-warning-foreground" : "text-destructive"}`}
            />
            <div>
              <h2 className="font-display text-lg font-bold" aria-live="polite">{headline}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {order.status === "pending"
                  ? "Enter your M-Pesa PIN on your phone. Your package activates only after we receive the confirmation."
                  : order.status === "paid"
                    ? "Download the campaign materials, post them, then upload your screenshot each day."
                    : order.failure_reason || "No money was taken. You can try the payment again."}
              </p>
            </div>
            <div className="ml-auto"><StatusBadge status={order.status} /></div>
          </div>

          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex justify-between rounded-xl bg-muted p-3"><dt className="text-muted-foreground">Package</dt><dd className="font-semibold">{order.package?.name ?? "—"}</dd></div>
            <div className="flex justify-between rounded-xl bg-muted p-3"><dt className="text-muted-foreground">Amount</dt><dd className="font-semibold">{kes(order.amount_kes)}</dd></div>
            <div className="flex justify-between rounded-xl bg-muted p-3"><dt className="text-muted-foreground">M-Pesa number</dt><dd className="font-semibold">{maskPhone(order.phone)}</dd></div>
            <div className="flex justify-between rounded-xl bg-muted p-3"><dt className="text-muted-foreground">Started</dt><dd className="font-semibold">{fmtDate(order.created_at, true)}</dd></div>
            {order.mpesa_receipt && (
              <div className="flex justify-between rounded-xl bg-muted p-3"><dt className="text-muted-foreground">Receipt</dt><dd className="font-semibold">{order.mpesa_receipt}</dd></div>
            )}
            {data.activation && (
              <div className="flex justify-between rounded-xl bg-muted p-3"><dt className="text-muted-foreground">Campaign ends</dt><dd className="font-semibold">{fmtDate(data.activation.expires_at, true)}</dd></div>
            )}
          </dl>

          {order.status === "pending" && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking every few seconds…
            </p>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            {order.status === "paid" ? (
              <>
                <Button asChild><Link to="/campaigns">Open campaign & materials</Link></Button>
                <Button asChild variant="outline"><Link to="/dashboard">Back to overview</Link></Button>
              </>
            ) : order.status === "pending" ? (
              <Button variant="outline" onClick={() => void refetch()}>Refresh now</Button>
            ) : (
              <>
                <Button asChild><Link to="/choose-package">Try another payment</Link></Button>
                <Button asChild variant="outline"><Link to="/dashboard">Back to overview</Link></Button>
              </>
            )}
          </div>
        </div>

        {data.paymentMode === "mock" && order.status === "pending" && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6">
            <h3 className="font-semibold">Sandbox controls</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Only available in mock mode. The outcome is applied on the server exactly like a real M-Pesa callback.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => simulate.mutate("success")} disabled={simulate.isPending}>
                {simulate.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simulate successful payment
              </Button>
              <Button variant="outline" onClick={() => simulate.mutate("failure")} disabled={simulate.isPending}>
                Simulate cancelled payment
              </Button>
            </div>
            {simulate.error instanceof Error && (
              <p role="alert" className="mt-3 text-sm text-destructive">{simulate.error.message}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

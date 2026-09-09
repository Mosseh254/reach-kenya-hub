import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { EmptyState, PageTitle, StatusBadge } from "@/components/site/Bits";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate, kes, maskPhone } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { getMyOrders } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({
    meta: [
      { title: "Orders — StatusReach Kenya" },
      { name: "description", content: "Your package purchases and M-Pesa payment history." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Orders — StatusReach Kenya" },
      { property: "og:description", content: "Package purchases and payment history." },
    ],
  }),
  component: OrdersPage,
});

type OrderRow = {
  id: string;
  status: string;
  amount_kes: number;
  phone: string;
  created_at: string;
  paid_at: string | null;
  mpesa_receipt: string | null;
  failure_reason: string | null;
  package?: { name?: string; duration_days?: number } | null;
};

function OrdersPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => getMyOrders(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">Loading your orders…</span>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load your orders</h2>
        <p className="mt-1 text-sm text-muted-foreground">{friendlyError(error)}</p>
        <Button className="mt-4" onClick={() => void refetch()}>Try again</Button>
      </div>
    );
  }

  const orders = (data ?? []) as unknown as OrderRow[];

  return (
    <>
      <PageTitle
        title="Orders"
        subtitle="Every package purchase and its payment result. Amounts and status come from the server."
        actions={
          <Button asChild variant="outline">
            <Link to="/choose-package">Buy a package</Link>
          </Button>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          body="When you buy a package, your M-Pesa payment and its result will appear here."
          action={<Button asChild><Link to="/choose-package">See packages</Link></Button>}
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-display text-base font-bold">
                    <Receipt className="h-4 w-4 text-primary" />
                    {o.package?.name ?? "Package"}
                    {o.package?.duration_days ? (
                      <span className="text-xs font-normal text-muted-foreground">{o.package.duration_days} days</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fmtDate(o.created_at, true)} · {maskPhone(o.phone)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold">{kes(o.amount_kes)}</p>
                  <div className="mt-1"><StatusBadge status={o.status} /></div>
                </div>
              </div>

              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {o.paid_at && (
                  <div className="flex justify-between rounded-xl bg-muted p-3">
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd className="font-semibold">{fmtDate(o.paid_at, true)}</dd>
                  </div>
                )}
                {o.mpesa_receipt && (
                  <div className="flex justify-between rounded-xl bg-muted p-3">
                    <dt className="text-muted-foreground">Receipt</dt>
                    <dd className="font-semibold">{o.mpesa_receipt}</dd>
                  </div>
                )}
              </dl>

              {o.status === "failed" && o.failure_reason && (
                <p className="mt-3 text-sm text-destructive">{o.failure_reason}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/orders/$orderId" params={{ orderId: o.id }}>View payment status</Link>
                </Button>
                {o.status === "paid" && (
                  <Button asChild size="sm"><Link to="/campaigns">Open campaign</Link></Button>
                )}
                {o.status === "failed" && (
                  <Button asChild size="sm"><Link to="/choose-package">Try again</Link></Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

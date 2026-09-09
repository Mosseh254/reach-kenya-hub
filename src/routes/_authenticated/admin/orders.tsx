import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageTitle, StatusBadge } from "@/components/site/Bits";
import { fmtDate, kes } from "@/lib/format";
import { listOrdersAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders — StatusReach Admin" },
      { name: "description", content: "All package purchases and their payment status." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Orders — StatusReach Admin" },
      { property: "og:description", content: "All package purchases and payment status." },
    ],
  }),
  component: AdminOrders,
});

type Row = {
  id: string;
  amount_kes: number;
  phone: string;
  status: string;
  provider: string;
  mpesa_receipt: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
  package: { name: string } | null;
  user: { full_name: string | null; email: string | null } | null;
};

function AdminOrders() {
  const q = useQuery({ queryKey: ["admin-orders"], queryFn: () => listOrdersAdmin() });
  const rows = (q.data ?? []) as Row[];

  if (q.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading orders…</span>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load orders</h2>
        <Button className="mt-4" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageTitle title="Orders" subtitle="Every package purchase, its payment state and receipt." />
      {rows.length === 0 ? (
        <EmptyState title="No orders yet" body="Purchases will appear here as soon as members check out." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.user?.full_name || o.user?.email || "Member"}</p>
                    <p className="text-xs text-muted-foreground">{o.user?.email}</p>
                  </td>
                  <td className="px-4 py-3">{o.package?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{kes(o.amount_kes)}</td>
                  <td className="px-4 py-3">{o.phone}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                    {o.failure_reason && <p className="mt-1 text-xs text-muted-foreground">{o.failure_reason}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(o.created_at, true)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{o.mpesa_receipt ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

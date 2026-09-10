import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageTitle, StatusBadge } from "@/components/site/Bits";
import { fmtDate, kes } from "@/lib/format";
import { listOrdersAdmin, resolveOrderAdmin } from "@/lib/admin.functions";

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

const FRIENDLY: Record<string, string> = {
  ORDER_NOT_FOUND: "That order could not be found.",
  ORDER_ALREADY_RESOLVED: "This order was already completed or cancelled — nothing to do.",
};

function friendly(message: string) {
  for (const key of Object.keys(FRIENDLY)) if (message.includes(key)) return FRIENDLY[key];
  return message;
}

function AdminOrders() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-orders"], queryFn: () => listOrdersAdmin() });
  const rows = (q.data ?? []) as Row[];
  const [openId, setOpenId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "cancel" }) =>
      resolveOrderAdmin({
        data: {
          id: v.id,
          decision: v.decision,
          receipt: v.decision === "approve" ? receipt.trim() || undefined : undefined,
          note: note.trim() || undefined,
        },
      }),
    onMutate: (v) => setBusy(v.id + v.decision),
    onSettled: () => setBusy(null),
    onSuccess: (_r, v) => {
      toast.success(v.decision === "approve" ? "Order marked as paid and the campaign was activated." : "Order cancelled.");
      setOpenId(null);
      setReceipt("");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["admin-orders"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e) => toast.error(friendly(e instanceof Error ? e.message : "Action failed")),
  });

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
      <PageTitle
        title="Orders"
        subtitle="Every package purchase, its payment state and receipt. Payments confirm automatically — only use the actions below when a payment was received but the order is still waiting."
      />
      {rows.length === 0 ? (
        <EmptyState title="No orders yet" body="Purchases will appear here as soon as members check out." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">Action</th>
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
                  <td className="px-4 py-3">
                    {o.status !== "pending" ? (
                      <span className="text-xs text-muted-foreground">No action needed</span>
                    ) : openId === o.id ? (
                      <div className="min-w-[240px] space-y-2">
                        <Input
                          aria-label="M-Pesa receipt (optional)"
                          placeholder="M-Pesa receipt (optional)"
                          value={receipt}
                          onChange={(e) => setReceipt(e.target.value)}
                        />
                        <Input
                          aria-label="Note (optional)"
                          placeholder="Note (optional)"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={resolve.isPending}
                            onClick={() => resolve.mutate({ id: o.id, decision: "approve" })}
                          >
                            {busy === o.id + "approve" && <Loader2 className="h-4 w-4 animate-spin" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={resolve.isPending}
                            onClick={() => resolve.mutate({ id: o.id, decision: "cancel" })}
                          >
                            {busy === o.id + "cancel" && <Loader2 className="h-4 w-4 animate-spin" />}
                            Cancel
                          </Button>
                          <Button size="sm" variant="ghost" disabled={resolve.isPending} onClick={() => setOpenId(null)}>
                            Close
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOpenId(o.id);
                          setReceipt("");
                          setNote("");
                        }}
                      >
                        Resolve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

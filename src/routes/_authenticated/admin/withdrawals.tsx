import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageTitle, StatusBadge } from "@/components/site/Bits";
import { fmtDate, kes } from "@/lib/format";
import { listWithdrawalsAdmin, processWithdrawalAdmin } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  head: () => ({
    meta: [
      { title: "Withdrawals — StatusReach Admin" },
      { name: "description", content: "Review and process member payout requests." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Withdrawals — StatusReach Admin" },
      { property: "og:description", content: "Review and process member payout requests." },
    ],
  }),
  component: AdminWithdrawals,
});

type Status = "requested" | "paid" | "rejected" | "all";

type Row = {
  id: string;
  amount_kes: number;
  phone: string;
  status: string;
  admin_note: string | null;
  mpesa_receipt: string | null;
  created_at: string;
  processed_at: string | null;
  user: { full_name: string | null; email: string | null } | null;
  wallet: { balance_kes: number; pending_kes: number; lifetime_withdrawn_kes: number } | null;
};

const TABS: { value: Status; label: string }[] = [
  { value: "requested", label: "Requested" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function AdminWithdrawals() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("requested");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [receipts, setReceipts] = useState<Record<string, string>>({});

  const q = useQuery({ queryKey: ["admin-withdrawals", status], queryFn: () => listWithdrawalsAdmin({ data: { status } }) });

  const act = useMutation({
    mutationFn: (v: { id: string; decision: "paid" | "reject" }) =>
      processWithdrawalAdmin({
        data: { id: v.id, decision: v.decision, note: notes[v.id] || undefined, receipt: receipts[v.id] || undefined },
      }),
    onSuccess: (_r, v) => {
      toast.success(v.decision === "paid" ? "Marked as paid" : "Request rejected and funds returned");
      void qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not process that request"),
  });

  const rows = (q.data ?? []) as Row[];

  return (
    <>
      <PageTitle title="Withdrawals" subtitle="Send the M-Pesa payment, then record the receipt here." />

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter withdrawals">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={status === t.value}
            onClick={() => setStatus(t.value)}
            className={cn(
              "rounded-full border border-border px-4 py-1.5 text-sm transition",
              status === t.value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading payout requests…</span>
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : q.isError ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-semibold">We could not load payout requests</h2>
          <Button className="mt-4" onClick={() => void q.refetch()}>
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing here" body="No payout requests match this filter." />
      ) : (
        <ul className="space-y-4">
          {rows.map((w) => {
            const busy = act.isPending && act.variables?.id === w.id;
            return (
              <li key={w.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{w.user?.full_name || w.user?.email || "Member"}</p>
                    <p className="text-xs text-muted-foreground">{w.user?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold">{kes(w.amount_kes)}</p>
                    <StatusBadge status={w.status} />
                  </div>
                </div>

                <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted-foreground">M-Pesa number</dt>
                    <dd className="font-medium">{w.phone}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted-foreground">Requested</dt>
                    <dd className="font-medium">{fmtDate(w.created_at, true)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted-foreground">Wallet balance</dt>
                    <dd className="font-medium">{kes(w.wallet?.balance_kes ?? 0)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-muted-foreground">Held for payouts</dt>
                    <dd className="font-medium">{kes(w.wallet?.pending_kes ?? 0)}</dd>
                  </div>
                </dl>

                {w.status === "requested" ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Input
                      aria-label="M-Pesa receipt"
                      maxLength={40}
                      placeholder="M-Pesa receipt (for paid)"
                      value={receipts[w.id] ?? ""}
                      onChange={(e) => setReceipts((r) => ({ ...r, [w.id]: e.target.value }))}
                    />
                    <Input
                      aria-label="Note"
                      maxLength={300}
                      placeholder="Note for the member (optional)"
                      value={notes[w.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))}
                    />
                    <div className="flex gap-2 sm:col-span-2">
                      <Button disabled={busy} onClick={() => act.mutate({ id: w.id, decision: "paid" })}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Mark as paid
                      </Button>
                      <Button variant="outline" disabled={busy} onClick={() => act.mutate({ id: w.id, decision: "reject" })}>
                        <X className="h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {w.processed_at ? `Handled ${fmtDate(w.processed_at, true)}` : ""}
                    {w.mpesa_receipt ? ` · receipt ${w.mpesa_receipt}` : ""}
                    {w.admin_note ? ` · ${w.admin_note}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

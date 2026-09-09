import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageTitle, StatusBadge } from "@/components/site/Bits";
import { fmtDate, kes, maskPhone, normalizeKenyanPhone } from "@/lib/format";
import { getPayoutsAdmin, payMemberAdmin, releaseRewardsAdmin } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  head: () => ({
    meta: [
      { title: "Payouts — StatusReach Admin" },
      { name: "description", content: "Release approved rewards into member wallets and send real-money payouts." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Payouts — StatusReach Admin" },
      { property: "og:description", content: "Release approved rewards into member wallets and send real-money payouts." },
    ],
  }),
  component: AdminPayouts,
});

/** ISO week key (Mon–Sun) in Nairobi time, e.g. 2026-W37. */
function weekKey(iso: string) {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekRangeLabel(iso: string) {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${fmtDate(monday.toISOString())} – ${fmtDate(sunday.toISOString())}`;
}

function csvCell(value: unknown) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminPayouts() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-payouts"], queryFn: () => getPayoutsAdmin() });
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [week, setWeek] = useState<string>("all");

  const release = useMutation({
    mutationFn: (userId: string) => releaseRewardsAdmin({ data: { userId } }),
    onSuccess: (r) => {
      toast.success(r.released ? `Released ${kes(r.amountKes)} into the wallet.` : "Nothing left to release.");
      void qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not release the rewards."),
  });

  const pay = useMutation({
    mutationFn: (v: { userId: string; amountKes: number; phone: string; receipt?: string }) => payMemberAdmin({ data: v }),
    onSuccess: () => {
      toast.success("Payout recorded and the member has been notified.");
      void qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  const payouts = q.data?.payouts ?? [];
  const weeks = useMemo(() => {
    const set = new Map<string, string>();
    for (const p of payouts) set.set(weekKey(p.created_at), p.created_at);
    return [...set.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [payouts]);

  const visible = week === "all" ? payouts : payouts.filter((p) => weekKey(p.created_at) === week);

  function exportWeek(key: string) {
    const rows = payouts.filter((p) => weekKey(p.created_at) === key);
    downloadCsv(`statusreach-payouts-${key}.csv`, [
      ["Requested at", "Processed at", "Member", "Email", "Phone", "Amount KES", "Status", "M-Pesa receipt", "Note"],
      ...rows.map((r) => [
        fmtDate(r.created_at, true),
        r.processed_at ? fmtDate(r.processed_at, true) : "",
        r.user?.full_name ?? "",
        r.user?.email ?? "",
        r.phone,
        r.amount_kes,
        r.status,
        r.mpesa_receipt ?? "",
        r.admin_note ?? "",
      ]),
      ["", "", "", "", "Total", rows.reduce((s, r) => s + r.amount_kes, 0), "", "", ""],
    ]);
  }

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="space-y-4">
        <PageTitle title="Payouts" subtitle="Release approved rewards and send money to members." />
        <EmptyState title="Could not load payouts" body="Something went wrong while loading payout data.">
          <Button onClick={() => void q.refetch()}>Try again</Button>
        </EmptyState>
      </div>
    );
  }

  const data = q.data;

  return (
    <div className="space-y-8">
      <PageTitle
        title="Payouts"
        subtitle={`Release approved rewards into wallets, then send the money out. Minimum payout ${kes(data.minWithdrawalKes)}.`}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Approved rewards waiting for release</h2>
        {data.pendingRelease.length === 0 ? (
          <EmptyState title="All approved rewards are in wallets" body="Every approved post has already been credited." />
        ) : (
          <ul className="space-y-3">
            {data.pendingRelease.map((r) => (
              <li key={r.userId} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{r.user?.full_name || r.user?.email || "Member"}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.submissionIds.length} approved post{r.submissionIds.length === 1 ? "" : "s"} · {kes(r.amountKes)} to release
                    </p>
                  </div>
                  <Button onClick={() => release.mutate(r.userId)} disabled={release.isPending}>
                    {release.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                    Release to wallet
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Wallet balances ready to pay out</h2>
        {data.payable.length === 0 ? (
          <EmptyState title="No balances to pay" body="Members will appear here once their wallets hold a balance." />
        ) : (
          <ul className="space-y-3">
            {data.payable.map((m) => {
              const phone = phones[m.userId] ?? m.user?.phone ?? "";
              const amount = amounts[m.userId] ?? String(m.wallet.balance_kes);
              return (
                <li key={m.userId} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{m.user?.full_name || m.user?.email || "Member"}</p>
                    <p className="text-sm text-muted-foreground">
                      Balance {kes(m.wallet.balance_kes)} · on hold {kes(m.wallet.pending_kes)}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <Input
                      inputMode="numeric"
                      aria-label="Payout amount in KES"
                      placeholder="Amount"
                      value={amount}
                      onChange={(e) => setAmounts((s) => ({ ...s, [m.userId]: e.target.value }))}
                    />
                    <Input
                      aria-label="M-Pesa number"
                      placeholder="M-Pesa number"
                      value={phone}
                      onChange={(e) => setPhones((s) => ({ ...s, [m.userId]: e.target.value }))}
                    />
                    <Input
                      aria-label="M-Pesa receipt"
                      placeholder="M-Pesa receipt (optional)"
                      value={receipts[m.userId] ?? ""}
                      onChange={(e) => setReceipts((s) => ({ ...s, [m.userId]: e.target.value }))}
                    />
                    <Button
                      disabled={pay.isPending}
                      onClick={() => {
                        const value = Number(amount);
                        const normalized = normalizeKenyanPhone(phone);
                        if (!Number.isInteger(value) || value < 1) return toast.error("Enter a valid payout amount.");
                        if (value > m.wallet.balance_kes) return toast.error("Amount is higher than the member's balance.");
                        if (value < data.minWithdrawalKes) return toast.error(`Minimum payout is ${kes(data.minWithdrawalKes)}.`);
                        if (!normalized) return toast.error("Enter a valid Kenyan M-Pesa number.");
                        pay.mutate({
                          userId: m.userId,
                          amountKes: value,
                          phone: normalized,
                          receipt: receipts[m.userId] || undefined,
                        });
                      }}
                    >
                      {pay.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
                      Send payout
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Payout history</h2>
          <Button
            variant="outline"
            disabled={!weeks.length}
            onClick={() => exportWeek(week === "all" ? (weeks[0]?.[0] ?? "") : week)}
          >
            <Download className="mr-2 size-4" />
            Download {week === "all" ? "latest week" : week} list
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[["all", "All weeks"] as const, ...weeks.map(([key, iso]) => [key, `${key} · ${weekRangeLabel(iso)}`] as const)].map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setWeek(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  week === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No payouts yet" body="Payouts you send will be listed here week by week." />
        ) : (
          <ul className="space-y-3">
            {visible.map((p) => (
              <li key={p.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.user?.full_name || p.user?.email || "Member"}</p>
                    <p className="text-sm text-muted-foreground">
                      {kes(p.amount_kes)} to {maskPhone(p.phone)} · requested {fmtDate(p.created_at, true)}
                      {p.processed_at ? ` · processed ${fmtDate(p.processed_at, true)}` : ""}
                    </p>
                    {p.mpesa_receipt ? <p className="text-sm text-muted-foreground">Receipt {p.mpesa_receipt}</p> : null}
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function friendly(message: string) {
  if (message.includes("BELOW_MINIMUM")) return "That amount is below the minimum payout.";
  if (message.includes("PENDING_WITHDRAWAL_EXISTS")) return "This member already has a payout request awaiting processing.";
  if (message.includes("INSUFFICIENT_BALANCE")) return "The member's balance is too low for this payout.";
  return message || "Could not send the payout.";
}

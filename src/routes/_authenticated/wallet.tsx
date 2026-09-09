import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle, StatCard, StatusBadge } from "@/components/site/Bits";
import { fmtDate, kes, maskPhone } from "@/lib/format";
import { getWallet, requestWithdrawal } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — StatusReach Kenya" },
      { name: "description", content: "Your reward balance, transactions and withdrawal requests." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Wallet — StatusReach Kenya" },
      { property: "og:description", content: "Reward balance, transactions and withdrawals." },
    ],
  }),
  component: WalletPage,
});

const FRIENDLY: Record<string, string> = {
  INVALID_PHONE: "Enter a valid Kenyan M-Pesa number, for example 0712 345 678.",
  INSUFFICIENT_BALANCE: "Your available balance is lower than that amount.",
  BELOW_MINIMUM: "That amount is below the minimum withdrawal.",
  PENDING_WITHDRAWAL_EXISTS: "You already have a withdrawal waiting to be processed.",
};

function friendly(message: string) {
  for (const key of Object.keys(FRIENDLY)) if (message.includes(key)) return FRIENDLY[key];
  return message;
}

const txLabel: Record<string, string> = {
  reward: "Verified post reward",
  referral_bonus: "Referral bonus",
  withdrawal_hold: "Withdrawal on hold",
  withdrawal_paid: "Withdrawal paid",
  withdrawal_reversed: "Withdrawal returned",
  adjustment: "Adjustment",
};

function WalletPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["wallet"], queryFn: () => getWallet() });
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);

  const withdraw = useMutation({
    mutationFn: () => requestWithdrawal({ data: { amount: Number(amount), phone: phone || data?.phone || "" } }),
    onSuccess: () => {
      setAmount("");
      setTouched(false);
      toast.success("Withdrawal requested. Our team will process it shortly.");
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(friendly(e instanceof Error ? e.message : "Request failed")),
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading your wallet…</span>
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load your wallet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Please check your connection and try again."}
        </p>
        <Button className="mt-4" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const balance = data.wallet?.balance_kes ?? 0;
  const min = data.minWithdrawalKes;
  const payoutPhone = phone || data.phone || "";
  const value = Number(amount);
  const tooSmall = touched && amount !== "" && (value < min || value <= 0);
  const tooBig = touched && value > balance;

  return (
    <>
      <PageTitle title="Wallet" subtitle="Rewards from approved posts, and your M-Pesa withdrawals." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available balance" value={kes(balance)} hint={`Minimum withdrawal ${kes(min)}`} icon={<WalletIcon className="h-4 w-4" />} />
        <StatCard label="Pending rewards" value={kes(data.wallet?.pending_kes ?? 0)} hint="Held until review finishes" />
        <StatCard label="Lifetime earned" value={kes(data.wallet?.lifetime_earned_kes ?? 0)} hint="From verified posts only" />
        <StatCard label="Lifetime withdrawn" value={kes(data.wallet?.lifetime_withdrawn_kes ?? 0)} hint="Paid to M-Pesa" />
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold">Withdraw to M-Pesa</h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (value <= 0 || value < min || value > balance) return;
              withdraw.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                inputMode="numeric"
                min={min || 1}
                max={balance}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setTouched(true);
                }}
                aria-invalid={tooSmall || tooBig}
                placeholder={String(min || 100)}
              />
              {tooSmall && <p className="text-sm text-destructive">The minimum withdrawal is {kes(min)}.</p>}
              {tooBig && <p className="text-sm text-destructive">You only have {kes(balance)} available.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">M-Pesa number</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={payoutPhone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
              />
            </div>
            <Button type="submit" disabled={withdraw.isPending || balance < Math.max(min, 1)}>
              {withdraw.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {withdraw.isPending ? "Sending request…" : "Request withdrawal"}
            </Button>
            <p className="text-xs text-muted-foreground">
              The final amount, your balance and eligibility are confirmed on our side. Requests are reviewed before any
              money is sent.
            </p>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold">Withdrawal requests</h2>
          {data.withdrawals.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No withdrawal requests yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.withdrawals.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{kes(w.amount_kes)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(w.created_at, true)} · {maskPhone(w.phone)}
                      {w.mpesa_receipt ? ` · ${w.mpesa_receipt}` : ""}
                    </p>
                    {w.admin_note && <p className="text-xs text-muted-foreground">{w.admin_note}</p>}
                  </div>
                  <StatusBadge status={w.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold">Transactions</h2>
        {data.transactions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Your reward and withdrawal history will appear here.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
            {data.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">{txLabel[t.type] ?? t.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(t.created_at, true)}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className={t.amount_kes >= 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>
                    {t.amount_kes >= 0 ? "+" : "−"}
                    {kes(Math.abs(t.amount_kes))}
                  </p>
                  <p className="text-xs text-muted-foreground">Balance {kes(t.balance_after_kes)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

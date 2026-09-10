import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, Images, Megaphone, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle, StatCard } from "@/components/site/Bits";
import { fmtDate, fmtTime, kes } from "@/lib/format";
import { weekLabel } from "@/lib/week";
import { getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — StatusReach Kenya" },
      { name: "description", content: "Operations overview for reviews, payouts and campaigns." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin overview — StatusReach Kenya" },
      { property: "og:description", content: "Operations overview for reviews and payouts." },
    ],
  }),
  component: AdminOverview,
});

type Overview = {
  users: number;
  pendingSubmissions: number;
  flaggedSubmissions: number;
  pendingWithdrawals: number;
  activeActivations: number;
  packageRevenueKes: number;
  rewardsCreditedKes: number;
  recentAudit: { id: string; action: string; entity_type: string | null; created_at: string }[];
  walletBalancesKes: number;
  walletPendingKes: number;
  week: {
    startsAt: string;
    activeCampaigns: number;
    approvedSubmissions: number;
    rewardsKes: number;
    payoutsKes: number;
    packageFeesKes: number;
  };
};

function AdminOverview() {
  const q = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });


  if (q.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading admin overview…</span>
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load the overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">Please check your connection and try again.</p>
        <Button className="mt-4" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const d = q.data as Overview;

  return (
    <>
      <PageTitle title="Admin overview" subtitle="Reviews, payouts and campaign operations at a glance." />

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold">This week</h2>
          <p className="text-xs text-muted-foreground">
            {weekLabel(d.week.startsAt)} · updates every 30 seconds · last checked {fmtTime(q.dataUpdatedAt)}
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active campaigns" value={d.week.activeCampaigns} icon={<Megaphone className="h-4 w-4" />} />
          <StatCard label="Approved this week" value={d.week.approvedSubmissions} icon={<Images className="h-4 w-4" />} />
          <StatCard
            label="Member wallet balances"
            value={kes(d.walletBalancesKes)}
            hint={`${kes(d.walletPendingKes)} still pending`}
            icon={<Wallet className="h-4 w-4" />}
          />
          <StatCard
            label="Payouts sent this week"
            value={kes(d.week.payoutsKes)}
            hint={`${kes(d.week.rewardsKes)} rewards credited · ${kes(d.week.packageFeesKes)} package fees`}
            icon={<Banknote className="h-4 w-4" />}
          />
        </div>
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Members" value={d.users} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Waiting for review" value={d.pendingSubmissions} icon={<Images className="h-4 w-4" />} />
        <StatCard label="Flagged" value={d.flaggedSubmissions} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Payout requests" value={d.pendingWithdrawals} icon={<Banknote className="h-4 w-4" />} />
        <StatCard label="Active campaigns" value={d.activeActivations} icon={<Megaphone className="h-4 w-4" />} />
        <StatCard label="Package fees collected" value={kes(d.packageRevenueKes)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Rewards credited" value={kes(d.rewardsCreditedKes)} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/admin/submissions">Review submissions</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/withdrawals">Process payouts</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/settings">Packages &amp; settings</Link>
        </Button>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold">Latest activity</h2>
        {d.recentAudit.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {d.recentAudit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium">{a.action}</span>
                <span className="text-xs text-muted-foreground">
                  {a.entity_type ?? "—"} · {fmtDate(a.created_at, true)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

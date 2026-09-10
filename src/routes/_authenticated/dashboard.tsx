import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CreditCard,
  Images,
  Megaphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { EmptyState, PageTitle, StatCard, StatusBadge } from "@/components/site/Bits";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate, kes, timeLeft } from "@/lib/format";
import { getDashboard } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your overview — StatusReach Kenya" },
      { name: "description", content: "Track your active package, campaign posts, verified rewards and wallet balance." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your overview — StatusReach Kenya" },
      { property: "og:description", content: "Track your active package, campaign posts and rewards." },
    ],
  }),
  component: DashboardPage,
});

const journey = [
  { title: "Choose a package", body: "Pick the tier that matches how often you post.", icon: CreditCard },
  { title: "Pay with M-Pesa", body: "Your package activates only after payment is confirmed.", icon: BadgeCheck },
  { title: "Post the campaign", body: "Download the materials and post them on your status.", icon: Megaphone },
  { title: "Upload proof", body: "Send a screenshot each day for review.", icon: Images },
  { title: "Get rewarded", body: "Approved posts add a fixed reward to your wallet.", icon: Wallet },
];

function DashboardPage() {
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading your overview…</span>
        <Skeleton className="h-9 w-56" />
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
        <h2 className="font-semibold">We could not load your overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Please check your connection and try again."}
        </p>
        <Button className="mt-4" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const now = new Date(data.serverNow).getTime();
  const active = data.activations.find((a) => a.status === "active");
  const pendingOrder = data.orders.find((o) => o.status === "pending");
  const approved = data.submissions.filter((s) => s.status === "approved").length;
  const pendingReview = data.submissions.filter((s) => s.status === "pending" || s.status === "flagged").length;

  return (
    <>
      <PageTitle
        title="Your overview"
        subtitle="Everything about your package, posts and rewards in one place."
        actions={
          <Button asChild>
            <Link to="/choose-package">
              <Sparkles className="h-4 w-4" /> {active ? "Add another package" : "Choose a package"}
            </Link>
          </Button>
        }
      />

      {pendingOrder && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-warning/50 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-warning-foreground">Payment not confirmed yet</p>
            <p className="text-sm text-muted-foreground">
              {kes(pendingOrder.amount_kes)} for {(pendingOrder as { package?: { name?: string } }).package?.name ?? "a package"} is
              still waiting on M-Pesa.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/orders/$orderId" params={{ orderId: pendingOrder.id }}>
              Check payment status <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Wallet balance" value={kes(data.wallet?.balance_kes ?? 0)} hint="Withdraw once you reach the minimum" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Pending rewards" value={kes(data.wallet?.pending_kes ?? 0)} hint="Held until review finishes" />
        <StatCard label="Approved posts" value={approved} hint={`${pendingReview} awaiting review`} icon={<BadgeCheck className="h-4 w-4" />} />
        <StatCard label="Lifetime earned" value={kes(data.wallet?.lifetime_earned_kes ?? 0)} hint="From verified posts only" />
      </div>

      {data.week && (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold">This week</h2>
            <p className="text-xs text-muted-foreground">
              {weekLabel(data.week.startsAt)} · updates every 30 seconds · last checked {fmtTime(dataUpdatedAt)}
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active campaigns" value={data.week.activeCampaigns} icon={<Megaphone className="h-4 w-4" />} />
            <StatCard label="Approved this week" value={data.week.approvedSubmissions} icon={<BadgeCheck className="h-4 w-4" />} />
            <StatCard label="Rewards this week" value={kes(data.week.rewardsKes)} icon={<Wallet className="h-4 w-4" />} />
            <StatCard label="Paid out this week" value={kes(data.week.paidOutKes)} hint="M-Pesa withdrawals sent" />
          </div>
        </section>
      )}


      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold">Current package</h2>
          {active ? (
            <ActivationSummary activation={active} now={now} />
          ) : (
            <EmptyState
              title="No active package yet"
              body="Pick a package to unlock the campaign, download the materials and start earning verified rewards."
              action={
                <Button asChild>
                  <Link to="/choose-package">Compare packages</Link>
                </Button>
              }
            />
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold">Recent submissions</h2>
          {data.submissions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing submitted yet. Once your package is active, upload one screenshot per day.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.submissions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{fmtDate(s.created_at, true)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.status === "approved" ? `Reward ${kes(s.reward_kes ?? 0)}` : s.review_note || "Awaiting review"}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" className="mt-5 w-full">
            <Link to="/submissions">View all submissions</Link>
          </Button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold">How your journey works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {journey.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-2 text-primary">
                <step.icon className="h-5 w-5" />
                <span className="font-display text-sm font-bold">Step {i + 1}</span>
              </div>
              <p className="mt-2 font-semibold">{step.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

type Activation = {
  id: string;
  expires_at: string;
  approved_posts: number;
  status: string;
  package?: { name?: string; max_rewarded_posts?: number; reward_per_post_kes?: number; max_posts_per_day?: number } | null;
  campaign?: { title?: string; advertiser?: { name?: string } | null } | null;
};

function ActivationSummary({ activation, now }: { activation: Activation; now: number }) {
  const pkg = activation.package ?? {};
  const max = pkg.max_rewarded_posts ?? 0;
  const pct = max > 0 ? Math.min(100, Math.round((activation.approved_posts / max) * 100)) : 0;
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-2xl font-bold">{pkg.name ?? "Package"}</span>
        <StatusBadge status={activation.status} />
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" /> {timeLeft(activation.expires_at, now)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Campaign: {activation.campaign?.title ?? "—"}
        {activation.campaign?.advertiser?.name ? ` · ${activation.campaign.advertiser.name}` : ""}
      </p>
      <div className="mt-5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Approved posts</span>
          <strong>
            {activation.approved_posts} / {max}
          </strong>
        </div>
        <Progress value={pct} className="mt-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {kes(pkg.reward_per_post_kes ?? 0)} per approved post · up to {pkg.max_posts_per_day ?? 1} post a day · ends{" "}
          {fmtDate(activation.expires_at, true)} (server time)
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button asChild className="flex-1">
          <Link to="/campaigns">
            <Megaphone className="h-4 w-4" /> Open campaign & materials
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link to="/submissions">Upload today&apos;s screenshot</Link>
        </Button>
      </div>
    </div>
  );
}

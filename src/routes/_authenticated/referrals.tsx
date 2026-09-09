import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Gift, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageTitle, StatCard, StatusBadge } from "@/components/site/Bits";
import { fmtDate, kes } from "@/lib/format";
import { getReferrals } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — StatusReach Kenya" },
      { name: "description", content: "Share your referral code and track referral bonuses." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Referrals — StatusReach Kenya" },
      { property: "og:description", content: "Share your referral code and track bonuses." },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["referrals"],
    queryFn: () => getReferrals(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading your referrals…</span>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load your referrals</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Please check your connection and try again."}
        </p>
        <Button className="mt-4" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const link =
    data.code && typeof window !== "undefined"
      ? `${window.location.origin}/auth?mode=signup&ref=${data.code}`
      : data.code
        ? `/auth?mode=signup&ref=${data.code}`
        : "";
  const rewarded = data.referrals.filter((r) => r.status === "rewarded" || r.rewarded_at);
  const earned = rewarded.reduce((sum, r) => sum + (r.bonus_kes ?? 0), 0);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "StatusReach Kenya",
          text: "Join StatusReach Kenya with my invite link",
          url: link,
        });
        return;
      } catch {
        /* user dismissed */
      }
    }
    await copy();
  }

  return (
    <>
      <PageTitle title="Referrals" subtitle="Invite friends with your code. Bonuses are confirmed on our side." />

      {!data.enabled && (
        <div className="mb-6 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Referral bonuses are currently switched off. You can still share your code — any bonus depends on the rules in
          force when your friend joins.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Friends joined" value={data.referrals.length} icon={<Gift className="h-4 w-4" />} />
        <StatCard label="Bonuses confirmed" value={rewarded.length} hint="After their package is paid" />
        <StatCard label="Bonus earned" value={kes(earned)} hint={`Current bonus ${kes(data.bonusKes)} per friend`} />
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold">Your invite link</h2>
        {data.code ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Your code is <strong className="font-semibold text-foreground">{data.code}</strong>
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={link} aria-label="Your invite link" className="font-mono text-xs sm:text-sm" />
              <div className="flex gap-2">
                <Button onClick={() => void copy()} variant="outline">
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <Button onClick={() => void share()}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Your referral code is being prepared. Check back soon.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold">Friends you invited</h2>
        {data.referrals.length === 0 ? (
          <EmptyState title="No referrals yet" body="Share your link and your invites will show up here." />
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
            {data.referrals.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">{r.referredName}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {fmtDate(r.created_at)}
                    {r.bonus_kes ? ` · bonus ${kes(r.bonus_kes)}` : ""}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { PageTitle } from "@/components/site/Bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { kes } from "@/lib/format";
import { getPublicCatalog } from "@/lib/public.functions";
import { createOrder } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/buy/$packageId")({
  head: () => ({
    meta: [
      { title: "Package checkout — StatusReach Kenya" },
      { name: "description", content: "Confirm your package and pay with M-Pesa to activate your campaign." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Package checkout — StatusReach Kenya" },
      { property: "og:description", content: "Confirm your package and pay with M-Pesa." },
    ],
  }),
  component: BuyPage,
});

const messages: Record<string, string> = {
  INVALID_PHONE: "That M-Pesa number does not look right. Use a Safaricom number like 0712 345 678.",
  NOT_FOUND: "This package or campaign is no longer available.",
  ACTIVE_ACTIVATION_EXISTS: "You already have an active package for this campaign. Wait until it ends before buying again.",
};

function BuyPage() {
  const { packageId } = Route.useParams();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["catalog"], queryFn: () => getPublicCatalog() });

  const pay = useMutation({
    mutationFn: (vars: { packageId: string; campaignId: string; phone: string }) => createOrder({ data: vars }),
    onSuccess: (res) => navigate({ to: "/orders/$orderId", params: { orderId: res.orderId } }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">Loading checkout…</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load this package</h2>
        <Button className="mt-4" onClick={() => void refetch()}>Try again</Button>
      </div>
    );
  }

  const pkg = data.packages.find((p) => p.id === packageId);
  if (!pkg) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Package not available</h2>
        <p className="mt-1 text-sm text-muted-foreground">It may have been retired. Pick another one.</p>
        <Button asChild className="mt-4"><Link to="/choose-package">See packages</Link></Button>
      </div>
    );
  }

  const campaigns = data.campaigns;
  const chosen = campaignId ?? campaigns[0]?.id ?? null;
  const features = Array.isArray(pkg.features) ? (pkg.features as string[]) : [];
  const err = pay.error instanceof Error ? messages[pay.error.message] ?? pay.error.message : null;

  return (
    <>
      <PageTitle title={`Activate ${pkg.name}`} subtitle="Confirm the campaign, then approve the M-Pesa prompt on your phone." />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form
          className="rounded-2xl border border-border bg-card p-6 shadow-soft"
          onSubmit={(e) => {
            e.preventDefault();
            if (!chosen) return;
            pay.mutate({ packageId: pkg.id, campaignId: chosen, phone });
          }}
        >
          <h2 className="font-display text-lg font-bold">1. Pick a campaign</h2>
          {campaigns.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No campaign is live right now. Please check back soon.</p>
          ) : (
            <fieldset className="mt-3 space-y-3">
              <legend className="sr-only">Available campaigns</legend>
              {campaigns.map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${chosen === c.id ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <input
                    type="radio"
                    name="campaign"
                    value={c.id}
                    checked={chosen === c.id}
                    onChange={() => setCampaignId(c.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold">{c.title}</span>
                    <span className="block text-sm text-muted-foreground">{c.advertiser?.name} · {c.brief}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <h2 className="mt-8 font-display text-lg font-bold">2. M-Pesa number</h2>
          <div className="mt-3 max-w-sm">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              aria-describedby="phone-hint"
            />
            <p id="phone-hint" className="mt-1 text-xs text-muted-foreground">
              We send the payment request to this number. It also becomes your default payout number.
            </p>
          </div>

          {err && (
            <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {err}
            </p>
          )}

          <Button type="submit" className="mt-6 w-full sm:w-auto" disabled={pay.isPending || !chosen}>
            {pay.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pay.isPending ? "Starting payment…" : `Pay ${kes(pkg.price_kes)} with M-Pesa`}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            The final amount, your eligibility and the activation dates are confirmed on our server, not in the browser.
          </p>
        </form>

        <aside className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:sticky lg:top-6 lg:self-start">
          <h2 className="font-display text-lg font-bold">{pkg.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{pkg.tagline}</p>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-display text-3xl font-bold">{kes(pkg.price_kes)}</span>
            <span className="text-sm text-muted-foreground">one-off fee</span>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Runs for</dt><dd>{pkg.duration_days} days</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Per View</dt><dd>{kes(pkg.reward_per_post_kes)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Posts a day</dt><dd>{pkg.max_posts_per_day}</dd></div>
          </dl>
          <ul className="mt-4 space-y-2 text-sm">
            {features.map((f) => (
              <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{f}</li>
            ))}
          </ul>
          <p className="mt-4 flex gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
            The package fee is for campaign access. Rewards are separate, fixed per approved post, and never guaranteed.
          </p>
        </aside>
      </div>
    </>
  );
}

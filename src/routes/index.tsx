import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Clock, ShieldCheck, Smartphone, Upload, Wallet } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { PublicLayout } from "@/components/site/PublicLayout";
import { PackageCard } from "@/components/site/PackageCard";
import { Button } from "@/components/ui/button";
import { getPublicCatalog } from "@/lib/public.functions";

export const catalogQuery = queryOptions({ queryKey: ["catalog"], queryFn: () => getPublicCatalog(), staleTime: 60_000 });

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  head: () => ({
    meta: [
      { title: "StatusReach Kenya — Share brand campaigns, earn verified rewards" },
      { name: "description", content: "Buy a promotion package, post approved campaign material on your WhatsApp status, upload proof and earn a fixed KES reward for every verified post. Paid out via M-Pesa." },
      { property: "og:title", content: "StatusReach Kenya — Share brand campaigns, earn verified rewards" },
      { property: "og:description", content: "Fixed KES rewards for every verified WhatsApp status post. Packages from KES 250." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "StatusReach Kenya",
          description: "Kenyan digital marketing and verified-engagement rewards platform.",
          areaServed: "KE",
        }),
      },
    ],
  }),
  errorComponent: () => <PublicLayout><p className="p-16 text-center">We couldn't load the catalogue. Please refresh.</p></PublicLayout>,
  component: Landing,
});

const steps = [
  { icon: Smartphone, title: "Pick a package", body: "Choose Bronze, Silver or Gold and pay the package fee via M-Pesa. This is a purchase, not a deposit." },
  { icon: Upload, title: "Share & upload proof", body: "Post the approved campaign image and caption on your WhatsApp status, then upload a screenshot once per day." },
  { icon: BadgeCheck, title: "Get verified", body: "Our team reviews every screenshot. Duplicate, edited or off-brief posts are declined." },
  { icon: Wallet, title: "Earn a fixed reward", body: "Each approved post credits a fixed KES amount to your wallet. Withdraw to M-Pesa from KES 200." },
];

function Landing() {
  const { data } = useSuspenseQuery(catalogQuery);
  const campaign = data.campaigns[0];
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <img src={hero} alt="Kenyan creators sharing campaigns on their phones" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-32">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Every reward is verified by a human reviewer
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
              Your WhatsApp status, <span className="text-primary">paid to promote</span> Kenyan brands.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-foreground/75">
              Buy a promotion package, share approved brand material with your contacts and earn a fixed KES reward for
              every post our team verifies. Clear fees, clear rewards, paid to M-Pesa.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-glow">
                <Link to="/auth" search={{ mode: "signup" }}>Start with Bronze — KES 250 <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-ink-foreground/30 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground">
                <Link to="/how-it-works">How it works</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 text-sm">
              {[["7–30 days", "campaign windows"], ["KES 20–45", "per verified post"], ["1 / day", "screenshot per campaign"]].map(([v, l]) => (
                <div key={l}><dt className="font-display text-xl font-bold">{v}</dt><dd className="text-ink-foreground/60">{l}</dd></div>
              ))}
            </dl>
          </div>
          {campaign && (
            <div className="self-center rounded-3xl border border-ink-foreground/10 bg-ink-foreground/5 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Live demo campaign</p>
              <div className="mt-3 flex items-center gap-3">
                {campaign.advertiser?.logo_url && <img src={campaign.advertiser.logo_url} alt="" className="h-10 w-10 rounded-lg bg-white object-contain p-1" />}
                <div>
                  <p className="font-semibold">{campaign.advertiser?.name}</p>
                  <p className="text-xs text-ink-foreground/60">{campaign.advertiser?.tagline}</p>
                </div>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{campaign.title}</h3>
              <p className="mt-1 text-sm text-ink-foreground/70">{campaign.brief}</p>
              {campaign.materials?.[0]?.asset_url && (
                <img src={campaign.materials[0].asset_url} alt={campaign.materials[0].title} className="mt-4 aspect-[4/3] w-full rounded-2xl object-cover" loading="lazy" />
              )}
              <a href={campaign.cta_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Visit advertiser <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary">How it works</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Four simple steps. No guesswork.</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><s.icon className="h-5 w-5" /></span>
                <span className="font-display text-sm font-bold text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-5 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section className="bg-grain bg-muted/40 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Packages</p>
              <h2 className="mt-2 text-3xl font-bold sm:text-4xl">One fee. Fixed rewards per verified post.</h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              The package price is a purchase fee for campaign access. Rewards are earned only when a post is verified.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {data.packages.map((p, i) => <PackageCard key={p.id} pkg={p} featured={i === 1} />)}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-primary">Built on trust</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Fair for members. Safe for brands.</h2>
          <p className="mt-4 text-muted-foreground">
            StatusReach is a marketing service, not an investment scheme. You pay for a defined campaign window and earn
            fixed rewards for real, verified sharing. Nothing is promised beyond the reward schedule printed on each package.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            [Clock, "Server-timed windows", "Campaign expiry is enforced on our servers, not your phone clock."],
            [ShieldCheck, "Fraud checks", "Duplicate screenshots, rapid re-uploads and tiny files are flagged automatically."],
            [BadgeCheck, "Human review", "Every reward decision is made by a reviewer and recorded in an audit log."],
            [Wallet, "Transparent wallet", "Every credit, hold and payout is itemised. Withdraw to M-Pesa from KES 200."],
          ].map(([Icon, t, b]) => {
            const I = Icon as typeof Clock;
            return (
              <li key={t as string} className="rounded-2xl border border-border p-5">
                <I className="h-5 w-5 text-success" />
                <h3 className="mt-3 font-semibold">{t as string}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b as string}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="rounded-3xl bg-primary px-8 py-12 text-primary-foreground shadow-glow sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Ready to share your first campaign?</h2>
            <p className="mt-2 text-primary-foreground/80">Create a free account, pick a package and post today.</p>
          </div>
          <Button asChild size="lg" variant="secondary" className="mt-6 sm:mt-0">
            <Link to="/auth" search={{ mode: "signup" }}>Create account</Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}

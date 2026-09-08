import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — StatusReach Kenya" },
      { name: "description", content: "Learn how StatusReach Kenya works: buy a package, share approved campaign material on WhatsApp status, upload proof, get verified and earn fixed rewards." },
      { property: "og:title", content: "How it works — StatusReach Kenya" },
      { property: "og:description", content: "Buy, share, verify, earn. Fixed KES rewards per approved post." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold text-primary">How it works</p>
        <h1 className="mt-2 text-4xl font-bold">From package to payout</h1>
        <ol className="mt-10 space-y-8">
          {[
            ["Create an account", "Sign up with email or Google and add the Safaricom number you'll use for M-Pesa payments and payouts."],
            ["Buy a package", "Pick Bronze (7 days), Silver (14 days) or Gold (30 days). Pay the one-off package fee by M-Pesa STK push. Your campaign activates the moment payment is confirmed and the countdown starts on our servers."],
            ["Download campaign material", "Inside the campaign you'll find approved images and caption text from the advertiser. Post them to your WhatsApp status exactly as provided."],
            ["Upload one screenshot per day", "Take a screenshot of your live status showing the campaign and upload it. One submission per campaign per day; each file is hashed so duplicates are caught."],
            ["Verification", "A reviewer checks the screenshot against the brief. Automatic checks flag duplicates, suspiciously fast re-uploads and tiny files for closer review."],
            ["Reward credited", "When approved, the fixed reward for your package is credited to your wallet. Declined posts earn nothing and the reviewer's note explains why."],
            ["Withdraw", "Request a withdrawal to M-Pesa once your available balance reaches the minimum (KES 200). Funds are held while your request is processed."],
          ].map(([t, b], i) => (
            <li key={t} className="flex gap-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">{i + 1}</span>
              <div><h2 className="font-semibold">{t}</h2><p className="mt-1 text-muted-foreground">{b}</p></div>
            </li>
          ))}
        </ol>
        <div className="mt-12 rounded-2xl border border-border bg-muted/40 p-6">
          <h2 className="font-semibold">What StatusReach is not</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            It is not an investment, savings, lottery or betting product. Package fees are payments for a marketing service.
            Rewards are fixed, capped and paid only for verified engagement.
          </p>
        </div>
        <Button asChild size="lg" className="mt-10"><Link to="/auth" search={{ mode: "signup" }}>Create your account</Link></Button>
      </section>
    </PublicLayout>
  ),
});

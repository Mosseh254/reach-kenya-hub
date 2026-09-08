import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/site/PublicLayout";
import { PackageCard } from "@/components/site/PackageCard";
import { catalogQuery } from "./index";

export const Route = createFileRoute("/packages")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  head: () => ({
    meta: [
      { title: "Packages & pricing — StatusReach Kenya" },
      { name: "description", content: "Bronze, Silver and Gold promotion packages from KES 250. Fixed KES rewards per verified WhatsApp status post." },
      { property: "og:title", content: "Packages & pricing — StatusReach Kenya" },
      { property: "og:description", content: "Promotion packages from KES 250 with fixed rewards per verified post." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => <PublicLayout><p className="p-16 text-center">Couldn't load packages.</p></PublicLayout>,
  component: () => {
    const { data } = useSuspenseQuery(catalogQuery);
    return (
      <PublicLayout>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-sm font-semibold text-primary">Packages</p>
          <h1 className="mt-2 text-4xl font-bold">Choose your campaign window</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Each package is a one-off purchase that unlocks a campaign for a fixed number of days. During that window
            you can upload one screenshot per campaign per day. Approved posts earn the fixed reward shown — rewards are
            never guaranteed and depend entirely on verification.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {data.packages.map((p, i) => <PackageCard key={p.id} pkg={p} featured={i === 1} />)}
          </div>
          <div className="mt-12 rounded-2xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
            <strong className="text-foreground">Plain-language note:</strong> The package fee pays for access to advertiser
            campaigns and review services. It is not a deposit, stake or investment and is not refunded as rewards. Reward
            amounts are fixed per approved post and capped per package.
          </div>
        </section>
      </PublicLayout>
    );
  },
});

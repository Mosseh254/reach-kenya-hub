import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "@/components/site/Bits";
import { PackageCard } from "@/components/site/PackageCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { kes } from "@/lib/format";
import { getPublicCatalog } from "@/lib/public.functions";

export const Route = createFileRoute("/_authenticated/choose-package")({
  head: () => ({
    meta: [
      { title: "Choose a package — StatusReach Kenya" },
      { name: "description", content: "Compare StatusReach package tiers and activate the campaign that fits you." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Choose a package — StatusReach Kenya" },
      { property: "og:description", content: "Compare package tiers and activate a campaign." },
    ],
  }),
  component: ChoosePackagePage,
});

function ChoosePackagePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["catalog"],
    queryFn: () => getPublicCatalog(),
  });

  return (
    <>
      <PageTitle
        title="Choose a package"
        subtitle="A one-off package fee unlocks a campaign. Rewards are separate and paid only for verified posts."
      />

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-3" aria-busy="true">
          <span className="sr-only">Loading packages…</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96 rounded-3xl" />
          ))}
        </div>
      )}

      {isError && (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-semibold">We could not load the packages</h2>
          <Button className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            {data.packages.map((p, i) => (
              <PackageCard key={p.id} pkg={p} featured={i === 1} buyTo="buy" />
            ))}
          </div>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Package comparison</caption>
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3">Package</th>
                  <th scope="col" className="px-4 py-3">Fee</th>
                  <th scope="col" className="px-4 py-3">Duration</th>
                  <th scope="col" className="px-4 py-3">Per verified post</th>
                  <th scope="col" className="px-4 py-3">Max rewarded posts</th>
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.packages.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <th scope="row" className="px-4 py-3 text-left font-semibold">{p.name}</th>
                    <td className="px-4 py-3">{kes(p.price_kes)}</td>
                    <td className="px-4 py-3">{p.duration_days} days</td>
                    <td className="px-4 py-3">{kes(p.reward_per_post_kes)}</td>
                    <td className="px-4 py-3">{p.max_rewarded_posts}</td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/buy/$packageId" params={{ packageId: p.id }}>Select</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Prices, durations and rewards are confirmed on our server at checkout. Rewards depend on passing verification.
          </p>
        </>
      )}
    </>
  );
}

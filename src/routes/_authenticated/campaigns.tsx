import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Download, ExternalLink, Images, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageTitle, StatusBadge } from "@/components/site/Bits";
import { fmtDate, kes, timeLeft } from "@/lib/format";
import { getMyActivations } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({
    meta: [
      { title: "My campaigns — StatusReach Kenya" },
      { name: "description", content: "Your active campaigns, materials and posting rules." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "My campaigns — StatusReach Kenya" },
      { property: "og:description", content: "Your active campaigns and materials." },
    ],
  }),
  component: CampaignsPage,
});

function CampaignsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["my-activations"],
    queryFn: () => getMyActivations(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading your campaigns…</span>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load your campaigns</h2>
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
  const activations = data.activations as ActivationRow[];
  const live = activations.filter((a) => a.status === "active");
  const past = activations.filter((a) => a.status !== "active");

  return (
    <>
      <PageTitle
        title="My campaigns"
        subtitle="Download the materials, post them on your status, then upload your proof."
        actions={
          <Button asChild variant="outline">
            <Link to="/choose-package">Add a package</Link>
          </Button>
        }
      />

      {live.length === 0 ? (
        <EmptyState
          title="No active campaign yet"
          body="Your campaign unlocks as soon as a package payment is confirmed."
          action={
            <Button asChild>
              <Link to="/choose-package">Choose a package</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {live.map((a) => (
            <CampaignCard key={a.id} activation={a} now={now} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold">Past campaigns</h2>
          <ul className="mt-4 space-y-3">
            {past.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-soft"
              >
                <div>
                  <p className="font-semibold">{a.campaign?.title ?? "Campaign"}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.package?.name ?? "Package"} · ended {fmtDate(a.expires_at, true)} · {a.approved_posts} approved posts
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

type Material = { id: string; kind: string; title: string; asset_url: string | null; caption_text: string | null };
type ActivationRow = {
  id: string;
  status: string;
  expires_at: string;
  approved_posts: number;
  submittedToday?: boolean;
  package?: {
    name?: string;
    reward_per_post_kes?: number;
    max_posts_per_day?: number;
    max_rewarded_posts?: number;
  } | null;
  campaign?: {
    title?: string;
    brief?: string;
    cta_url?: string;
    advertiser?: { name?: string; tagline?: string } | null;
    materials?: Material[] | null;
  } | null;
};

function CampaignCard({ activation, now }: { activation: ActivationRow; now: number }) {
  const pkg = activation.package ?? {};
  const campaign = activation.campaign ?? {};
  const materials = campaign.materials ?? [];
  const images = materials.filter((m) => m.asset_url);
  const captions = materials.filter((m) => !m.asset_url && m.caption_text);

  return (
    <article className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex flex-wrap items-center gap-3">
        <Megaphone className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">{campaign.title ?? "Campaign"}</h2>
        <StatusBadge status={activation.status} />
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" /> {timeLeft(activation.expires_at, now)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {campaign.advertiser?.name ?? "Advertiser"}
        {campaign.advertiser?.tagline ? ` · ${campaign.advertiser.tagline}` : ""}
      </p>
      {campaign.brief && <p className="mt-4 text-sm">{campaign.brief}</p>}

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-muted/50 p-3">
          <dt className="text-xs text-muted-foreground">Per View</dt>
          <dd className="font-semibold">{kes(pkg.reward_per_post_kes ?? 0)}</dd>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <dt className="text-xs text-muted-foreground">Posts allowed each day</dt>
          <dd className="font-semibold">{pkg.max_posts_per_day ?? 1}</dd>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <dt className="text-xs text-muted-foreground">Approved so far</dt>
          <dd className="font-semibold">
            {activation.approved_posts} / {pkg.max_rewarded_posts ?? 0}
          </dd>
        </div>
      </dl>

      {images.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold">Campaign materials</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {images.map((m) => (
              <figure key={m.id} className="overflow-hidden rounded-xl border border-border">
                <img src={m.asset_url as string} alt={m.title} loading="lazy" className="h-44 w-full object-cover" />
                <figcaption className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="font-medium">{m.title}</span>
                  <Button asChild size="sm" variant="outline">
                    <a href={m.asset_url as string} download target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" /> Save
                    </a>
                  </Button>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {captions.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold">Suggested captions</h3>
          <ul className="mt-3 space-y-2">
            {captions.map((m) => (
              <li key={m.id} className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">{m.title}</p>
                <p className="mt-1 text-muted-foreground">{m.caption_text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild className="flex-1">
          <Link to="/submissions">
            <Images className="h-4 w-4" />
            {activation.submittedToday ? "View today's submission" : "Upload today's screenshot"}
          </Link>
        </Button>
        {campaign.cta_url && (
          <Button asChild variant="outline" className="flex-1">
            <a href={campaign.cta_url} target="_blank" rel="noreferrer noopener">
              Visit the advertiser <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
      {activation.submittedToday && (
        <p className="mt-3 text-xs text-muted-foreground">
          You already sent today&apos;s proof. The next upload opens tomorrow (Nairobi time).
        </p>
      )}
    </article>
  );
}

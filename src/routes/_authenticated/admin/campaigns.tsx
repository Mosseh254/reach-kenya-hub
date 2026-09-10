import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageTitle } from "@/components/site/Bits";
import {
  deleteMaterialAdmin,
  listCampaignContentAdmin,
  saveMaterialAdmin,
  upsertAdvertiserAdmin,
  upsertCampaignAdmin,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaign content — StatusReach Admin" },
      { name: "description", content: "Upload campaign images, captions and links for members to post." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Campaign content — StatusReach Admin" },
      { property: "og:description", content: "Upload the images and captions members post on status." },
    ],
  }),
  component: AdminCampaigns,
});

type Upload = { base64: string; mime: "image/jpeg" | "image/png" | "image/webp"; filename?: string };

const MIMES = ["image/jpeg", "image/png", "image/webp"] as const;

async function readFile(file: File): Promise<Upload> {
  if (!(MIMES as readonly string[]).includes(file.type)) throw new Error("Please choose a JPG, PNG or WEBP image.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Please choose an image smaller than 8MB.");
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return { base64: btoa(binary), mime: file.type as Upload["mime"], filename: file.name };
}

type Material = {
  id: string;
  campaign_id: string;
  kind: string;
  title: string;
  asset_url: string | null;
  caption_text: string | null;
  sort_order: number;
};

type Campaign = {
  id: string;
  advertiser_id: string;
  title: string;
  brief: string;
  cta_url: string;
  cover_url: string | null;
  is_active: boolean;
  advertiser: { id: string; name: string } | null;
  materials: Material[];
  activeMembers: number;
};

type Advertiser = {
  id: string;
  name: string;
  website_url: string;
  tagline: string;
  logo_url: string | null;
  is_active: boolean;
};

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">{children}</div>;
}

function AdminCampaigns() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-campaign-content"], queryFn: () => listCampaignContentAdmin() });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-campaign-content"] });

  const advertisers = (q.data?.advertisers ?? []) as Advertiser[];
  const campaigns = (q.data?.campaigns ?? []) as unknown as Campaign[];

  if (q.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading campaign content…</span>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load your campaign content</h2>
        <Button className="mt-4" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageTitle
        title="Campaign content"
        subtitle="Add the brands, the images and the captions. Members download them and post on their status."
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Brands</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {advertisers.map((a) => (
            <AdvertiserForm key={a.id} advertiser={a} onSaved={refresh} />
          ))}
          <AdvertiserForm onSaved={refresh} />
        </div>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold">Campaigns</h2>
        {advertisers.length === 0 ? (
          <EmptyState title="Add a brand first" body="Every campaign belongs to a brand you add above." />
        ) : (
          <>
            <CampaignForm advertisers={advertisers} onSaved={refresh} />
            {campaigns.length === 0 ? (
              <EmptyState title="No campaigns yet" body="Create your first campaign using the form above." />
            ) : (
              campaigns.map((c) => (
                <CampaignBlock key={c.id} campaign={c} advertisers={advertisers} onSaved={refresh} />
              ))
            )}
          </>
        )}
      </section>
    </>
  );
}

function ImagePicker({
  label,
  value,
  onChange,
  currentUrl,
}: {
  label: string;
  value: Upload | null;
  onChange: (u: Upload | null) => void;
  currentUrl?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {(currentUrl || value) && (
          <img
            src={value ? `data:${value.mime};base64,${value.base64}` : (currentUrl as string)}
            alt=""
            className="h-14 w-14 rounded-lg border border-border object-cover"
          />
        )}
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return onChange(null);
            readFile(f)
              .then(onChange)
              .catch((err: Error) => toast.error(err.message));
          }}
        />
      </div>
    </div>
  );
}

function AdvertiserForm({ advertiser, onSaved }: { advertiser?: Advertiser; onSaved: () => void }) {
  const [name, setName] = useState(advertiser?.name ?? "");
  const [website, setWebsite] = useState(advertiser?.website_url ?? "");
  const [tagline, setTagline] = useState(advertiser?.tagline ?? "");
  const [active, setActive] = useState(advertiser?.is_active ?? true);
  const [logo, setLogo] = useState<Upload | null>(null);

  const m = useMutation({
    mutationFn: () =>
      upsertAdvertiserAdmin({
        data: {
          ...(advertiser ? { id: advertiser.id } : {}),
          name: name.trim(),
          website_url: website.trim(),
          tagline: tagline.trim(),
          is_active: active,
          ...(logo ? { logo } : {}),
        },
      }),
    onSuccess: () => {
      toast.success(advertiser ? "Brand updated" : "Brand added");
      setLogo(null);
      if (!advertiser) {
        setName("");
        setWebsite("");
        setTagline("");
      }
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save the brand."),
  });

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{advertiser ? advertiser.name : "Add a new brand"}</h3>
        {advertiser && <Badge variant="outline">{advertiser.is_active ? "Visible" : "Hidden"}</Badge>}
      </div>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`n-${advertiser?.id ?? "new"}`}>Brand name</Label>
          <Input id={`n-${advertiser?.id ?? "new"}`} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`w-${advertiser?.id ?? "new"}`}>Website link</Label>
          <Input
            id={`w-${advertiser?.id ?? "new"}`}
            value={website}
            placeholder="https://example.co.ke"
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`t-${advertiser?.id ?? "new"}`}>Short tagline</Label>
          <Input id={`t-${advertiser?.id ?? "new"}`} value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </div>
        <ImagePicker label="Logo" value={logo} onChange={setLogo} currentUrl={advertiser?.logo_url ?? null} />
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={active} onCheckedChange={setActive} />
          Show this brand to members
        </label>
        <Button onClick={() => m.mutate()} disabled={m.isPending || !name.trim() || !website.trim()}>
          {m.isPending ? "Saving…" : advertiser ? "Save changes" : "Add brand"}
        </Button>
      </div>
    </Card>
  );
}

function CampaignForm({
  advertisers,
  campaign,
  onSaved,
}: {
  advertisers: Advertiser[];
  campaign?: Campaign;
  onSaved: () => void;
}) {
  const [advertiserId, setAdvertiserId] = useState(campaign?.advertiser_id ?? advertisers[0]?.id ?? "");
  const [title, setTitle] = useState(campaign?.title ?? "");
  const [brief, setBrief] = useState(campaign?.brief ?? "");
  const [cta, setCta] = useState(campaign?.cta_url ?? "");
  const [active, setActive] = useState(campaign?.is_active ?? true);
  const [cover, setCover] = useState<Upload | null>(null);

  const m = useMutation({
    mutationFn: () =>
      upsertCampaignAdmin({
        data: {
          ...(campaign ? { id: campaign.id } : {}),
          advertiser_id: advertiserId,
          title: title.trim(),
          brief: brief.trim(),
          cta_url: cta.trim(),
          is_active: active,
          ...(cover ? { cover } : {}),
        },
      }),
    onSuccess: () => {
      toast.success(campaign ? "Campaign updated" : "Campaign created");
      setCover(null);
      if (!campaign) {
        setTitle("");
        setBrief("");
        setCta("");
      }
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save the campaign."),
  });

  const id = campaign?.id ?? "new";
  return (
    <Card>
      <h3 className="font-semibold">{campaign ? "Campaign details" : "Create a campaign"}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`ca-${id}`}>Brand</Label>
          <select
            id={`ca-${id}`}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={advertiserId}
            onChange={(e) => setAdvertiserId(e.target.value)}
          >
            {advertisers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`ct-${id}`}>Campaign title</Label>
          <Input id={`ct-${id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`cu-${id}`}>Link members share</Label>
          <Input id={`cu-${id}`} value={cta} placeholder="https://…" onChange={(e) => setCta(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`cb-${id}`}>Instructions for members</Label>
          <Textarea id={`cb-${id}`} rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <ImagePicker label="Cover image" value={cover} onChange={setCover} currentUrl={campaign?.cover_url ?? null} />
        </div>
        <label className="flex items-center gap-3 text-sm sm:col-span-2">
          <Switch checked={active} onCheckedChange={setActive} />
          Members can activate this campaign
        </label>
      </div>
      <Button className="mt-4" onClick={() => m.mutate()} disabled={m.isPending || !title.trim() || !cta.trim() || !advertiserId}>
        {m.isPending ? "Saving…" : campaign ? "Save changes" : "Create campaign"}
      </Button>
    </Card>
  );
}

function CampaignBlock({
  campaign,
  advertisers,
  onSaved,
}: {
  campaign: Campaign;
  advertisers: Advertiser[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const images = useMemo(() => campaign.materials.filter((m) => m.asset_url), [campaign.materials]);
  const captions = useMemo(() => campaign.materials.filter((m) => !m.asset_url), [campaign.materials]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{campaign.title}</h3>
            <Badge variant="outline">{campaign.is_active ? "Live" : "Hidden"}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {campaign.advertiser?.name ?? "No brand"} · {images.length} image{images.length === 1 ? "" : "s"} ·{" "}
            {captions.length} caption{captions.length === 1 ? "" : "s"} · {campaign.activeMembers} member
            {campaign.activeMembers === 1 ? "" : "s"} posting now
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Close" : "Manage content"}
        </Button>
      </div>

      {open && (
        <div className="space-y-6 p-5">
          <CampaignForm campaign={campaign} advertisers={advertisers} onSaved={onSaved} />
          <div className="space-y-3">
            <h4 className="font-semibold">Materials members download</h4>
            {campaign.materials.length === 0 ? (
              <EmptyState title="No materials yet" body="Upload the status image and add a ready-made caption below." />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {campaign.materials.map((mat) => (
                  <MaterialRow key={mat.id} material={mat} onSaved={onSaved} />
                ))}
              </ul>
            )}
            <MaterialForm campaignId={campaign.id} onSaved={onSaved} />
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialRow({ material, onSaved }: { material: Material; onSaved: () => void }) {
  const del = useMutation({
    mutationFn: () => deleteMaterialAdmin({ data: { id: material.id } }),
    onSuccess: () => {
      toast.success("Material removed");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Could not remove it."),
  });

  return (
    <li className="flex items-start gap-3 rounded-xl border border-border p-3">
      {material.asset_url ? (
        <img src={material.asset_url} alt={material.title} className="h-16 w-16 rounded-lg object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
          Caption
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{material.title}</p>
        {material.caption_text && <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{material.caption_text}</p>}
      </div>
      <Button variant="ghost" size="sm" onClick={() => del.mutate()} disabled={del.isPending}>
        {del.isPending ? "Removing…" : "Remove"}
      </Button>
    </li>
  );
}

function MaterialForm({ campaignId, onSaved }: { campaignId: string; onSaved: () => void }) {
  const [kind, setKind] = useState<"image" | "caption">("image");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [order, setOrder] = useState(0);
  const [file, setFile] = useState<Upload | null>(null);

  const m = useMutation({
    mutationFn: () =>
      saveMaterialAdmin({
        data: {
          campaign_id: campaignId,
          kind,
          title: title.trim(),
          sort_order: order,
          ...(caption.trim() ? { caption_text: caption.trim() } : {}),
          ...(file ? { file } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Material added");
      setTitle("");
      setCaption("");
      setFile(null);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message || "Could not add the material."),
  });

  return (
    <div className="rounded-xl border border-dashed border-border p-4">
      <h5 className="font-medium">Add material</h5>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`mk-${campaignId}`}>Type</Label>
          <select
            id={`mk-${campaignId}`}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as "image" | "caption")}
          >
            <option value="image">Image to post</option>
            <option value="caption">Ready-made caption</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`mt-${campaignId}`}>Title</Label>
          <Input id={`mt-${campaignId}`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {kind === "image" ? (
          <div className="sm:col-span-2">
            <ImagePicker label="Image file" value={file} onChange={setFile} />
          </div>
        ) : null}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`mc-${campaignId}`}>{kind === "caption" ? "Caption text" : "Optional caption"}</Label>
          <Textarea id={`mc-${campaignId}`} rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`mo-${campaignId}`}>Order</Label>
          <Input
            id={`mo-${campaignId}`}
            type="number"
            min={0}
            max={99}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <Button
        className="mt-4"
        onClick={() => m.mutate()}
        disabled={m.isPending || title.trim().length < 2 || (kind === "image" ? !file : !caption.trim())}
      >
        {m.isPending ? "Uploading…" : "Add material"}
      </Button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, Save, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle, SandboxBanner } from "@/components/site/Bits";
import { kes } from "@/lib/format";
import { getAdminSettings, updateSettingAdmin, upsertPackageAdmin } from "@/lib/admin.functions";

type IntasendConfig = {
  configured: boolean;
  live: boolean;
  env: string;
  hasChallenge: boolean;
  webhookUrl: string;
};

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Packages & settings — StatusReach Admin" },
      { name: "description", content: "Manage package tiers, rewards and platform settings." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Packages & settings — StatusReach Admin" },
      { property: "og:description", content: "Manage package tiers and platform settings." },
    ],
  }),
  component: AdminSettings,
});

type PackageForm = {
  id?: string;
  slug: string;
  name: string;
  tagline: string;
  price_kes: number;
  duration_days: number;
  reward_per_post_kes: number;
  max_posts_per_day: number;
  max_rewarded_posts: number;
  is_active: boolean;
  sort_order: number;
  features: string[];
};

type PackageRow = PackageForm & { id: string; features: unknown };
type SettingRow = { key: string; value: unknown; description: string | null; is_public: boolean };

const blank: PackageForm = {
  slug: "",
  name: "",
  tagline: "",
  price_kes: 250,
  duration_days: 7,
  reward_per_post_kes: 20,
  max_posts_per_day: 1,
  max_rewarded_posts: 7,
  is_active: true,
  sort_order: 99,
  features: [],
};

function toForm(p: PackageRow): PackageForm {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline ?? "",
    price_kes: p.price_kes,
    duration_days: p.duration_days,
    reward_per_post_kes: p.reward_per_post_kes,
    max_posts_per_day: p.max_posts_per_day,
    max_rewarded_posts: p.max_rewarded_posts,
    is_active: p.is_active,
    sort_order: p.sort_order,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
  };
}

function AdminSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-settings"], queryFn: () => getAdminSettings() });

  const savePackage = useMutation({
    mutationFn: (v: PackageForm) => upsertPackageAdmin({ data: v }),
    onSuccess: () => {
      toast.success("Package saved");
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
      void qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save package"),
  });

  const saveSetting = useMutation({
    mutationFn: (v: { key: string; value: unknown }) => updateSettingAdmin({ data: v }),
    onSuccess: () => {
      toast.success("Setting saved");
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save setting"),
  });

  const [creating, setCreating] = useState(false);

  if (q.isLoading) {
    return (
      <>
        <PageTitle title="Packages & settings" />
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading settings…</span>
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </>
    );
  }

  if (q.isError || !q.data) {
    return (
      <>
        <PageTitle title="Packages & settings" />
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-semibold">We could not load this page</h2>
          <Button className="mt-4" onClick={() => void q.refetch()}>
            Try again
          </Button>
        </div>
      </>
    );
  }

  const packages = (q.data.packages ?? []) as unknown as PackageRow[];
  const settings = (q.data.settings ?? []) as unknown as SettingRow[];

  return (
    <>
      <PageTitle
        title="Packages & settings"
        subtitle="Package tiers, rewards and platform settings. Every value is re-checked on the server at checkout."
        actions={
          <Button variant="outline" onClick={() => setCreating((v) => !v)}>
            <Plus className="h-4 w-4" /> {creating ? "Cancel new tier" : "New tier"}
          </Button>
        }
      />

      <div className="mb-6">
        <SandboxBanner mode={q.data.paymentMode} />
      </div>

      {q.data.intasend && <IntasendSetupPanel config={q.data.intasend} />}

      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold">Package tiers</h2>
        {creating && <PackageEditor initial={blank} onSave={(v) => savePackage.mutate(v)} saving={savePackage.isPending} />}
        {packages.map((p) => (
          <PackageEditor key={p.id} initial={toForm(p)} onSave={(v) => savePackage.mutate(v)} saving={savePackage.isPending} />
        ))}
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-lg font-bold">Platform settings</h2>
        {settings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No platform settings defined.</p>
        ) : (
          <ul className="space-y-3">
            {settings.map((s) => (
              <SettingEditor key={s.key} row={s} onSave={(value) => saveSetting.mutate({ key: s.key, value })} saving={saveSetting.isPending} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function num(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function PackageEditor({ initial, onSave, saving }: { initial: PackageForm; onSave: (v: PackageForm) => void; saving: boolean }) {
  const [form, setForm] = useState<PackageForm>(initial);
  const [featureText, setFeatureText] = useState(initial.features.join("\n"));

  useEffect(() => {
    setForm(initial);
    setFeatureText(initial.features.join("\n"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id, initial.slug]);

  const set = <K extends keyof PackageForm>(k: K, v: PackageForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="rounded-2xl border border-border bg-card p-5 shadow-soft"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          slug: form.slug.trim().toLowerCase(),
          features: featureText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
        });
      }}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{form.name || "New tier"}</h3>
        <Badge variant="outline">{form.is_active ? "Active" : "Hidden"}</Badge>
        <span className="text-sm text-muted-foreground">
          {kes(form.price_kes)} · {form.duration_days} days
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name" id={`name-${form.slug}`}>
          <Input id={`name-${form.slug}`} value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={40} />
        </Field>
        <Field label="Slug (lowercase, dashes)" id={`slug-${form.slug}`}>
          <Input id={`slug-${form.slug}`} value={form.slug} onChange={(e) => set("slug", e.target.value)} required pattern="[a-z0-9-]+" />
        </Field>
        <Field label="Tagline" id={`tag-${form.slug}`}>
          <Input id={`tag-${form.slug}`} value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} />
        </Field>
        <Field label="Price (KES)" id={`price-${form.slug}`}>
          <Input
            id={`price-${form.slug}`}
            type="number"
            min={0}
            value={form.price_kes}
            onChange={(e) => set("price_kes", num(e.target.value, 0))}
          />
        </Field>
        <Field label="Duration (days)" id={`dur-${form.slug}`}>
          <Input
            id={`dur-${form.slug}`}
            type="number"
            min={1}
            max={365}
            value={form.duration_days}
            onChange={(e) => set("duration_days", num(e.target.value, 1))}
          />
        </Field>
        <Field label="Reward per view (KES)" id={`rew-${form.slug}`}>
          <Input
            id={`rew-${form.slug}`}
            type="number"
            min={0}
            value={form.reward_per_post_kes}
            onChange={(e) => set("reward_per_post_kes", num(e.target.value, 0))}
          />
        </Field>
        <Field label="Posts per day" id={`ppd-${form.slug}`}>
          <Input
            id={`ppd-${form.slug}`}
            type="number"
            min={1}
            max={10}
            value={form.max_posts_per_day}
            onChange={(e) => set("max_posts_per_day", num(e.target.value, 1))}
          />
        </Field>
        <Field label="Rewarded submissions cap" id={`cap-${form.slug}`}>
          <Input
            id={`cap-${form.slug}`}
            type="number"
            min={1}
            value={form.max_rewarded_posts}
            onChange={(e) => set("max_rewarded_posts", num(e.target.value, 1))}
          />
        </Field>
        <Field label="Display order" id={`ord-${form.slug}`}>
          <Input
            id={`ord-${form.slug}`}
            type="number"
            value={form.sort_order}
            onChange={(e) => set("sort_order", num(e.target.value, 0))}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Label htmlFor={`feat-${form.slug}`}>Features shown on the package card (one per line)</Label>
        <Textarea
          id={`feat-${form.slug}`}
          className="mt-1.5"
          rows={4}
          value={featureText}
          onChange={(e) => setFeatureText(e.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
          />
          Visible to members
        </label>
        <Button type="submit" disabled={saving} className="ml-auto">
          <Save className="h-4 w-4" /> {form.id ? "Save changes" : "Create tier"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function IntasendSetupPanel({ config }: { config: IntasendConfig }) {
  const [copied, setCopied] = useState(false);
  const allGood = config.configured && config.hasChallenge;

  function copyUrl() {
    void navigator.clipboard.writeText(config.webhookUrl).then(() => {
      setCopied(true);
      toast.success("Webhook URL copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-bold">IntaSend live payments</h2>
        {allGood ? (
          <Badge variant="outline" className="border-success/30 bg-success/15 text-success">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" /> {config.live ? "Live keys" : "Test keys"} · Challenge set
          </Badge>
        ) : (
          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
            <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Incomplete
          </Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Copy this webhook URL into your IntaSend dashboard under <strong>Webhooks</strong>, then enter the same
        challenge word you saved here. IntaSend sends that challenge with every payment event so your server can
        verify the callback is genuine.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 truncate rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
          {config.webhookUrl}
        </code>
        <Button variant="outline" onClick={copyUrl} className="shrink-0">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy URL
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ConfigRow label="Publishable + secret keys" ok={config.configured} />
        <ConfigRow label="Webhook challenge word" ok={config.hasChallenge} />
        <ConfigRow label={`Environment: ${config.env}`} ok={config.live} okLabel="real money" badLabel="test" />
      </div>

      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          Go to the IntaSend dashboard → <strong>Webhooks</strong> → add a new endpoint.
        </li>
        <li>
          Paste the webhook URL above as the destination URL (must be HTTPS).
        </li>
        <li>
          Set the challenge word to the <em>same value</em> you saved as{" "}
          <code className="rounded bg-muted px-1">INTASEND_WEBHOOK_CHALLENGE</code> in your secrets.
        </li>
        <li>Save. Real M-Pesa STK prompts and automatic order confirmation will then work.</li>
      </ol>
    </section>
  );
}

function ConfigRow({ label, ok, okLabel = "set", badLabel = "missing" }: { label: string; ok: boolean; okLabel?: string; badLabel?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      {ok ? (
        <ShieldCheck className="h-4 w-4 text-success" />
      ) : (
        <ShieldAlert className="h-4 w-4 text-destructive" />
      )}
      <span className="text-foreground">{label}</span>
      <Badge variant="outline" className={ok ? "border-success/30 bg-success/15 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}>
        {ok ? okLabel : badLabel}
      </Badge>
    </div>
  );
}

function SettingEditor({ row, onSave, saving }: { row: SettingRow; onSave: (value: unknown) => void; saving: boolean }) {
  const isPrimitive = typeof row.value === "string" || typeof row.value === "number" || typeof row.value === "boolean";
  const initial = isPrimitive ? String(row.value) : JSON.stringify(row.value, null, 2);
  const [text, setText] = useState(initial);

  useEffect(() => {
    setText(isPrimitive ? String(row.value) : JSON.stringify(row.value, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.key, JSON.stringify(row.value)]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (typeof row.value === "number") {
      const n = Number(text);
      if (!Number.isFinite(n)) return toast.error("Enter a number");
      return onSave(n);
    }
    if (typeof row.value === "boolean") return onSave(text.trim() === "true");
    if (typeof row.value === "string") return onSave(text);
    try {
      onSave(JSON.parse(text) as unknown);
    } catch {
      toast.error("That is not valid JSON");
    }
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <form onSubmit={submit}>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={`set-${row.key}`} className="font-medium">
            {row.key}
          </Label>
          {row.is_public && <Badge variant="outline">Public</Badge>}
        </div>
        {row.description && <p className="mt-1 text-xs text-muted-foreground">{row.description}</p>}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
          {isPrimitive ? (
            <Input id={`set-${row.key}`} value={text} onChange={(e) => setText(e.target.value)} className="sm:flex-1" />
          ) : (
            <Textarea id={`set-${row.key}`} rows={3} value={text} onChange={(e) => setText(e.target.value)} className="sm:flex-1 font-mono text-xs" />
          )}
          <Button type="submit" variant="outline" disabled={saving}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </form>
    </li>
  );
}

import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageTitle, StatusBadge } from "@/components/site/Bits";
import { fmtDate, kes } from "@/lib/format";
import { getMyActivations, getMySubmissions, submitScreenshot } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/submissions")({
  head: () => ({
    meta: [
      { title: "Submissions — StatusReach Kenya" },
      { name: "description", content: "Upload daily screenshots and follow their review status." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Submissions — StatusReach Kenya" },
      { property: "og:description", content: "Upload screenshots and follow review status." },
    ],
  }),
  component: SubmissionsPage,
});

const FRIENDLY: Record<string, string> = {
  INVALID_FILE: "That file could not be used. Send a JPG, PNG or WebP screenshot under the size limit.",
  DAILY_LIMIT_REACHED: "You have already sent today's proof for this campaign.",
  ACTIVATION_NOT_ACTIVE: "That package is no longer active.",
  MAX_REWARDED_POSTS_REACHED: "You have reached the maximum number of rewarded posts for this package.",
  DUPLICATE_SCREENSHOT: "This exact screenshot was sent before. Please post again and take a fresh screenshot.",
};

function friendly(message: string) {
  for (const key of Object.keys(FRIENDLY)) if (message.includes(key)) return FRIENDLY[key];
  return message;
}

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

function SubmissionsPage() {
  const qc = useQueryClient();
  const activations = useQuery({ queryKey: ["my-activations"], queryFn: () => getMyActivations() });
  const submissions = useQuery({ queryKey: ["my-submissions"], queryFn: () => getMySubmissions() });

  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const active = ((activations.data?.activations ?? []) as ActivationRow[]).filter((a) => a.status === "active");
  const [activationId, setActivationId] = useState<string>("");
  const chosen = active.find((a) => a.id === activationId) ?? active[0];

  const upload = useMutation({
    mutationFn: async () => {
      if (!chosen) throw new Error("You need an active package first.");
      if (!file) throw new Error("Please choose a screenshot.");
      const base64 = await readAsBase64(file);
      return submitScreenshot({ data: { activationId: chosen.id, mime: file.type, base64, note: note || undefined } });
    },
    onSuccess: () => {
      setFile(null);
      setNote("");
      if (fileInput.current) fileInput.current.value = "";
      toast.success("Screenshot sent for review");
      void qc.invalidateQueries({ queryKey: ["my-submissions"] });
      void qc.invalidateQueries({ queryKey: ["my-activations"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(friendly(e instanceof Error ? e.message : "Upload failed")),
  });

  if (activations.isLoading || submissions.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading your submissions…</span>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (activations.isError || submissions.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load your submissions</h2>
        <p className="mt-1 text-sm text-muted-foreground">Please check your connection and try again.</p>
        <Button
          className="mt-4"
          onClick={() => {
            void activations.refetch();
            void submissions.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const rows = (submissions.data ?? []) as SubmissionRow[];
  const alreadyToday = Boolean(chosen?.submittedToday);

  return (
    <>
      <PageTitle
        title="Submissions"
        subtitle="One screenshot per campaign per day. Every reward decision is made by our review team."
      />

      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold">Upload today&apos;s proof</h2>
        {active.length === 0 ? (
          <EmptyState
            title="No active package"
            body="Buy a package to start posting the campaign and uploading proof."
            action={
              <Button asChild>
                <Link to="/choose-package">Choose a package</Link>
              </Button>
            }
          />
        ) : (
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              upload.mutate();
            }}
          >
            {active.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="activation">Campaign</Label>
                <select
                  id="activation"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={chosen?.id ?? ""}
                  onChange={(e) => setActivationId(e.target.value)}
                >
                  {active.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.campaign?.title ?? "Campaign"} — {a.package?.name ?? "Package"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="screenshot">Screenshot</Label>
              <Input
                id="screenshot"
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Show your status post with the views or viewer list visible. JPG, PNG or WebP.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything the reviewer should know"
              />
            </div>

            {alreadyToday && (
              <p className="rounded-xl border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                Today&apos;s proof for this campaign is already in. The next upload opens tomorrow (Nairobi time).
              </p>
            )}

            <Button type="submit" disabled={upload.isPending || !file}>
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {upload.isPending ? "Sending…" : "Send for review"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Rewards are never automatic: the amount, the daily limit and the outcome are all decided on our side after
              checks.
            </p>
          </form>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold">Your history</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing submitted yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
                {s.previewUrl ? (
                  <img src={s.previewUrl} alt="" loading="lazy" className="h-20 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="h-20 w-16 rounded-lg bg-muted" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.campaign?.title ?? "Campaign"}</p>
                  <p className="text-xs text-muted-foreground">Sent {fmtDate(s.created_at, true)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {s.status === "approved"
                      ? `Approved · reward ${kes(s.reward_kes ?? 0)}`
                      : s.review_note || (s.status === "pending" ? "Waiting for review" : "See review notes")}
                  </p>
                </div>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

type ActivationRow = {
  id: string;
  status: string;
  submittedToday?: boolean;
  package?: { name?: string } | null;
  campaign?: { title?: string } | null;
};

type SubmissionRow = {
  id: string;
  status: string;
  reward_kes: number | null;
  review_note: string | null;
  created_at: string;
  previewUrl: string | null;
  campaign?: { title?: string } | null;
};

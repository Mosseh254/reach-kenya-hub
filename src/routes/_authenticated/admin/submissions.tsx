import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Maximize2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageTitle, StatusBadge } from "@/components/site/Bits";
import { fmtDate, kes } from "@/lib/format";
import { listSubmissionsAdmin, reviewSubmissionAdmin } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/submissions")({
  head: () => ({
    meta: [
      { title: "Review queue — StatusReach Kenya" },
      { name: "description", content: "Review screenshot submissions and approve rewards." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Review queue — StatusReach Kenya" },
      { property: "og:description", content: "Review submissions and approve rewards." },
    ],
  }),
  component: AdminSubmissions,
});

type Status = "pending" | "flagged" | "approved" | "rejected" | "all";

type Row = {
  id: string;
  status: string;
  note: string | null;
  review_note: string | null;
  fraud_flags: unknown;
  fraud_score: number;
  reward_kes: number | null;
  created_at: string;
  previewUrl: string | null;
  duplicateCount: number;
  user: { full_name: string | null; email: string | null; phone: string | null } | null;
  campaign: { title: string | null } | null;
  activation: {
    expires_at: string;
    approved_posts: number;
    package: { name: string; reward_per_post_kes: number; max_rewarded_posts: number } | null;
  } | null;
};

const TABS: { value: Status; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "flagged", label: "Flagged" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const DECLINE_REASONS = [
  "Screenshot does not show a status post",
  "View count or viewer list not visible",
  "Screenshot is edited or reused",
  "Wrong campaign material posted",
  "Image is unclear or cropped",
];

function AdminSubmissions() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("pending");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<{ url: string; who: string } | null>(null);

  const q = useQuery({ queryKey: ["admin-submissions", status], queryFn: () => listSubmissionsAdmin({ data: { status } }) });

  const review = useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "reject" }) =>
      reviewSubmissionAdmin({ data: { id: v.id, decision: v.decision, note: notes[v.id] || undefined } }),
    onSuccess: (_r, v) => {
      toast.success(v.decision === "approve" ? "Approved and reward credited" : "Submission declined");
      setNotes((n) => ({ ...n, [v.id]: "" }));
      void qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save that decision"),
  });

  const allRows = (q.data ?? []) as Row[];
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allRows;
    return allRows.filter((s) =>
      [s.user?.full_name, s.user?.email, s.user?.phone, s.campaign?.title, s.activation?.package?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [allRows, search]);

  return (
    <>
      <PageTitle
        title="Review queue"
        subtitle="Open each screenshot full size, then approve to credit the reward or decline with a reason."
      />

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter submissions">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={status === t.value}
            onClick={() => setStatus(t.value)}
            className={cn(
              "rounded-full border border-border px-4 py-1.5 text-sm transition",
              status === t.value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
            )}
          >
            {t.label}
            {status === t.value && !q.isLoading ? ` (${allRows.length})` : ""}
          </button>
        ))}
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          className="pl-9"
          aria-label="Search this list"
          placeholder="Search member, phone, campaign or package"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {q.isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading submissions…</span>
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : q.isError ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-semibold">We could not load the queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">Please check your connection and try again.</p>
          <Button className="mt-4" onClick={() => void q.refetch()}>
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing here"
          body={search ? "No submissions match your search." : "No submissions match this filter right now."}
        />
      ) : (
        <ul className="space-y-4">
          {rows.map((s) => {
            const flags = Array.isArray(s.fraud_flags) ? (s.fraud_flags as string[]) : [];
            const busy = review.isPending && review.variables?.id === s.id;
            const open = s.status === "pending" || s.status === "flagged";
            const who = s.user?.full_name || s.user?.email || "Member";
            const reason = notes[s.id] ?? "";
            return (
              <li key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
                <div className="flex flex-col gap-5 sm:flex-row">
                  {s.previewUrl ? (
                    <button
                      type="button"
                      onClick={() => setZoom({ url: s.previewUrl as string, who })}
                      className="group relative shrink-0 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Open ${who}'s screenshot full size`}
                    >
                      <img
                        src={s.previewUrl}
                        alt="Submitted screenshot"
                        loading="lazy"
                        className="h-64 w-full object-cover transition group-hover:scale-[1.02] sm:w-52"
                      />
                      <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-xs font-medium">
                        <Maximize2 className="h-3 w-3" aria-hidden="true" /> Full size
                      </span>
                    </button>
                  ) : (
                    <div className="h-64 w-full rounded-xl bg-muted sm:w-52" aria-hidden="true" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{who}</p>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.user?.email} {s.user?.phone ? `· ${s.user.phone}` : ""}
                    </p>

                    <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                      <div className="flex justify-between gap-2 sm:block">
                        <dt className="text-muted-foreground">Campaign</dt>
                        <dd className="font-medium">{s.campaign?.title ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2 sm:block">
                        <dt className="text-muted-foreground">Package</dt>
                        <dd className="font-medium">{s.activation?.package?.name ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2 sm:block">
                        <dt className="text-muted-foreground">Sent</dt>
                        <dd className="font-medium">{fmtDate(s.created_at, true)}</dd>
                      </div>
                      <div className="flex justify-between gap-2 sm:block">
                        <dt className="text-muted-foreground">Campaign ends</dt>
                        <dd className="font-medium">{s.activation ? fmtDate(s.activation.expires_at) : "—"}</dd>
                      </div>
                    </dl>

                    {s.note && <p className="mt-3 text-sm text-muted-foreground">Member note: {s.note}</p>}

                    {(flags.length > 0 || s.duplicateCount > 0) && (
                      <div className="mt-3 rounded-xl border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
                        <strong>Checks:</strong> risk score {s.fraud_score}
                        {flags.length > 0 && <> · {flags.join(", ")}</>}
                        {s.duplicateCount > 0 && <> · same image seen {s.duplicateCount} other time(s)</>}
                      </div>
                    )}

                    {s.status === "approved" && (
                      <p className="mt-3 text-sm text-success">Reward credited: {kes(s.reward_kes ?? 0)}</p>
                    )}
                    {s.review_note && !open && (
                      <p className="mt-2 text-sm text-muted-foreground">Review note: {s.review_note}</p>
                    )}

                    {open && (
                      <div className="mt-4 space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {DECLINE_REASONS.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setNotes((n) => ({ ...n, [s.id]: n[s.id] === r ? "" : r }))}
                              aria-pressed={reason === r}
                              className={cn(
                                "rounded-full border border-border px-3 py-1 text-xs transition",
                                reason === r ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                              )}
                            >
                              {r}
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <Input
                            aria-label="Reason or note for the member"
                            maxLength={300}
                            placeholder="Pick a reason above or write your own"
                            value={reason}
                            onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button disabled={busy} onClick={() => review.mutate({ id: s.id, decision: "approve" })}>
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                if (!reason.trim()) {
                                  toast.error("Add a reason so the member knows why it was declined.");
                                  return;
                                }
                                review.mutate({ id: s.id, decision: "reject" });
                              }}
                            >
                              <X className="h-4 w-4" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={Boolean(zoom)} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{zoom?.who ?? "Screenshot"}</DialogTitle>
          </DialogHeader>
          {zoom && (
            <img src={zoom.url} alt="Submitted screenshot, full size" className="max-h-[70vh] w-full rounded-xl object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

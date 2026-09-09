import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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

function AdminSubmissions() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const q = useQuery({ queryKey: ["admin-submissions", status], queryFn: () => listSubmissionsAdmin({ data: { status } }) });

  const review = useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "reject" }) =>
      reviewSubmissionAdmin({ data: { id: v.id, decision: v.decision, note: notes[v.id] || undefined } }),
    onSuccess: (_r, v) => {
      toast.success(v.decision === "approve" ? "Approved and reward credited" : "Submission rejected");
      void qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save that decision"),
  });

  const rows = (q.data ?? []) as Row[];

  return (
    <>
      <PageTitle
        title="Review queue"
        subtitle="Check each screenshot, then approve to credit the reward or reject with a reason."
      />

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter submissions">
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
          </button>
        ))}
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
        <EmptyState title="Nothing here" body="No submissions match this filter right now." />
      ) : (
        <ul className="space-y-4">
          {rows.map((s) => {
            const flags = Array.isArray(s.fraud_flags) ? (s.fraud_flags as string[]) : [];
            const busy = review.isPending && review.variables?.id === s.id;
            const open = s.status === "pending" || s.status === "flagged";
            return (
              <li key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
                <div className="flex flex-col gap-5 sm:flex-row">
                  {s.previewUrl ? (
                    <a href={s.previewUrl} target="_blank" rel="noreferrer" className="shrink-0">
                      <img
                        src={s.previewUrl}
                        alt="Submitted screenshot"
                        loading="lazy"
                        className="h-56 w-full rounded-xl object-cover sm:w-44"
                      />
                    </a>
                  ) : (
                    <div className="h-56 w-full rounded-xl bg-muted sm:w-44" aria-hidden="true" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{s.user?.full_name || s.user?.email || "Member"}</p>
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
                        <dt className="text-muted-foreground">Reward if approved</dt>
                        <dd className="font-medium">{kes(s.activation?.package?.reward_per_post_kes ?? 0)}</dd>
                      </div>
                      <div className="flex justify-between gap-2 sm:block">
                        <dt className="text-muted-foreground">Approved so far</dt>
                        <dd className="font-medium">
                          {s.activation?.approved_posts ?? 0} / {s.activation?.package?.max_rewarded_posts ?? "—"}
                        </dd>
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
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Input
                          aria-label="Review note"
                          maxLength={300}
                          placeholder="Note for the member (optional)"
                          value={notes[s.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Button
                            disabled={busy}
                            onClick={() => review.mutate({ id: s.id, decision: "approve" })}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => review.mutate({ id: s.id, decision: "reject" })}
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </Button>
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
    </>
  );
}

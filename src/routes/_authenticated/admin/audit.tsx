import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageTitle } from "@/components/site/Bits";
import { fmtDate } from "@/lib/format";
import { listAuditAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — StatusReach Admin" },
      { name: "description", content: "Every recorded action across payments, reviews and payouts." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Audit log — StatusReach Admin" },
      { property: "og:description", content: "Every recorded action across the platform." },
    ],
  }),
  component: AdminAudit,
});

type Row = {
  id: string;
  action: string;
  actor_type: string;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  meta: unknown;
  created_at: string;
};

function AdminAudit() {
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: () => listAuditAdmin() });
  const rows = (q.data ?? []) as Row[];

  if (q.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading audit log…</span>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load the audit log</h2>
        <Button className="mt-4" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageTitle title="Audit log" subtitle="A record of every payment, review, payout and settings change." />
      {rows.length === 0 ? (
        <EmptyState title="Nothing logged yet" body="Actions will appear here as the platform is used." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {rows.map((a) => (
            <li key={a.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{a.action}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(a.created_at, true)}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                by {a.actor_type}
                {a.entity_type ? ` · ${a.entity_type}` : ""}
                {a.entity_id ? ` ${a.entity_id}` : ""}
              </p>
              {a.meta && Object.keys(a.meta as object).length > 0 && (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/60 p-2 text-[11px] text-muted-foreground">
                  {JSON.stringify(a.meta, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

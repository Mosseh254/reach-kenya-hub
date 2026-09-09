import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/site/Bits";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { getNotifications, markNotificationsRead } from "@/lib/user.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — StatusReach Kenya" },
      { name: "description", content: "Payment, review, wallet and withdrawal updates." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Notifications — StatusReach Kenya" },
      { property: "og:description", content: "Payment, review and wallet updates." },
    ],
  }),
  component: NotificationsPage,
});

type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const kindLabel: Record<string, string> = {
  payment: "Payment",
  submission: "Submission",
  reward: "Reward",
  withdrawal: "Withdrawal",
  system: "Update",
  referral: "Referral",
};

function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
  });

  const markRead = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <span className="sr-only">Loading your updates…</span>
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load your updates</h2>
        <p className="mt-1 text-sm text-muted-foreground">{friendlyError(error)}</p>
        <Button className="mt-4" onClick={() => void refetch()}>Try again</Button>
      </div>
    );
  }

  const items = (data ?? []) as unknown as Notice[];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <>
      <PageTitle
        title="Notifications"
        subtitle="Payments, screenshot reviews, rewards and withdrawal updates."
        actions={
          unread > 0 ? (
            <Button variant="outline" onClick={() => markRead.mutate()} disabled={markRead.isPending}>
              {markRead.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      {markRead.error && (
        <p role="alert" className="mb-4 text-sm text-destructive">{friendlyError(markRead.error)}</p>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body="We'll let you know when a payment is confirmed, a screenshot is reviewed or a withdrawal is paid out."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={cn(
                "rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5",
                !n.read_at && "border-primary/40 bg-primary/5",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-lg bg-muted p-2 text-primary">
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{n.title}</p>
                    {!n.read_at && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                        New
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{kindLabel[n.kind] ?? "Update"}</span>
                  </div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{fmtDate(n.created_at, true)}</p>
                  {n.link && (
                    <a
                      href={n.link}
                      className="mt-2 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Open details
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

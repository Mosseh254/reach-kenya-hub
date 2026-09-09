import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageTitle } from "@/components/site/Bits";
import { fmtDate, kes } from "@/lib/format";
import { listUsersAdmin, setUserRoleAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users — StatusReach Admin" },
      { name: "description", content: "Search members, view wallets and manage admin access." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Users — StatusReach Admin" },
      { property: "og:description", content: "Search members and manage admin access." },
    ],
  }),
  component: AdminUsers,
});

type Row = {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  roles: string[];
  activeCampaigns: number;
  wallet: { balance_kes: number; lifetime_earned_kes: number } | null;
};

function AdminUsers() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");

  const q = useQuery({ queryKey: ["admin-users", query], queryFn: () => listUsersAdmin({ data: { q: query || undefined } }) });

  const role = useMutation({
    mutationFn: (v: { userId: string; makeAdmin: boolean }) => setUserRoleAdmin({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.makeAdmin ? "Admin access granted" : "Admin access removed");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not change access"),
  });

  const rows = (q.data ?? []) as Row[];

  return (
    <>
      <PageTitle title="Users" subtitle="Search members, check wallets and grant or remove admin access." />

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(term.trim());
        }}
      >
        <Input aria-label="Search members" placeholder="Name, email or phone" value={term} onChange={(e) => setTerm(e.target.value)} />
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" /> Search
        </Button>
      </form>

      {q.isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading members…</span>
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : q.isError ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-semibold">We could not load members</h2>
          <Button className="mt-4" onClick={() => void q.refetch()}>
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No members found" body="Try a different name, email or phone number." />
      ) : (
        <ul className="space-y-3">
          {rows.map((u) => {
            const isAdmin = u.roles.includes("admin");
            const busy = role.isPending && role.variables?.userId === u.user_id;
            return (
              <li key={u.user_id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{u.full_name || u.email || "Member"}</p>
                    {isAdmin && <Badge variant="outline">Admin</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email} {u.phone ? `· ${u.phone}` : ""} · joined {fmtDate(u.created_at)}
                  </p>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{kes(u.wallet?.balance_kes ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">earned {kes(u.wallet?.lifetime_earned_kes ?? 0)}</p>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{u.activeCampaigns}</p>
                  <p className="text-xs text-muted-foreground">active</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => role.mutate({ userId: u.user_id, makeAdmin: !isAdmin })}
                >
                  {isAdmin ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {isAdmin ? "Remove admin" : "Make admin"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle } from "@/components/site/Bits";
import { supabase } from "@/integrations/supabase/client";
import { getMe, updateProfile } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — StatusReach Kenya" },
      { name: "description", content: "Update your name and M-Pesa payout number." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Settings — StatusReach Kenya" },
      { property: "og:description", content: "Update your name and payout number." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me, isLoading, isError, refetch } = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (me) {
      setFullName(me.profile?.full_name ?? "");
      setPhone(me.profile?.phone ?? "");
    }
  }, [me]);

  const save = useMutation({
    mutationFn: () => updateProfile({ data: { full_name: fullName.trim(), phone } }),
    onSuccess: () => {
      toast.success("Your details were saved");
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Could not save";
      toast.error(
        msg.includes("INVALID_PHONE") ? "Enter a valid Kenyan M-Pesa number, for example 0712 345 678." : msg,
      );
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading your settings…</span>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (isError || !me) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-semibold">We could not load your settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Please check your connection and try again.</p>
        <Button className="mt-4" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const nameTooShort = fullName.trim().length > 0 && fullName.trim().length < 2;

  return (
    <>
      <PageTitle title="Settings" subtitle="Your name and the M-Pesa number used for payouts." />

      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (fullName.trim().length < 2) return;
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={me.email ?? ""} readOnly disabled />
            <p className="text-xs text-muted-foreground">Contact support if you need to change your email.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
              aria-invalid={nameTooShort}
              placeholder="Your name as on M-Pesa"
            />
            {nameTooShort && <p className="text-sm text-destructive">Please enter your full name.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">M-Pesa number</Label>
            <Input id="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />
            <p className="text-xs text-muted-foreground">Used for withdrawals. We check the number on our side.</p>
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {me.isAdmin ? "You have admin access on this account." : "Member account."}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </section>
    </>
  );
}

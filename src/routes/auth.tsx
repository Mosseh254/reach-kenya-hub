import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { normalizeKenyanPhone } from "@/lib/format";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
  ref: z.string().max(20).optional(),
  next: z.string().max(200).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Log in or sign up — StatusReach Kenya" },
      { name: "description", content: "Create your StatusReach Kenya account to buy a promotion package, share campaigns and earn verified rewards." },
      { property: "og:title", content: "Log in or sign up — StatusReach Kenya" },
      { property: "og:description", content: "Create your account to start sharing campaigns and earning verified rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "signup");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", ref: search.ref ?? "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: safeNext(search.next), replace: true });
    });
  }, [navigate, search.next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const phone = normalizeKenyanPhone(form.phone);
        if (!phone) throw new Error("Enter a valid Safaricom number, e.g. 0712 345 678.");
        if (form.name.trim().length < 2) throw new Error("Enter your full name.");
        const { error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: form.name.trim(), phone, referral_code: form.ref.trim().toUpperCase() || null },
          },
        });
        if (error) throw error;
        toast.success("Welcome to StatusReach!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (error) throw error;
      }
      navigate({ to: safeNext(search.next), replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    if (form.ref.trim()) sessionStorage.setItem("sr_ref", form.ref.trim().toUpperCase());
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: safeNext(search.next), replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="relative flex h-full flex-col justify-end p-12 text-ink-foreground">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Share. Verify. Earn.</p>
          <h2 className="mt-3 max-w-md text-4xl font-bold leading-tight">Turn your WhatsApp status into verified brand reach.</h2>
          <p className="mt-4 max-w-md text-ink-foreground/70">
            Fixed KES rewards per approved post. Every screenshot is checked by our team before a reward is credited.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="StatusReach Kenya" className="h-9 w-9 rounded-lg" />
            <span className="font-display text-lg font-bold">StatusReach Kenya</span>
          </Link>
          <h1 className="mt-8 text-2xl font-bold">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "Already a member? " : "New here? "}
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
              {mode === "signup" ? "Log in" : "Create an account"}
            </button>
          </p>

          <Button type="button" variant="outline" className="mt-6 w-full" onClick={google} disabled={busy}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/></svg>
            Continue with Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or with email<span className="h-px flex-1 bg-border" /></div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Amina Wanjiru" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">M-Pesa phone</Label>
                  <Input id="phone" required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0712 345 678" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="ref">Referral code <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="ref" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="SR-XXXXXX" />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

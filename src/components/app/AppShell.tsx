import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Gift,
  Home,
  Images,
  LogOut,
  Megaphone,
  Menu,
  Receipt,
  Settings,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { kes } from "@/lib/format";
import { getMe } from "@/lib/user.functions";
import { cn } from "@/lib/utils";

export const meQuery = { queryKey: ["me"], queryFn: () => getMe() };

const userNav = [
  { to: "/dashboard", label: "Overview", icon: Home },
  { to: "/campaigns", label: "My campaigns", icon: Megaphone },
  { to: "/submissions", label: "Submissions", icon: Images },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/orders", label: "Orders", icon: Receipt },
  { to: "/referrals", label: "Referrals", icon: Gift },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const adminNav = [
  { to: "/admin", label: "Admin overview" },
  { to: "/admin/submissions", label: "Review queue" },
  { to: "/admin/withdrawals", label: "Withdrawals" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/settings", label: "Packages & settings" },
  { to: "/admin/audit", label: "Audit log" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useQuery(meQuery);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex items-center gap-2.5 px-5 py-5">
        <img src={logo} alt="" className="h-8 w-8 rounded-lg" />
        <span className="font-display text-base font-bold text-sidebar-foreground">StatusReach</span>
      </Link>
      <div className="mx-4 rounded-xl bg-sidebar-accent/60 p-3">
        <p className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">Available balance</p>
        <p className="font-display text-xl font-bold text-primary">{kes(me?.wallet?.balance_kes ?? 0)}</p>
      </div>
      <nav className="mt-4 flex-1 space-y-0.5 px-3">
        {userNav.map((n) => {
          const active = path === n.to || (n.to !== "/dashboard" && path.startsWith(n.to));
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-foreground",
                active && "bg-sidebar-accent text-sidebar-foreground",
              )}
            >
              <n.icon className="h-4 w-4" />
              <span className="flex-1">{n.label}</span>
              {n.to === "/notifications" && (me?.unreadNotifications ?? 0) > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {me?.unreadNotifications}
                </span>
              )}
            </Link>
          );
        })}
        {me?.isAdmin && (
          <div className="mt-5">
            <p className="flex items-center gap-2 px-3 pb-1 text-[11px] uppercase tracking-wider text-sidebar-foreground/50">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </p>
            {adminNav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  path === n.to && "bg-sidebar-accent text-sidebar-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{me?.profile?.full_name || "Member"}</p>
        <p className="truncate text-xs text-sidebar-foreground/60">{me?.email}</p>
        <Button variant="ghost" size="sm" onClick={signOut} className="mt-3 w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar lg:sticky lg:top-0 lg:block lg:h-screen">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar shadow-glow">
            <button className="absolute right-3 top-4 rounded-md p-1 text-sidebar-foreground" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
          <button className="rounded-md p-2" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display font-bold">StatusReach</span>
          <span className="ml-auto text-sm font-semibold text-primary">{kes(me?.wallet?.balance_kes ?? 0)}</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

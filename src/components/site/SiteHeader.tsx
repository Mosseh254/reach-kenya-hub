import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const nav = [
  { to: "/packages", label: "Packages" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/faq", label: "FAQ" },
];

export function SiteHeader() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="StatusReach Kenya" className="h-9 w-9 rounded-lg" />
          <span className="font-display text-lg font-bold tracking-tight">
            StatusReach <span className="text-primary">Kenya</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="transition-colors hover:text-foreground [&.active]:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {!loading && user ? (
            <Button asChild>
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/auth" search={{ mode: "login" }}>Log in</Link>
              </Button>
              <Button asChild>
                <Link to="/auth" search={{ mode: "signup" }}>Get started</Link>
              </Button>
            </>
          )}
        </div>
        <button
          className="rounded-md p-2 md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                {n.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              {user ? (
                <Button asChild className="flex-1"><Link to="/dashboard">Open dashboard</Link></Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="flex-1"><Link to="/auth" search={{ mode: "login" }}>Log in</Link></Button>
                  <Button asChild className="flex-1"><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

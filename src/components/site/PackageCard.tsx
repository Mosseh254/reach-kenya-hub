import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { kes } from "@/lib/format";
import type { PackageRow } from "@/lib/public.functions";
import { cn } from "@/lib/utils";

export function PackageCard({ pkg, featured, buyTo }: { pkg: PackageRow; featured?: boolean; buyTo?: "auth" | "buy" }) {
  const features = Array.isArray(pkg.features) ? (pkg.features as string[]) : [];
  return (
    <div className={cn("relative flex flex-col rounded-3xl border bg-card p-7 shadow-soft", featured ? "border-primary ring-2 ring-primary/30" : "border-border")}>
      {featured && <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Most popular</span>}
      <h3 className="font-display text-xl font-bold">{pkg.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{pkg.tagline}</p>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="font-display text-4xl font-bold">{kes(pkg.price_kes)}</span>
        <span className="text-sm text-muted-foreground">/ {pkg.duration_days} days</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">One-off package fee</p>
      <ul className="mt-5 flex-1 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{f}</li>
        ))}
      </ul>
      <Button asChild className="mt-6" variant={featured ? "default" : "outline"}>
        {buyTo === "buy" ? (
          <Link to="/buy/$packageId" params={{ packageId: pkg.id }}>Buy {pkg.name}</Link>
        ) : (
          <Link to="/auth" search={{ mode: "signup" }}>Get {pkg.name}</Link>
        )}
      </Button>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">Rewards depend on verification. Not guaranteed.</p>
    </div>
  );
}

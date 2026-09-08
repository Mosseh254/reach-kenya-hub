import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="" className="h-9 w-9 rounded-lg" />
            <span className="font-display text-lg font-bold">StatusReach Kenya</span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-foreground/70">
            Buy a promotion package, share approved brand material on your WhatsApp status, upload proof, and earn
            a fixed reward for every post our team verifies. Rewards are conditional on verification — this is not
            an investment or a game of chance.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-ink-foreground/60">Platform</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/packages" className="hover:text-primary">Packages</Link></li>
            <li><Link to="/how-it-works" className="hover:text-primary">How it works</Link></li>
            <li><Link to="/faq" className="hover:text-primary">FAQ</Link></li>
            <li><Link to="/auth" search={{ mode: "signup" }} className="hover:text-primary">Create account</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-ink-foreground/60">Legal</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/terms" className="hover:text-primary">Terms of service</Link></li>
            <li><Link to="/privacy" className="hover:text-primary">Privacy policy</Link></li>
            <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-foreground/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-ink-foreground/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} StatusReach Kenya. Nairobi, Kenya.</span>
          <span>Demo advertiser content is illustrative. Shopit Kenya is an independent retailer.</span>
        </div>
      </div>
    </footer>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — StatusReach Kenya" },
      { name: "description", content: "Share your referral code and track referral bonuses." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Referrals — StatusReach Kenya" },
      { property: "og:description", content: "Share your referral code and track bonuses." },
    ],
  }),
  component: () => <Placeholder title="Referrals" subtitle="Your referral code and bonuses." />,
});

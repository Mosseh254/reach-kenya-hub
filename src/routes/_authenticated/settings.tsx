import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

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
  component: () => <Placeholder title="Settings" subtitle="Your name and M-Pesa payout number." />,
});

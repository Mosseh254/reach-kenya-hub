import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — StatusReach Kenya" },
      { name: "description", content: "Operations overview for reviews, payouts and campaigns." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin overview — StatusReach Kenya" },
      { property: "og:description", content: "Operations overview for reviews and payouts." },
    ],
  }),
  component: () => <Placeholder title="Admin overview" subtitle="Reviews, payouts and campaign operations." />,
});

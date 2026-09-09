import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — StatusReach Kenya" },
      { name: "description", content: "Payment, review, wallet and withdrawal updates." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Notifications — StatusReach Kenya" },
      { property: "og:description", content: "Payment, review and wallet updates." },
    ],
  }),
  component: () => <Placeholder title="Notifications" subtitle="Payment, review and wallet updates." />,
});

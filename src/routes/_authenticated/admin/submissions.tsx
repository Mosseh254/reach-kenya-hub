import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/admin/submissions")({
  head: () => ({
    meta: [
      { title: "Review queue — StatusReach Kenya" },
      { name: "description", content: "Review screenshot submissions and approve rewards." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Review queue — StatusReach Kenya" },
      { property: "og:description", content: "Review submissions and approve rewards." },
    ],
  }),
  component: () => <Placeholder title="Review queue" subtitle="Screenshot review and reward decisions." />,
});

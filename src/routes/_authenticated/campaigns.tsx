import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({
    meta: [
      { title: "My campaigns — StatusReach Kenya" },
      { name: "description", content: "Your active campaigns, materials and posting rules." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "My campaigns — StatusReach Kenya" },
      { property: "og:description", content: "Your active campaigns and materials." },
    ],
  }),
  component: () => <Placeholder title="My campaigns" subtitle="Campaign materials and daily posting rules." />,
});

import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Packages & settings — StatusReach Admin" },
      { name: "description", content: "Manage package tiers, rewards and platform settings." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Packages & settings — StatusReach Admin" },
      { property: "og:description", content: "Manage package tiers and platform settings." },
    ],
  }),
  component: () => <Placeholder title="Packages & settings" subtitle="Package tiers, rewards and platform settings." />,
});

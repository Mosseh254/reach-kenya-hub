import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users — StatusReach Kenya" },
      { name: "description", content: "Search members and manage roles." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Users — StatusReach Kenya" },
      { property: "og:description", content: "Search members and manage roles." },
    ],
  }),
  component: () => <Placeholder title="Users" subtitle="Member search and role management." />,
});

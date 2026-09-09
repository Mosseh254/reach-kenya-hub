import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders — StatusReach Admin" },
      { name: "description", content: "All package purchases and payment outcomes." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Orders — StatusReach Admin" },
      { property: "og:description", content: "All package purchases and payment outcomes." },
    ],
  }),
  component: () => <Placeholder title="Orders" subtitle="All package purchases and payment outcomes." />,
});

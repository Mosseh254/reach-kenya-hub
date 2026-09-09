import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({
    meta: [
      { title: "Orders — StatusReach Kenya" },
      { name: "description", content: "Your package purchases and payment history." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Orders — StatusReach Kenya" },
      { property: "og:description", content: "Package purchases and payment history." },
    ],
  }),
  component: () => <Placeholder title="Orders" subtitle="Package purchases and payment history." />,
});

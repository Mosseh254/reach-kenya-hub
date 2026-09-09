import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  head: () => ({
    meta: [
      { title: "Withdrawals — StatusReach Kenya" },
      { name: "description", content: "Process member withdrawal requests." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Withdrawals — StatusReach Kenya" },
      { property: "og:description", content: "Process member withdrawal requests." },
    ],
  }),
  component: () => <Placeholder title="Withdrawals" subtitle="Member payout requests." />,
});

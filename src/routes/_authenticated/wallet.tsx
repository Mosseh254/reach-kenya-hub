import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — StatusReach Kenya" },
      { name: "description", content: "Your reward balance, transactions and withdrawal requests." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Wallet — StatusReach Kenya" },
      { property: "og:description", content: "Reward balance, transactions and withdrawals." },
    ],
  }),
  component: () => <Placeholder title="Wallet" subtitle="Reward balance, transactions and withdrawals." />,
});

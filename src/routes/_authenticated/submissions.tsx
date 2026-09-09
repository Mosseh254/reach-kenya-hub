import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/submissions")({
  head: () => ({
    meta: [
      { title: "Submissions — StatusReach Kenya" },
      { name: "description", content: "Upload daily screenshots and follow their review status." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Submissions — StatusReach Kenya" },
      { property: "og:description", content: "Upload screenshots and follow review status." },
    ],
  }),
  component: () => <Placeholder title="Submissions" subtitle="Daily screenshot uploads and review results." />,
});

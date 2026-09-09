import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/app/Placeholder";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — StatusReach Admin" },
      { name: "description", content: "Every sensitive action recorded on the server." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Audit log — StatusReach Admin" },
      { property: "og:description", content: "Every sensitive action recorded on the server." },
    ],
  }),
  component: () => <Placeholder title="Audit log" subtitle="Server-recorded sensitive actions." />,
});

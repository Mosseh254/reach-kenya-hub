import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — StatusReach Kenya" },
      { name: "description", content: "Get in touch with the StatusReach Kenya support team." },
      { property: "og:title", content: "Contact — StatusReach Kenya" },
      { property: "og:description", content: "Support, partnerships and data requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Contact us" updated="8 September 2026">
      <p>Support hours: Monday to Saturday, 8:00 – 18:00 EAT.</p>
      <ul>
        <li>Member support: support@statusreach.co.ke</li>
        <li>Advertisers & partnerships: brands@statusreach.co.ke</li>
        <li>Data protection requests: privacy@statusreach.co.ke</li>
      </ul>
      <p>Signed-in members can also reply to any notification inside the dashboard — our reviewers see those first.</p>
    </LegalPage>
  ),
});

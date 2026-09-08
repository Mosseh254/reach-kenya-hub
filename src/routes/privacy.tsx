import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — StatusReach Kenya" },
      { name: "description", content: "How StatusReach Kenya collects, uses and protects your personal data under the Kenya Data Protection Act, 2019." },
      { property: "og:title", content: "Privacy policy — StatusReach Kenya" },
      { property: "og:description", content: "How we handle your data under the Kenya Data Protection Act." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Privacy policy" updated="8 September 2026">
      <p>We process personal data in line with the Kenya Data Protection Act, 2019.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account data: name, email, M-Pesa phone number, referral code.</li>
        <li>Payment data: M-Pesa transaction references and receipts (never your PIN).</li>
        <li>Submissions: screenshots you upload, file hashes, timestamps and review outcomes.</li>
        <li>Technical data: device and usage information needed to run and secure the service.</li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To activate campaigns, verify posts, credit rewards and process withdrawals.</li>
        <li>To detect fraud, including duplicate screenshots and multiple accounts.</li>
        <li>To send you service notifications about payments, reviews and payouts.</li>
      </ul>
      <h2>Sharing</h2>
      <p>Screenshots are visible to our reviewers only. Advertisers receive aggregated campaign statistics, never your contact details. We share data with Safaricom solely to process M-Pesa payments.</p>
      <h2>Retention</h2>
      <p>Screenshots are retained for 12 months for dispute resolution, then deleted. Financial records are retained as required by law.</p>
      <h2>Your rights</h2>
      <p>You may access, correct or request deletion of your data, and lodge a complaint with the Office of the Data Protection Commissioner. Contact us via the Contact page.</p>
    </LegalPage>
  ),
});

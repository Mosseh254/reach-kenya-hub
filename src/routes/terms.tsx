import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/PublicLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of service — StatusReach Kenya" },
      { name: "description", content: "Terms governing StatusReach Kenya packages, campaign participation, verification, rewards and withdrawals." },
      { property: "og:title", content: "Terms of service — StatusReach Kenya" },
      { property: "og:description", content: "Terms governing packages, verification, rewards and withdrawals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Terms of service" updated="8 September 2026">
      <h2>1. The service</h2>
      <p>StatusReach Kenya ("we") operates a digital marketing platform that lets registered members purchase promotion packages, share approved advertiser material on their WhatsApp status and earn fixed rewards for engagement that we verify. The service is a marketing service. It is not a financial product, investment, savings scheme, lottery or betting service.</p>
      <h2>2. Eligibility</h2>
      <p>You must be at least 18 years old, resident in Kenya and hold an active Safaricom M-Pesa line registered in your own name.</p>
      <h2>3. Packages and fees</h2>
      <ul>
        <li>A package is a one-off purchase that unlocks a campaign for the number of days shown at checkout.</li>
        <li>The package fee pays for campaign access and review services. It is not a deposit and is not returned as rewards.</li>
        <li>Campaign windows are timed on our servers from the moment payment is confirmed.</li>
      </ul>
      <h2>4. Rewards</h2>
      <ul>
        <li>Rewards are a fixed KES amount per approved post, capped per package as shown before purchase.</li>
        <li>A post is rewarded only after our reviewers verify the uploaded screenshot. Declined posts earn nothing.</li>
        <li>You may upload one screenshot per campaign per day. Duplicate, edited, cropped or off-brief material will be declined and may lead to account suspension.</li>
      </ul>
      <h2>5. Wallet and withdrawals</h2>
      <p>Approved rewards are credited to an in-app wallet. Withdrawals are paid to your registered M-Pesa number once you reach the published minimum. Amounts requested are held until processed. We may decline or reverse payouts where fraud is suspected.</p>
      <h2>6. Referrals</h2>
      <p>Where enabled, referral bonuses are paid once, when a referred member completes their first paid package. Self-referral and referral farming are prohibited.</p>
      <h2>7. Acceptable use</h2>
      <p>You agree not to alter advertiser material, misrepresent reach, use automation or multiple accounts, or submit fabricated screenshots.</p>
      <h2>8. Suspension and termination</h2>
      <p>We may suspend accounts that breach these terms. Legitimately earned balances remain withdrawable unless they arise from the breach.</p>
      <h2>9. Liability</h2>
      <p>To the extent permitted by Kenyan law, our liability is limited to the package fees you paid in the preceding three months.</p>
      <h2>10. Governing law</h2>
      <p>These terms are governed by the laws of the Republic of Kenya.</p>
    </LegalPage>
  ),
});

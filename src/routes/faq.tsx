import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  ["Is the package fee refundable?", "Package fees pay for campaign access and review services for the stated number of days. They are not refundable once the campaign is activated, except where required by Kenyan consumer law."],
  ["How much can I earn?", "Each package shows a fixed reward per approved post and a maximum number of rewarded posts. Nothing beyond that schedule is promised, and posts that fail verification earn nothing."],
  ["Why was my screenshot declined?", "Common reasons: the campaign image or caption was altered, the status wasn't visible, the screenshot duplicated an earlier upload, or it was submitted after the campaign expired. The reviewer's note explains the decision."],
  ["When does my campaign expire?", "Expiry is calculated on our servers from the moment payment is confirmed. Changing the clock on your phone has no effect."],
  ["How do withdrawals work?", "Request a withdrawal from your wallet once you reach the minimum. The amount is held while our team processes the M-Pesa payout, normally within 1–2 business days."],
  ["Is this an investment or betting?", "No. StatusReach is a marketing service. You buy a promotion package and earn fixed rewards for verified sharing. There is no return on money, no odds and no chance element."],
  ["Which payment methods are supported?", "M-Pesa STK push. During development the platform runs a clearly labelled sandbox that simulates payments without moving money."],
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — StatusReach Kenya" },
      { name: "description", content: "Answers about StatusReach Kenya packages, rewards, verification, expiry, withdrawals and payments." },
      { property: "og:title", content: "FAQ — StatusReach Kenya" },
      { property: "og:description", content: "Everything about packages, verification and M-Pesa payouts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }),
    }],
  }),
  component: () => (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm font-semibold text-primary">FAQ</p>
        <h1 className="mt-2 text-4xl font-bold">Frequently asked questions</h1>
        <Accordion type="single" collapsible className="mt-10">
          {faqs.map(([q, a]) => (
            <AccordionItem key={q} value={q!}>
              <AccordionTrigger className="text-left font-semibold">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </PublicLayout>
  ),
});

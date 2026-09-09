# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Payments — IntaSend M-Pesa (live)

Live M-Pesa collection runs through IntaSend. Required backend secrets:

| Secret | Purpose |
| --- | --- |
| `INTASEND_PUBLISHABLE_KEY` | `ISPubKey_live_...` (or `ISPubKey_test_...`) |
| `INTASEND_SECRET_KEY` | `ISSecretKey_live_...` (or `ISSecretKey_test_...`) |
| `INTASEND_WEBHOOK_CHALLENGE` | challenge string configured on the IntaSend webhook |
| `INTASEND_ENV` | optional override: `live` or `test` (inferred from the key otherwise) |

Webhook URL to register in the IntaSend dashboard (Payments → Webhooks):

```
https://project--aeca5134-ae22-4469-a255-a0e34708cd88.lovable.app/api/public/intasend/webhook
```

Flow: `createOrder` starts an STK push (`src/lib/payments/intasend.server.ts`), the
webhook (`src/routes/api/public/intasend/webhook.ts`) and the order status page both
settle the order through `settleIntasendOrder`, which re-reads the invoice from
IntaSend and calls `confirm_order_paid` / `fail_order`. Settlement is idempotent and
the amount is verified server-side.

When no IntaSend keys are present the app falls back to the mock sandbox adapter
(no money moves); legacy Daraja credentials are still honoured if `MPESA_MODE=daraja`.

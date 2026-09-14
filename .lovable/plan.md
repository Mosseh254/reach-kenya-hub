# Diagnose production token verification

## Goal
Keep Vercel hosting and all existing protected pages unchanged while making server authentication authoritative and diagnosable.

## Changes
- Replace the `getClaims()`-first flow with a dedicated server authentication client that verifies the bearer token using `auth.getUser(token)`.
- Keep the authenticated database client separate, preserving the user access token for row-level security queries.
- Add safe structured server logs that distinguish token verification failure, post-verification database failure, and downstream server-function failure.
- Log only error metadata and a boolean indicating whether the token issuer matches the configured backend; never log tokens, headers, keys, passwords, or other credentials.
- Preserve the existing bearer-token attachment in `src/start.ts`, all protected middleware, Vercel environment-variable names, DNS, hosting, and backend configuration.

## Verification
- Run focused authentication middleware tests with mocked successful and failed verification/database responses.
- Confirm the project compiles and the preview build remains healthy.
- Report any concrete safe error available locally; production-only details will appear in Vercel logs after deployment.

## Technical detail
The verification client will use the standard SDK request path, while the database client will use a narrow fetch wrapper that ensures `apikey` is the publishable key and `Authorization` remains the member's bearer token. The wrapper will inspect failed database responses only through cloned response bodies and log sanitized fields.

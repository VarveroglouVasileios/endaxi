# Production security checklist

## Secrets and environment

- Rotate every credential that has appeared in chat, logs, screenshots, or shell output.
- Store secrets in Azure App Service Application Settings, preferably backed by
  Azure Key Vault references; never in Git or `NUXT_PUBLIC_*`.
- Use a unique `BETTER_AUTH_SECRET` of at least 32 random bytes.
- Set `NUXT_PUBLIC_APP_URL` to the final credential-free `https://` origin.
- Keep preview, staging, and production credentials separate.

## Upstash Redis

- Create the Redis database in an EU region.
- Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Restrict dashboard access with MFA and least privilege.
- Alert on unusual rate-limit volume and Redis failures.
- Do not replace the HMAC identifiers with raw email addresses or IPs.

## Hosting and network

- Deployment target is Azure App Service (Azure for Students), not Vercel.
  Set `TRUST_AZURE_PROXY=1` in production so rate limiting and session IP
  audit trail read the real client IP from Azure's front-end proxy instead
  of falling back to the internal load-balancer IP.
- Do not set `VERCEL` or `TRUST_CLOUDFLARE_PROXY`; production startup rejects
  proxy modes that do not match Azure App Service.
- Use the Linux Node 22 stack and start the built application with `pnpm start`
  (`node .output/server/index.mjs`).
- Enable HTTPS Only, Always On, and configure the Health Check path as `/api/health`.
- Use a pooled PostgreSQL URL and set `DATABASE_POOL_MAX` so that
  `maximum instances × pool max` stays below the provider's connection limit.
- Keep HTTPS-only redirects enabled and verify HSTS after the final domain is live.
- Verify CSP, SRI, CORS, frame protection, and no-store headers on the deployed origin.

## Authentication and email

- Verify the sending domain in Resend and use an address on that domain in `EMAIL_FROM`.
- Keep email verification required and test sign-up, resend, expiry, and password reset in production.
- Monitor verification/password-reset abuse without logging tokens or message contents.
- Review active sessions after rotating `BETTER_AUTH_SECRET`; rotation invalidates existing sessions.

## Inngest, Groq, and R2

- Configure separate production `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`.
- Register `https://<production-origin>/api/inngest` in Inngest and set
  `INNGEST_MAX_RUNTIME` below the App Service HTTP timeout.
- Never set `INNGEST_DEV=1` in production.
- Configure Groq spending limits/alerts and complete Data Controls/DPA review.
- Keep the R2 bucket private; disable public listing and public object access.
- Scope R2 credentials to the single required bucket and rotate previously shared keys.
- Confirm signed download URLs expire and that R2 access logs do not retain sensitive URLs longer than necessary.

## Database and operations

- Use PostgreSQL in an EU region with TLS required.
- Enable encrypted backups, point-in-time recovery, and restore drills.
- Restrict database network access and use a least-privilege application role.
- Centralize structured logs and alerts without storing iCal URLs, auth tokens, chat text, or secrets.
- Alert on repeated 401/403/429/503 responses, iCal failures, and unusual document downloads.

## Release gate

- Run `pnpm install --frozen-lockfile`.
- Run `pnpm audit --prod --audit-level moderate`.
- Run `pnpm verify` with the test PostgreSQL database available.
- Run `pnpm build`.
- Verify the deployed site in a real browser with zero CSP/hydration errors.
- Have the privacy policy, terms, retention schedule, and subprocessors reviewed by a qualified lawyer.

# Deploy to Azure App Service

## App Service

- Linux Web App with the Node 22 runtime.
- Build command: `pnpm install --frozen-lockfile && pnpm build`.
- Startup command: `pnpm start`.
- Enable **HTTPS Only** and **Always On**.
- Set the Health Check path to `/api/health`.
- Deploy to the EU region selected for the application's privacy commitments.

Nitro uses the `node-server` preset and listens on the `PORT` supplied by Azure.

## Application settings

Copy the variables from `.env.example` into App Service **Application settings**.
Keep all secrets outside Git and use Key Vault references where possible.

Production-specific values:

```text
NODE_ENV=production
NUXT_PUBLIC_APP_URL=https://<final-domain>
TRUST_AZURE_PROXY=1
DATABASE_POOL_MAX=5
INNGEST_MAX_RUNTIME=180s
```

Do not set `VERCEL`, `TRUST_CLOUDFLARE_PROXY`, or `INNGEST_DEV`.

Use a pooled PostgreSQL connection string. Ensure:

```text
maximum App Service instances × DATABASE_POOL_MAX < provider connection limit
```

## Database and external services

1. Run `pnpm db:migrate` once as a release step, before shifting production traffic.
   Do not run migrations independently from every App Service instance.
2. Register `https://<final-domain>/api/inngest` in Inngest.
3. Verify the Resend sending domain and `EMAIL_FROM`.
4. Keep the Cloudflare R2 bucket private and scope its credentials to that bucket.
5. Keep Upstash and the PostgreSQL database in an EU region.

## Release verification

```bash
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level moderate
pnpm typecheck
pnpm typecheck:test
pnpm test
pnpm build
```

After deployment, verify `/api/health`, authentication redirects, email verification,
Inngest sync, CSP/security headers, and browser console/network logs on the final origin.

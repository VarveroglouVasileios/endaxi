const REQUIRED_PRODUCTION_ENV = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'NUXT_PUBLIC_APP_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'INNGEST_EVENT_KEY',
  'INNGEST_SIGNING_KEY',
  'GROQ_API_KEY',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'TRUST_AZURE_PROXY',
] as const

export default defineNitroPlugin(() => {
  /**
   * ΒΡΕΘΗΚΕ ΣΕ SECURITY AUDIT: fail-OPEN pattern. Το παλιό `!== 'production'`
   * παρέκαμπτε ΟΛΟΥΣ τους ελέγχους για ΟΠΟΙΑΔΗΠΟΤΕ τιμή του NODE_ENV εκτός
   * από ακριβώς 'production' — δηλαδή undefined, typo, 'staging', άδειο
   * string, ή ένα hosting platform που απλά ξέχασε να το ορίσει, όλα
   * σιωπηλά παρέκαμπταν την επαλήθευση secrets/HTTPS/proxy-trust σε ένα
   * deployment που ΣΤΗΝ ΠΡΑΞΗ σερβίρει πραγματική κίνηση.
   *
   * Fix: allowlist αντί για blocklist. Μόνο οι ρητά «ασφαλείς για
   * παράλειψη» τιμές (development/test) παρακάμπτουν τον έλεγχο — οτιδήποτε
   * άλλο (συμπεριλαμβανομένου του undefined) τον ενεργοποιεί by default.
   */
  const skippableEnvs = new Set(['development', 'test'])
  if (skippableEnvs.has(process.env.NODE_ENV ?? '')) return

  const missing = REQUIRED_PRODUCTION_ENV.filter(name => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`)
  }

  if ((process.env.BETTER_AUTH_SECRET?.length ?? 0) < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters')
  }

  const appUrl = new URL(process.env.NUXT_PUBLIC_APP_URL!)
  if (appUrl.protocol !== 'https:' || appUrl.username || appUrl.password) {
    throw new Error('NUXT_PUBLIC_APP_URL must be a credential-free HTTPS URL')
  }

  if (process.env.INNGEST_DEV === '1') {
    throw new Error('INNGEST_DEV cannot be enabled in production')
  }

  if (process.env.TRUST_AZURE_PROXY !== '1') {
    throw new Error('TRUST_AZURE_PROXY must be set to 1 on Azure App Service')
  }

  if (process.env.VERCEL || process.env.TRUST_CLOUDFLARE_PROXY === '1') {
    throw new Error('Vercel and Cloudflare proxy trust must not be enabled on Azure App Service')
  }

  const databasePoolMax = Number(process.env.DATABASE_POOL_MAX ?? '5')
  if (!Number.isSafeInteger(databasePoolMax) || databasePoolMax < 1 || databasePoolMax > 50) {
    throw new Error('DATABASE_POOL_MAX must be an integer between 1 and 50')
  }
})

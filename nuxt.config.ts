import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-01',
  devtools: { enabled: true },

  // Nuxt 4: το `app/` + `server/` είναι πλέον το default layout — δεν
  // χρειάζεται ούτε `srcDir` ούτε `future.compatibilityVersion`.

  // Tailwind v4 μέσω Vite plugin — το @nuxtjs/tailwindcss είναι για v3
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },

  typescript: {
    strict: true,
    typeCheck: false, // run separately via `npm run typecheck`
  },

  runtimeConfig: {
    // Server-only — never exposed to client
    databaseUrl: process.env.DATABASE_URL,
    inngestSigningKey: process.env.INNGEST_SIGNING_KEY,
    inngestEventKey: process.env.INNGEST_EVENT_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    postmarkServerToken: process.env.POSTMARK_SERVER_TOKEN,
    resendApiKey: process.env.RESEND_API_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    r2AccountId: process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    r2Bucket: process.env.R2_BUCKET,

    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
      posthogKey: process.env.NUXT_PUBLIC_POSTHOG_KEY,
      posthogHost: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
    },
  },

  nitro: {
    // EU region for GDPR simplicity
    preset: process.env.NITRO_PRESET || 'node-server',
    experimental: {
      tasks: true,
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'el' },
      title: 'Εντάξει — Είσαι εντάξει με την ΑΑΔΕ',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Το ΤΑΚΚ σου εκδίδεται μόνο του κάθε μήνα. Συνδέεις το ημερολόγιό σου μία φορά και δεν ξανασχολείσαι.',
        },
      ],
    },
  },
})

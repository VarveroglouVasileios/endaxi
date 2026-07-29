import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-01',
  devtools: { enabled: true },
  modules: ['nuxt-security'],

  security: {
    nonce: true,
    sri: true,
    corsHandler: false,
    rateLimiter: false,
    requestSizeLimiter: false,
    xssValidator: false,
    removeLoggers: false,
    hidePoweredBy: true,
    ssg: {
      meta: true,
      hashScripts: true,
      hashStyles: false,
    },
    headers: {
      contentSecurityPolicy: {
        'default-src': ['\'self\''],
        'base-uri': ['\'none\''],
        'object-src': ['\'none\''],
        'frame-ancestors': ['\'none\''],
        'form-action': ['\'self\''],
        'script-src': ['\'self\'', '\'strict-dynamic\'', '\'nonce-{{nonce}}\''],
        'script-src-attr': ['\'none\''],
        'style-src': ['\'self\'', '\'unsafe-inline\''],
        'img-src': ['\'self\'', 'data:', 'blob:'],
        'font-src': ['\'self\'', 'data:'],
        'connect-src': ['\'self\''],
        'manifest-src': ['\'self\''],
        'upgrade-insecure-requests': true,
      },
      permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
      },
      referrerPolicy: 'strict-origin-when-cross-origin',
      xFrameOptions: 'DENY',
      strictTransportSecurity: {
        maxAge: 63_072_000,
        includeSubdomains: true,
        preload: true,
      },
    },
  },

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

  routeRules: {
    '/': { prerender: true },
    '/oroi': {
      prerender: true,
      headers: { 'X-Robots-Tag': 'noindex, follow' },
    },
    '/aporrito': {
      prerender: true,
      headers: { 'X-Robots-Tag': 'noindex, follow' },
    },
    '/cookies': {
      prerender: true,
      headers: { 'X-Robots-Tag': 'noindex, follow' },
    },
    '/login': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'private, no-store',
      },
    },
    '/register': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'private, no-store',
      },
    },
    '/forgot-password': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'private, no-store',
      },
    },
    '/reset-password': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    },
    '/app': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'private, no-store',
      },
    },
    '/app/**': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'private, no-store',
      },
    },
    '/onboarding': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'private, no-store',
      },
    },
    '/onboarding/**': {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'private, no-store',
      },
    },
    '/api/**': { headers: { 'Cache-Control': 'private, no-store' } },
  },

  runtimeConfig: {
    // Server-only — never exposed to client
    databaseUrl: process.env.DATABASE_URL,
    inngestSigningKey: process.env.INNGEST_SIGNING_KEY,
    inngestEventKey: process.env.INNGEST_EVENT_KEY,
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    resendApiKey: process.env.RESEND_API_KEY,
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
    // Azure App Service runs the generated long-lived Node server.
    preset: process.env.NITRO_PRESET || 'node-server',
    compressPublicAssets: true,
    experimental: {
      tasks: true,
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'el' },
      title: 'Endaxi — Οργάνωση παραστατικών ΤΑΚΚ',
      link: [
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0f766e' },
        {
          name: 'description',
          content:
            'Οργάνωση διαμονών και παραστατικών ΤΑΚΚ για ιδιοκτήτες βραχυχρόνιας μίσθωσης.',
        },
      ],
    },
  },
})

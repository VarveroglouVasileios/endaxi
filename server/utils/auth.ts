/**
 * AUTHENTICATION — Better Auth
 *
 * Γιατί self-hosted και όχι Clerk/Auth0: ο πίνακας `users` κουβαλάει
 * τα `taxRegime`, `declaredPropertyCount`, `regimeDeclaredAt/Ip` —
 * **το νομικό audit trail του gate**. Δεν το βάζουμε σε βάση τρίτου.
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import {
  isStrongPassword,
  isValidEmail,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '#shared/auth-validation'
import { useDatabase } from '../database/client'
import * as schema from '../database/schema'
import { sendEmailVerificationEmail } from './email/email-verification'
import { sendPasswordResetEmail } from './email/password-reset'
import {
  checkRateLimits,
  createRateLimitIdentifier,
  EMAIL_VERIFICATION_EMAIL_RULE,
} from './rate-limit'
import { TRUSTED_CLIENT_IP_HEADER } from './request-ip'

const trustedIpHeaders = process.env.TRUST_AZURE_PROXY === '1'
  ? [TRUSTED_CLIENT_IP_HEADER]
  : []

/**
 * Το `betterAuth()` επιστρέφει `Auth<TOptions>` — γενικευμένο στο ΔΙΚΟ ΜΑΣ
 * options object (μαζί με τα `additionalFields`). Αν δηλώσουμε τη μεταβλητή
 * ως `ReturnType<typeof betterAuth>` παίρνουμε `Auth<BetterAuthOptions>`,
 * που είναι άλλος τύπος → TS2322. Άρα: εξάγουμε τη δημιουργία σε function
 * και αφήνουμε το TypeScript να συμπεράνει.
 */
function createAuth() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
      throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters in production')
    }
    if (!process.env.NUXT_PUBLIC_APP_URL?.startsWith('https://')) {
      throw new Error('NUXT_PUBLIC_APP_URL must be an HTTPS URL in production')
    }
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is required for email verification in production')
    }
  }

  return betterAuth({
    database: drizzleAdapter(useDatabase(), {
      provider: 'pg',
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),

    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.NUXT_PUBLIC_APP_URL ?? 'http://localhost:3000',

    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        const [emailLimit] = await checkRateLimits(
          [EMAIL_VERIFICATION_EMAIL_RULE],
          createRateLimitIdentifier(`email:${user.email.trim().toLowerCase()}`),
        )
        if (!emailLimit?.success) throw new Error('EMAIL_VERIFICATION_RATE_LIMITED')
        await sendEmailVerificationEmail(user.email, url)
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail(user.email, url)
      },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email') {
          const email = typeof ctx.body?.email === 'string' ? ctx.body.email : ''
          const password = typeof ctx.body?.password === 'string' ? ctx.body.password : ''

          if (!isValidEmail(email)) {
            throw new APIError('BAD_REQUEST', {
              message: 'Συμπλήρωσε μια έγκυρη διεύθυνση email.',
            })
          }

          if (!isStrongPassword(password)) {
            throw new APIError('BAD_REQUEST', {
              message: 'Ο κωδικός δεν πληροί όλους τους κανόνες ασφαλείας.',
            })
          }
        }

        if (ctx.path === '/reset-password') {
          const password =
            typeof ctx.body?.newPassword === 'string' ? ctx.body.newPassword : ''

          if (!isStrongPassword(password)) {
            throw new APIError('BAD_REQUEST', {
              message: 'Ο κωδικός δεν πληροί όλους τους κανόνες ασφαλείας.',
            })
          }
        }
      }),
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 μέρες
      updateAge: 60 * 60 * 24, // ανανέωση κάθε μέρα
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },

    advanced: {
      // uuid αντί για το default text id — ταιριάζει με το schema μας
      database: { generateId: () => crypto.randomUUID() },
      cookiePrefix: 'endaxi',
      useSecureCookies: process.env.NODE_ENV === 'production',

      /**
       * Χωρίς αυτό, το Better Auth προειδοποιεί σε production ότι δεν
       * βρίσκει IP και βάζει ΟΛΟΥΣ τους χρήστες σε έναν κοινό κουβά
       * rate limiting — δηλαδή ένας επιτιθέμενος κλειδώνει όλους,
       * και κανένα brute-force δεν περιορίζεται ανά διεύθυνση.
       *
       * Εμπιστευόμαστε proxy header μόνο όταν ξέρουμε ποιος proxy το
       * αντικαθιστά. Διαφορετικά ένας client μπορεί να πλαστογραφήσει IP.
       */
      ipAddress: {
        ipAddressHeaders: trustedIpHeaders,
      },
    },

    user: {
      /**
       * Τα επιχειρησιακά πεδία ζουν ΜΑΖΙ με τον χρήστη.
       * Δεν επιτρέπουμε στον client να τα θέτει κατευθείαν —
       * περνούν από τα API routes που κρατούν audit trail.
       */
      additionalFields: {
        afm: { type: 'string', required: false, input: false },
        phone: { type: 'string', required: false, input: false },
        locale: { type: 'string', required: false, defaultValue: 'el', input: false },
        declaredPropertyCount: {
          type: 'number',
          required: false,
          defaultValue: 1,
          input: false,
        },
        taxRegime: {
          type: 'string',
          required: false,
          defaultValue: 'individual_upto_2',
          input: false,
        },
      },
    },
  })
}

let _auth: ReturnType<typeof createAuth> | null = null

/** Lazy singleton — η βάση δεν πρέπει να ανοίγει στο import time. */
export function useAuth() {
  return (_auth ??= createAuth())
}

export type Auth = ReturnType<typeof useAuth>

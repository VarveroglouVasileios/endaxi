import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_APP_URL ?? undefined,
})

export const { signIn, signUp, signOut, useSession } = authClient

import { createAuthClient } from 'better-auth/vue'

// Χωρίς explicit baseURL: το Better Auth χρησιμοποιεί πάντα το ίδιο origin
// με τη σελίδα και δεν μπορεί να στραφεί κατά λάθος σε διαφορετικό host.
export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession } = authClient

import { authClient } from '~/lib/auth-client'

/**
 * Προστασία σελίδων. Χρήση: `definePageMeta({ middleware: 'auth' })`
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.useSession(useFetch)

  if (!session.value) {
    return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)
  }
})

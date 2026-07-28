import { useAuth } from '../../utils/auth'

/** Όλα τα endpoints του Better Auth: /api/auth/sign-in, sign-up, sign-out κλπ. */
export default defineEventHandler((event) => {
  return useAuth().handler(toWebRequest(event))
})

/**
 * ΚΑΝΟΝΙΚΟ HOST — redirect σε mismatched Host (π.χ. www. vs apex domain).
 *
 * ΒΡΕΘΗΚΕ ΣΕ SECURITY AUDIT: το Better Auth baseURL, το Origin allowlist
 * του CSRF middleware (01.origin.ts) και το Origin check του help chat
 * ΟΛΑ παράγονται από ΤΟ ΙΔΙΟ `NUXT_PUBLIC_APP_URL` — εσωτερικά συνεπή
 * μεταξύ τους. Το πραγματικό ρίσκο είναι αν ένας επισκέπτης φτάσει στην
 * εφαρμογή από ΑΛΛΟ host απ' αυτό που δηλώνει το `NUXT_PUBLIC_APP_URL`
 * (π.χ. www.endaxi.app ενώ το κανονικό είναι endaxi.app, ή το αντίστροφο
 * — παλιό bookmark, εξωτερικός σύνδεσμος, λάθος DNS εγγραφή): ο browser
 * στέλνει Origin που ΔΕΝ ταιριάζει με ό,τι εμπιστεύεται το backend, και
 * login/CSRF σπάνε με μπερδεμένα μηνύματα αντί για καθαρό redirect.
 *
 * Fix: 308 redirect (διατηρεί method+body) σε mismatched Host, ΠΡΙΝ από
 * οτιδήποτε άλλο middleware. Μόνο σε production — σε dev/test θα έσπαγε
 * το localhost.
 *
 * ΕΞΑΙΡΕΣΗ /api/**: endpoints μπορεί να χτυπιούνται από μη-browser
 * clients (Inngest webhooks, health probes από το ίδιο το Azure App
 * Service μέσω εσωτερικού hostname) που δεν ακολουθούν redirects. Ένα
 * redirect εκεί θα έσπαγε πραγματική λειτουργικότητα αντί να λύνει
 * πρόβλημα — το browser-facing auth/CSRF risk που μας απασχολεί αφορά
 * σελίδες, όχι server-to-server κλήσεις.
 */
export default defineEventHandler((event) => {
  if (process.env.NODE_ENV !== 'production') return

  const path = getRequestURL(event).pathname
  if (path.startsWith('/api/')) return

  const config = useRuntimeConfig(event)
  let canonicalHost: string
  try {
    canonicalHost = new URL(config.public.appUrl).host
  } catch {
    return
  }
  if (!canonicalHost) return

  const requestHost = getHeader(event, 'host')
  if (!requestHost || requestHost === canonicalHost) return

  const url = getRequestURL(event)
  const target = `https://${canonicalHost}${url.pathname}${url.search}`

  sendRedirect(event, target, 308)
})

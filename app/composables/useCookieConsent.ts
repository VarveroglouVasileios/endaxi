export interface CookiePreferences {
  version: 1
  necessary: true
  analytics: boolean
  updatedAt: string
}

const CONSENT_COOKIE_NAME = 'endaxi_cookie_consent'
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180

export function useCookieConsent() {
  const preferences = useCookie<CookiePreferences | null>(CONSENT_COOKIE_NAME, {
    default: () => null,
    maxAge: CONSENT_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: import.meta.env.PROD,
  })
  const preferencesOpen = useState('cookie-preferences-open', () => false)

  const hasDecision = computed(
    () => preferences.value?.version === 1 && preferences.value.necessary === true,
  )

  function savePreferences(analytics: boolean) {
    preferences.value = {
      version: 1,
      necessary: true,
      analytics,
      updatedAt: new Date().toISOString(),
    }
    preferencesOpen.value = false

    if (import.meta.client) {
      window.dispatchEvent(
        new CustomEvent('endaxi:cookie-consent-changed', {
          detail: preferences.value,
        }),
      )
    }
  }

  function openPreferences() {
    preferencesOpen.value = true
  }

  function closePreferences() {
    preferencesOpen.value = false
  }

  return {
    preferences,
    preferencesOpen,
    hasDecision,
    savePreferences,
    openPreferences,
    closePreferences,
  }
}

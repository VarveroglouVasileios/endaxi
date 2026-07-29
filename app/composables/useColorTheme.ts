export type ColorTheme = 'light' | 'dark'

const THEME_COOKIE_NAME = 'endaxi_theme'
const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function useColorTheme() {
  const preference = useCookie<ColorTheme | null>(THEME_COOKIE_NAME, {
    default: () => null,
    maxAge: THEME_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: import.meta.env.PROD,
  })
  const resolvedTheme = useState<ColorTheme>('resolved-color-theme', () => {
    return preference.value ?? 'light'
  })

  let mediaQuery: MediaQueryList | null = null

  function systemTheme(): ColorTheme {
    if (!import.meta.client) return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function applyTheme() {
    resolvedTheme.value = preference.value ?? systemTheme()

    if (!import.meta.client) return
    document.documentElement.dataset.theme = resolvedTheme.value
  }

  function handleSystemThemeChange() {
    if (!preference.value) applyTheme()
  }

  function toggleTheme() {
    preference.value = resolvedTheme.value === 'dark' ? 'light' : 'dark'
    applyTheme()
  }

  onMounted(() => {
    applyTheme()
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleSystemThemeChange)
  })

  onBeforeUnmount(() => {
    mediaQuery?.removeEventListener('change', handleSystemThemeChange)
  })

  useHead(() => ({
    htmlAttrs: preference.value ? { 'data-theme': preference.value } : {},
  }))

  return {
    preference,
    resolvedTheme,
    isDark: computed(() => resolvedTheme.value === 'dark'),
    toggleTheme,
  }
}

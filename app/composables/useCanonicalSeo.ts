interface CanonicalSeoOptions {
  title: string
  description: string
  robots?: string
  ogTitle?: string
  ogDescription?: string
}

export function useCanonicalSeo(options: CanonicalSeoOptions) {
  const route = useRoute()
  const config = useRuntimeConfig()
  const baseUrl = config.public.appUrl.replace(/\/+$/u, '')
  const canonicalUrl = computed(() => `${baseUrl}${route.path}`)
  const ogTitle = options.ogTitle ?? options.title
  const ogDescription = options.ogDescription ?? options.description

  useSeoMeta({
    title: options.title,
    description: options.description,
    robots: options.robots,
    ogTitle,
    ogDescription,
    ogType: 'website',
    ogUrl: canonicalUrl,
    ogLocale: 'el_GR',
    ogSiteName: 'Endaxi',
    twitterCard: 'summary',
    twitterTitle: ogTitle,
    twitterDescription: ogDescription,
  })

  useHead(() => ({
    link: [
      {
        rel: 'canonical',
        href: canonicalUrl.value,
      },
    ],
  }))
}

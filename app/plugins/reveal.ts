import type { DirectiveBinding } from 'vue'

const observers = new WeakMap<HTMLElement, IntersectionObserver>()

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal', {
    getSSRProps() {
      return {}
    },

    mounted(element: HTMLElement, binding: DirectiveBinding<number | undefined>) {
      element.classList.add('scroll-reveal')
      element.style.setProperty('--reveal-delay', `${Math.max(0, binding.value ?? 0)}ms`)

      if (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || !('IntersectionObserver' in window)
      ) {
        element.classList.add('is-visible')
        return
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return
          element.classList.add('is-visible')
          observer.disconnect()
          observers.delete(element)
        },
        { threshold: 0.12 },
      )

      observers.set(element, observer)
      observer.observe(element)
    },

    unmounted(element: HTMLElement) {
      observers.get(element)?.disconnect()
      observers.delete(element)
    },
  })
})

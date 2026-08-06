/**
 * TOAST — αντικαθιστά το native `alert()`.
 *
 * Ίδιο σκεπτικό με το useConfirmDialog: το `alert()` μπλοκάρει το thread
 * και δεν στυλίζεται. Το `ToastHost.vue` (mounted στο layout) διαβάζει
 * αυτό το state και ζωγραφίζει τις ειδοποιήσεις.
 */

export interface Toast {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

const toasts = ref<Toast[]>([])
let nextId = 1

const DEFAULT_DURATION_MS = 5000

export function useToast() {
  function show(message: string, type: Toast['type'] = 'info', durationMs = DEFAULT_DURATION_MS) {
    const id = nextId++
    toasts.value.push({ id, message, type })
    if (import.meta.client) {
      setTimeout(() => dismiss(id), durationMs)
    }
    return id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function error(message: string) {
    return show(message, 'error')
  }

  function success(message: string) {
    return show(message, 'success')
  }

  return { toasts, show, dismiss, error, success }
}

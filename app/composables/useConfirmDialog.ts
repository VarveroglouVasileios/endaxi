/**
 * ΔΙΑΛΟΓΟΣ ΕΠΙΒΕΒΑΙΩΣΗΣ — αντικαθιστά το native `confirm()`.
 *
 * Το browser `confirm()` μπλοκάρει όλο το thread, δεν στυλίζεται καθόλου
 * (ασχημίζει σε desktop, ΔΕΝ εμφανίζεται καν σωστά σε κάποια mobile
 * WebViews), και δεν ταιριάζει με τον υπόλοιπο σχεδιασμό. Το component
 * `ConfirmDialogHost.vue` (mounted μία φορά στο layout, όπως το
 * CookieConsent) διαβάζει αυτό το κοινό state και ζωγραφίζει το modal.
 *
 * Χρήση:
 *   const { confirm } = useConfirmDialog()
 *   const ok = await confirm({ title: '...', message: '...' })
 *   if (!ok) return
 */

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Κόκκινο κουμπί επιβεβαίωσης για καταστροφικές ενέργειες */
  danger?: boolean
}

interface ConfirmState extends Required<Omit<ConfirmOptions, 'message'>> {
  open: boolean
  message: string
  resolve: ((value: boolean) => void) | null
}

const state = ref<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Επιβεβαίωση',
  cancelLabel: 'Άκυρο',
  danger: false,
  resolve: null,
})

export function useConfirmDialog() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      // Αν υπάρχει ήδη ανοιχτός διάλογος που δεν απαντήθηκε, τον κλείνουμε
      // σαν "όχι" πριν ανοίξουμε τον νέο — ποτέ δύο ταυτόχρονα.
      state.value.resolve?.(false)

      state.value = {
        open: true,
        title: options.title,
        message: options.message ?? '',
        confirmLabel: options.confirmLabel ?? 'Επιβεβαίωση',
        cancelLabel: options.cancelLabel ?? 'Άκυρο',
        danger: options.danger ?? false,
        resolve,
      }
    })
  }

  function respond(value: boolean) {
    state.value.resolve?.(value)
    state.value = { ...state.value, open: false, resolve: null }
  }

  return { state, confirm, respond }
}

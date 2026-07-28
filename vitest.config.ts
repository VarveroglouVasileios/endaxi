import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: true,
    /**
     * ΚΡΙΣΙΜΟ: τρέχουμε σε ελληνική ώρα, όχι UTC.
     *
     * Το iCal all-day-date bug (μετατόπιση μιας ημέρας) ΔΕΝ αναπαράγεται
     * σε UTC. Αν τα tests τρέξουν σε UTC περνάνε, και το bug φτάνει στην
     * παραγωγή όπου οι χρήστες είναι στην Ελλάδα.
     */
    env: { TZ: 'Europe/Athens' },
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
})

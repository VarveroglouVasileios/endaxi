/**
 * Health check για monitoring.
 *
 * Ελέγχει ότι η βάση απαντά. Δεν εκθέτει εσωτερικά στοιχεία.
 */

import { sql } from 'drizzle-orm'
import { useDatabase } from '../database/client'
import { isStorageConfigured } from '../utils/storage'
import { isEmailConfigured } from '../utils/email/client'

export default defineEventHandler(async (event) => {
  const started = Date.now()

  let db = false
  try {
    await useDatabase().execute(sql`select 1`)
    db = true
  } catch {
    db = false
  }

  const healthy = db
  if (!healthy) setResponseStatus(event, 503)

  return {
    status: healthy ? 'ok' : 'degraded',
    checks: {
      database: db,
      storage: isStorageConfigured(),
      email: isEmailConfigured(),
    },
    latencyMs: Date.now() - started,
  }
})

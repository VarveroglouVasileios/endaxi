/**
 * Health check για monitoring.
 *
 * Ελέγχει ότι η βάση απαντά. Δεν εκθέτει εσωτερικά στοιχεία.
 */

import { sql } from 'drizzle-orm'
import { useDatabase } from '../database/client'

export default defineEventHandler(async (event) => {
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
  }
})

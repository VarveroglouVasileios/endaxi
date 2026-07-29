import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

function databasePoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX
  if (!raw) return 5

  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) {
    throw new Error('DATABASE_POOL_MAX must be an integer between 1 and 50')
  }
  return value
}

export function useDatabase() {
  if (_db) return _db

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  // Χρησιμοποιεί SSL αν:
  // α) είμαστε σε production, ή
  // β) το URL δηλώνει ρητά sslmode=require (π.χ. Neon σε local dev)
  // Αφήνει undefined για τοπικό Docker Postgres χωρίς TLS.
  const requiresSsl
    = process.env.NODE_ENV === 'production'
    || /[?&]sslmode=require/i.test(url)

  const client = postgres(url, {
    // Azure scales by starting additional Node processes. Keep this per-instance
    // limit low enough that instances × pool max stays below the provider cap.
    max: databasePoolMax(),
    prepare: false,
    ssl: requiresSsl ? 'require' : undefined,
    connect_timeout: 10,
    idle_timeout: 30,
    // Ασφάλεια απέναντι σε "κρεμασμένα" queries (π.χ. verifySeriesIntegrity
    // σε πολύ μεγάλη σειρά) που θα μπορούσαν να εξαντλήσουν το pool.
    connection: {
      statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? 30_000),
    },
  })

  _db = drizzle(client, { schema })
  return _db
}

export type Database = ReturnType<typeof useDatabase>
export { schema }

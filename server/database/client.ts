import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function useDatabase() {
  if (_db) return _db

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  // max: 1 in serverless to avoid connection exhaustion
  const client = postgres(url, {
    max: process.env.NITRO_PRESET?.includes('vercel') ? 1 : 10,
    prepare: false,
  })

  _db = drizzle(client, { schema })
  return _db
}

export type Database = ReturnType<typeof useDatabase>
export { schema }

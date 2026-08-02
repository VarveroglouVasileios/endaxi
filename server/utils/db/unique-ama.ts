/**
 * Postgres unique_violation (23505) στον global index `properties_ama_idx`.
 * Το Drizzle τυλίγει το PostgresError σε DrizzleQueryError με `.cause`.
 */
export function isUniqueAmaViolation(error: unknown): boolean {
  const candidates: unknown[] = [error]
  if (typeof error === 'object' && error !== null && 'cause' in error) {
    candidates.push(error.cause)
  }

  return candidates.some((candidate) => (
    typeof candidate === 'object'
    && candidate !== null
    && 'code' in candidate
    && candidate.code === '23505'
    && 'constraint_name' in candidate
    && candidate.constraint_name === 'properties_ama_idx'
  ))
}

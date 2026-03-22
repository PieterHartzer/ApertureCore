import type { H3Event } from 'h3'

import { consumeAuthenticatedFixedWindowRateLimit } from './authenticated-rate-limit'

const QUERY_TEST_RATE_LIMIT_POLICY = {
  keyPrefix: 'rate-limit:queries:test',
  limit: 5,
  windowMs: 60_000
} as const

/**
 * Applies the per-user rate limit used by the saved SQL query test endpoint.
 */
export const consumeSavedSqlQueryTestRateLimit = async (event: H3Event) => {
  return consumeAuthenticatedFixedWindowRateLimit(
    event,
    QUERY_TEST_RATE_LIMIT_POLICY
  )
}

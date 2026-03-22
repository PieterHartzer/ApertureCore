import type { H3Event } from 'h3'

import { consumeAuthenticatedFixedWindowRateLimit } from './authenticated-rate-limit'

const CONNECTION_TEST_RATE_LIMIT_POLICY = {
  keyPrefix: 'rate-limit:connections:test',
  limit: 5,
  windowMs: 60_000
} as const

/**
 * Applies the per-user rate limit used by the connection test endpoint.
 */
export const consumeConnectionTestRateLimit = async (event: H3Event) => {
  return consumeAuthenticatedFixedWindowRateLimit(
    event,
    CONNECTION_TEST_RATE_LIMIT_POLICY
  )
}

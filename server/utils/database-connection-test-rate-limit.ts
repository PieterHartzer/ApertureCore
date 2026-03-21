import type { H3Event } from 'h3'

import { consumeFixedWindowRateLimit } from './rate-limit'
import { pickString } from './pick-string'

const CONNECTION_TEST_RATE_LIMIT_KEY = 'rate-limit:connections:test'
const CONNECTION_TEST_RATE_LIMIT_LIMIT = 5
const CONNECTION_TEST_RATE_LIMIT_WINDOW_MS = 60_000

/**
 * Builds a stable rate-limit actor key from the authenticated user context.
 */
const resolveConnectionTestActor = (event: H3Event) => {
  const subjectId = pickString(
    event.context.auth?.claims?.sub,
    event.context.auth?.userInfo?.sub
  )

  if (subjectId) {
    return `user:${subjectId}`
  }

  const userName = pickString(event.context.auth?.userName)

  if (userName) {
    return `user-name:${userName}`
  }

  return 'user:authenticated'
}

/**
 * Applies the per-user rate limit used by the connection test endpoint.
 */
export const consumeConnectionTestRateLimit = async (event: H3Event) => {
  const storage = useStorage('cache')
  const actorKey = resolveConnectionTestActor(event)

  return consumeFixedWindowRateLimit(
    storage,
    `${CONNECTION_TEST_RATE_LIMIT_KEY}:${actorKey}`,
    CONNECTION_TEST_RATE_LIMIT_LIMIT,
    CONNECTION_TEST_RATE_LIMIT_WINDOW_MS
  )
}

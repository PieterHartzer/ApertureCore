import type { H3Event } from 'h3'

import { consumeFixedWindowRateLimit } from './rate-limit'

const CONNECTION_TEST_RATE_LIMIT_KEY = 'rate-limit:connections:test'
const CONNECTION_TEST_RATE_LIMIT_LIMIT = 5
const CONNECTION_TEST_RATE_LIMIT_WINDOW_MS = 60_000

const hasUserName = (
  value: unknown
): value is {
  userName: string
} => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'userName' in value &&
    typeof value.userName === 'string' &&
    value.userName.trim().length > 0
  )
}

const resolveConnectionTestActor = (event: H3Event) => {
  if (hasUserName(event.context.auth)) {
    return `user:${event.context.auth.userName}`
  }

  return 'user:authenticated'
}

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

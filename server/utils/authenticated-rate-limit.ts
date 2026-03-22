import { createHash } from 'node:crypto'

import type { H3Event } from 'h3'

import { pickString } from './pick-string'
import {
  type FixedWindowRateLimitResult,
  consumeFixedWindowRateLimit
} from './rate-limit'

export interface AuthenticatedFixedWindowRateLimitPolicy {
  keyPrefix: string
  limit: number
  windowMs: number
}

const pickRequestHeader = (
  event: H3Event,
  headerName: string
) => {
  const headerValue = event.node.req.headers[headerName]

  if (Array.isArray(headerValue)) {
    return pickString(headerValue[0])
  }

  return pickString(headerValue)
}

const buildFingerprint = (...parts: Array<string | undefined>) => {
  const normalizedValue = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join('|')

  if (!normalizedValue) {
    return undefined
  }

  return createHash('sha256')
    .update(normalizedValue)
    .digest('hex')
    .slice(0, 16)
}

const resolveNetworkFingerprint = (event: H3Event) => {
  const forwardedFor = pickRequestHeader(event, 'x-forwarded-for')
    ?.split(',')[0]
    ?.trim()
  const realIp = pickRequestHeader(event, 'x-real-ip')
  const remoteAddress = event.node.req.socket?.remoteAddress
  const userAgent = pickRequestHeader(event, 'user-agent')

  return buildFingerprint(
    forwardedFor,
    realIp,
    remoteAddress,
    userAgent
  )
}

/**
 * Builds a stable actor key from authenticated user context so per-user limits
 * remain consistent across endpoints.
 */
export const resolveAuthenticatedRateLimitActor = (event: H3Event) => {
  const subjectId = pickString(
    event.context.auth?.claims?.sub,
    event.context.auth?.userInfo?.sub,
    event.context.auth?.claims?.oid,
    event.context.auth?.claims?.sid
  )

  if (subjectId) {
    return `user:${subjectId}`
  }

  const preferredIdentity = pickString(
    event.context.auth?.claims?.preferred_username,
    event.context.auth?.userInfo?.preferred_username,
    event.context.auth?.claims?.email,
    event.context.auth?.userInfo?.email
  )

  if (preferredIdentity) {
    return `user-identity:${preferredIdentity}`
  }

  const userName = pickString(event.context.auth?.userName)

  if (userName) {
    return `user-name:${userName}`
  }

  const networkFingerprint = resolveNetworkFingerprint(event)

  if (networkFingerprint) {
    return `user-fingerprint:${networkFingerprint}`
  }

  return 'user:authenticated'
}

/**
 * Consumes a fixed-window rate limit using a shared authenticated-user key and
 * endpoint-specific policy settings.
 */
export const consumeAuthenticatedFixedWindowRateLimit = async (
  event: H3Event,
  policy: AuthenticatedFixedWindowRateLimitPolicy
): Promise<FixedWindowRateLimitResult> => {
  const storage = useStorage('cache')
  const actorKey = resolveAuthenticatedRateLimitActor(event)

  return consumeFixedWindowRateLimit(
    storage,
    `${policy.keyPrefix}:${actorKey}`,
    policy.limit,
    policy.windowMs
  )
}

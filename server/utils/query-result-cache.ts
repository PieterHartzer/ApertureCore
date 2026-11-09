import { createHash } from 'node:crypto'

import type { H3Event } from 'h3'

import { pickString } from './pick-string'

export interface CachedQueryResult {
  columns: string[]
  rows: Array<Record<string, string | number | boolean | null>>
  etag: string
}

export interface StoredQueryResult extends CachedQueryResult {
  expiresAt: number
}

export const buildQueryResultEtag = (
  response: Omit<CachedQueryResult, 'etag'>
) => {
  return `"${createHash('sha256')
    .update(JSON.stringify(response))
    .digest('hex')}"`
}

export const buildEmbeddedDashboardWidgetCacheKey = (
  embedId: string,
  widgetId: string,
  cacheVersion: string
) => {
  const scope = createHash('sha256')
    .update(embedId, 'utf8')
    .digest('hex')
    .slice(0, 16)

  return `embed-query:${scope}:${widgetId}:${cacheVersion}`
}

export const isCachedQueryResult = (
  value: unknown
): value is CachedQueryResult => {
  const response = value as Partial<CachedQueryResult> | null

  return (
    typeof response === 'object' &&
    response !== null &&
    Array.isArray(response.columns) &&
    Array.isArray(response.rows) &&
    typeof response.etag === 'string'
  )
}

export const buildStoredQueryResult = (
  response: CachedQueryResult,
  ttlSeconds: number,
  now = Date.now()
): StoredQueryResult => ({
  ...response,
  expiresAt: now + ttlSeconds * 1000
})

/**
 * Returns a stored result only while it is fresh. The expiry is checked here
 * because the fs and memory storage drivers ignore the ttl option, which would
 * otherwise keep serving old rows without ever reaching the database or its
 * privilege check. Entries written without an expiry count as expired.
 */
export const readFreshQueryResult = (
  value: unknown,
  now = Date.now()
): CachedQueryResult | null => {
  if (!isCachedQueryResult(value)) {
    return null
  }

  const { expiresAt, ...response } = value as StoredQueryResult

  return typeof expiresAt === 'number' && expiresAt > now ? response : null
}

export const pickRequestHeader = (
  event: H3Event,
  headerName: string
) => {
  const headerValue = event.node.req.headers[headerName]

  if (Array.isArray(headerValue)) {
    return pickString(headerValue[0])
  }

  return pickString(headerValue)
}

const normalizeEtag = (value: string) => {
  return value.trim().replace(/^W\//, '')
}

export const matchesIfNoneMatch = (
  requestHeaderValue: string | undefined,
  etag: string
) => {
  if (!requestHeaderValue) {
    return false
  }

  return requestHeaderValue
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === '*' || normalizeEtag(value) === normalizeEtag(etag))
}

import { createHash } from 'node:crypto'

import type { H3Event } from 'h3'

import type {
  RunSavedSqlQueryInput,
  RunSavedSqlQueryValidationError
} from '../../types/saved-sql-queries'

import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { executeQuery } from '../../utils/database/executeQuery'
import { resolvePositiveInteger } from '../../utils/positive-integer'
import {
  buildQueryResultEtag,
  isCachedQueryResult,
  matchesIfNoneMatch,
  pickRequestHeader,
  type CachedQueryResult
} from '../../utils/query-result-cache'
import { validateRunSavedSqlQueryInput } from '../../validators/saved-sql-queries'

type QueryRunErrorCode =
  | 'invalid_input'
  | 'forbidden'
  | 'unsupported_database_type'
  | 'authentication_failed'
  | 'database_not_found'
  | 'connection_failed'
  | 'timeout'
  | 'ssl_required'
  | 'query_rejected'
  | 'query_failed'
  | 'persistence_unavailable'
  | 'unexpected_error'

interface QueryRunErrorResponse {
  ok: false
  code: QueryRunErrorCode
  message: string
  messageKey?: string
  issue?: RunSavedSqlQueryValidationError['issue']
  field?: RunSavedSqlQueryValidationError['field']
}

const DEFAULT_QUERY_CACHE_TTL_SECONDS = 60

const VALIDATION_MESSAGE_KEYS: Record<
  RunSavedSqlQueryValidationError['issue'],
  string
> = {
  body_invalid: 'queries.test.errors.bodyInvalid',
  connection_id_invalid: 'queries.test.errors.connectionIdInvalid',
  query_id_invalid: 'queries.edit.errors.queryIdInvalid'
}

const ERROR_MESSAGE_KEYS: Record<
  Exclude<QueryRunErrorCode, 'invalid_input'>,
  string
> = {
  forbidden: 'queries.test.errors.forbidden',
  unsupported_database_type: 'queries.test.errors.unsupportedDatabaseType',
  authentication_failed: 'queries.test.errors.authenticationFailed',
  database_not_found: 'queries.test.errors.databaseNotFound',
  connection_failed: 'queries.test.errors.connectionFailed',
  timeout: 'queries.test.errors.timeout',
  ssl_required: 'queries.test.errors.sslRequired',
  query_rejected: 'queries.test.errors.queryRejected',
  query_failed: 'queries.test.errors.queryFailed',
  persistence_unavailable: 'queries.test.errors.persistenceUnavailable',
  unexpected_error: 'queries.test.errors.unexpected'
}

const buildValidationErrorResponse = (
  error: RunSavedSqlQueryValidationError
): QueryRunErrorResponse => {
  const messageKey = VALIDATION_MESSAGE_KEYS[error.issue]

  return {
    ok: false,
    code: error.code,
    issue: error.issue,
    field: error.field,
    message: messageKey,
    messageKey
  }
}

const buildErrorResponse = (
  code: Exclude<QueryRunErrorCode, 'invalid_input'>
): QueryRunErrorResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[code]

  return {
    ok: false,
    code,
    message: messageKey,
    messageKey
  }
}

const mapCodeToStatus = (
  code: Exclude<QueryRunErrorCode, 'invalid_input'>
) => {
  switch (code) {
    case 'forbidden':
      return 403
    case 'unsupported_database_type':
    case 'ssl_required':
    case 'query_rejected':
    case 'query_failed':
      return 400
    case 'authentication_failed':
      return 401
    case 'database_not_found':
      return 404
    case 'connection_failed':
    case 'persistence_unavailable':
      return 503
    case 'timeout':
      return 504
    case 'unexpected_error':
      return 500
  }
}

const buildOrganizationCacheScope = (organizationId: string) => {
  return createHash('sha256')
    .update(organizationId, 'utf8')
    .digest('hex')
    .slice(0, 16)
}

const buildCacheKey = (
  organizationScope: string,
  input: RunSavedSqlQueryInput,
  queryParameters?: Record<string, unknown>
) => {
  if (!queryParameters) {
    return `query:${organizationScope}:${input.queryId}:${input.connectionId}`
  }

  const parametersHash = createHash('sha256')
    .update(JSON.stringify(queryParameters))
    .digest('hex')

  return `query:${organizationScope}:${input.queryId}:${input.connectionId}:${parametersHash}`
}

export default defineEventHandler(async (event) => {
  let body: unknown

  try {
    body = await readBody(event)
  } catch {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse({
      ok: false,
      code: 'invalid_input',
      issue: 'body_invalid',
      field: 'body',
      message: 'body_invalid'
    })
  }

  const validationResult = validateRunSavedSqlQueryInput(body)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(validationResult)
  }

  try {
    const authContext = getAuthenticatedOrganizationContext(event)
    const runtimeConfig = useRuntimeConfig()
    const cache = useStorage('cache')
    const cacheKey = buildCacheKey(
      buildOrganizationCacheScope(authContext.organizationId),
      validationResult.data
    )
    const ifNoneMatch = pickRequestHeader(event, 'if-none-match')
    const ttlSeconds = resolvePositiveInteger(
      runtimeConfig.queryCacheTtlSeconds,
      DEFAULT_QUERY_CACHE_TTL_SECONDS
    )
    const cachedResponse = await cache.getItem<CachedQueryResult>(cacheKey)

    if (isCachedQueryResult(cachedResponse)) {
      setResponseHeader(event, 'etag', cachedResponse.etag)

      if (matchesIfNoneMatch(ifNoneMatch, cachedResponse.etag)) {
        setResponseStatus(event, 304)
        return
      }

      setResponseStatus(event, 200)
      return cachedResponse
    }

    const result = await executeQuery(authContext, validationResult.data)

    if (!result.ok) {
      setResponseStatus(event, mapCodeToStatus(result.code))

      return buildErrorResponse(result.code)
    }

    const responseWithoutEtag = {
      columns: result.columns,
      rows: result.rows
    }
    const response: CachedQueryResult = {
      ...responseWithoutEtag,
      etag: buildQueryResultEtag(responseWithoutEtag)
    }

    await cache.setItem(cacheKey, response, {
      ttl: ttlSeconds
    })

    setResponseHeader(event, 'etag', response.etag)

    if (matchesIfNoneMatch(ifNoneMatch, response.etag)) {
      setResponseStatus(event, 304)
      return
    }

    setResponseStatus(event, 200)

    return response
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 403
    ) {
      setResponseStatus(event, 403)

      return buildErrorResponse('forbidden')
    }

    console.error(error)
    setResponseStatus(event, 500)

    return buildErrorResponse('unexpected_error')
  }
})

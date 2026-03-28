import type { EmbeddedDashboardWidgetRunApiResponse } from '../../../../../../types/dashboards'

import { executeResolvedSavedQuery } from '../../../../../../utils/database/executeQuery'
import { resolveEmbeddedDashboardWidgetExecutionContext } from '../../../../../../utils/database/executeEmbeddedDashboardWidgetQuery'
import { AppDatabaseConfigurationError } from '../../../../../../utils/app-database'
import { resolvePositiveInteger } from '../../../../../../utils/positive-integer'
import {
  buildEmbeddedDashboardWidgetCacheKey,
  buildQueryResultEtag,
  isCachedQueryResult,
  matchesIfNoneMatch,
  pickRequestHeader,
  type CachedQueryResult
} from '../../../../../../utils/query-result-cache'
import {
  validateDashboardEmbedId,
  validateDashboardWidgetId
} from '../../../../../../validators/dashboards'

const DEFAULT_QUERY_CACHE_TTL_SECONDS = 60

const ERROR_MESSAGE_KEYS: Record<
  Exclude<EmbeddedDashboardWidgetRunApiResponse['code'], 'success' | 'not_modified' | 'invalid_input'>,
  string
> = {
  not_found: 'dashboards.embed.run.errors.notFound',
  unsupported_database_type: 'dashboards.embed.run.errors.unsupportedDatabaseType',
  authentication_failed: 'dashboards.embed.run.errors.authenticationFailed',
  database_not_found: 'dashboards.embed.run.errors.databaseNotFound',
  connection_failed: 'dashboards.embed.run.errors.connectionFailed',
  timeout: 'dashboards.embed.run.errors.timeout',
  ssl_required: 'dashboards.embed.run.errors.sslRequired',
  query_rejected: 'dashboards.embed.run.errors.queryRejected',
  query_failed: 'dashboards.embed.run.errors.queryFailed',
  persistence_unavailable: 'dashboards.embed.run.errors.persistenceUnavailable',
  unexpected_error: 'dashboards.embed.run.errors.unexpected'
}

const buildErrorResponse = (
  code: Exclude<EmbeddedDashboardWidgetRunApiResponse['code'], 'success' | 'not_modified' | 'invalid_input'>
): EmbeddedDashboardWidgetRunApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[code]

  return {
    ok: false,
    code,
    message: messageKey,
    messageKey
  }
}

const buildValidationErrorResponse = (
  issue: 'embed_id_invalid' | 'widget_id_invalid',
  field: 'embedId' | 'widgetId',
  messageKey: string
): EmbeddedDashboardWidgetRunApiResponse => ({
  ok: false,
  code: 'invalid_input',
  issue,
  field,
  message: messageKey,
  messageKey
})

const mapCodeToStatus = (
  code: Exclude<EmbeddedDashboardWidgetRunApiResponse['code'], 'success' | 'not_modified' | 'invalid_input'>
) => {
  switch (code) {
    case 'not_found':
      return 404
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

export default defineEventHandler(async (event) => {
  const embedIdValidation = validateDashboardEmbedId(event.context.params?.embedId)

  if (!embedIdValidation.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(
      'embed_id_invalid',
      'embedId',
      'dashboards.embed.run.errors.embedIdInvalid'
    )
  }

  const widgetIdValidation = validateDashboardWidgetId(event.context.params?.widgetId)

  if (!widgetIdValidation.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse(
      'widget_id_invalid',
      'widgetId',
      'dashboards.embed.run.errors.widgetIdInvalid'
    )
  }

  try {
    const runtimeConfig = useRuntimeConfig()
    const cache = useStorage('cache')
    const ifNoneMatch = pickRequestHeader(event, 'if-none-match')
    const ttlSeconds = resolvePositiveInteger(
      runtimeConfig.queryCacheTtlSeconds,
      DEFAULT_QUERY_CACHE_TTL_SECONDS
    )
    const resolvedExecutionContext = await resolveEmbeddedDashboardWidgetExecutionContext(
      embedIdValidation.data.embedId,
      widgetIdValidation.data.widgetId
    )

    if (!resolvedExecutionContext) {
      setResponseStatus(event, 404)

      return buildErrorResponse('not_found')
    }

    const cacheKey = buildEmbeddedDashboardWidgetCacheKey(
      embedIdValidation.data.embedId,
      widgetIdValidation.data.widgetId,
      resolvedExecutionContext.cacheVersion
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

    const result = await executeResolvedSavedQuery(
      resolvedExecutionContext.executionResource
    )

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
    if (error instanceof AppDatabaseConfigurationError) {
      setResponseStatus(event, 503)

      return buildErrorResponse('persistence_unavailable')
    }

    console.error(error)
    setResponseStatus(event, 500)

    return buildErrorResponse('unexpected_error')
  }
})

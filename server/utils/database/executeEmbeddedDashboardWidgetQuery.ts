import type { ExecuteEmbeddedDashboardWidgetQueryResult } from '../../types/dashboards'
import type {
  QueryExecutionResourceRow,
  ResolvedSavedQueryExecutionResult
} from './executeQuery'

import {
  AppDatabaseConfigurationError,
  getAppDatabase
} from '../app-database'
import { executeResolvedSavedQuery } from './executeQuery'
import {
  DatabaseConnectionEncryptionConfigurationError
} from '../database-connection-secrets'
import {
  SavedSqlQueryEncryptionConfigurationError
} from '../saved-sql-query-secrets'

const isPersistenceConfigurationError = (value: unknown) => {
  return (
    value instanceof AppDatabaseConfigurationError ||
    value instanceof DatabaseConnectionEncryptionConfigurationError ||
    value instanceof SavedSqlQueryEncryptionConfigurationError
  )
}

interface EmbeddedDashboardWidgetExecutionResourceRow extends QueryExecutionResourceRow {
  widget_query_id: string
  widget_updated_at: Date
  dashboard_updated_at: Date
}

export interface ResolvedEmbeddedDashboardWidgetExecutionContext {
  executionResource: QueryExecutionResourceRow
  cacheVersion: string
}

const buildEmbeddedDashboardWidgetCacheVersion = (
  executionResource: EmbeddedDashboardWidgetExecutionResourceRow
) => {
  return `${executionResource.widget_query_id}:${new Date(executionResource.widget_updated_at).toISOString()}:${new Date(executionResource.dashboard_updated_at).toISOString()}`
}

export const resolveEmbeddedDashboardWidgetExecutionContext = async (
  embedId: string,
  widgetId: string
): Promise<ResolvedEmbeddedDashboardWidgetExecutionContext | null> => {
  const db = getAppDatabase()
  const executionResource = await db
    .selectFrom('app_dashboard_widgets as widget')
    .innerJoin('app_dashboards as dashboard', 'dashboard.dashboard_id', 'widget.dashboard_id')
    .innerJoin('app_saved_sql_queries as query', 'query.query_id', 'widget.query_id')
    .innerJoin('app_database_connections as connection', (join) =>
      join
        .onRef('connection.organization_id', '=', 'query.organization_id')
        .onRef('connection.connection_id', '=', 'query.connection_id')
    )
    .select([
      'query.encrypted_sql as encrypted_sql',
      'connection.database_type as database_type',
      'connection.encrypted_secret as encrypted_secret',
      'widget.query_id as widget_query_id',
      'widget.updated_at as widget_updated_at',
      'dashboard.updated_at as dashboard_updated_at'
    ])
    .where('dashboard.embed_id', '=', embedId)
    .where('dashboard.embed_enabled', '=', true)
    .where('dashboard.deleted_at', 'is', null)
    .where('widget.widget_id', '=', widgetId)
    .where('widget.deleted_at', 'is', null)
    .where('query.deleted_at', 'is', null)
    .where('connection.deleted_at', 'is', null)
    .executeTakeFirst() as EmbeddedDashboardWidgetExecutionResourceRow | undefined

  if (!executionResource) {
    return null
  }

  return {
    executionResource: {
      encrypted_sql: executionResource.encrypted_sql,
      database_type: executionResource.database_type,
      encrypted_secret: executionResource.encrypted_secret
    },
    cacheVersion: buildEmbeddedDashboardWidgetCacheVersion(executionResource)
  }
}

export const executeEmbeddedDashboardWidgetQuery = async (
  embedId: string,
  widgetId: string
): Promise<ExecuteEmbeddedDashboardWidgetQueryResult> => {
  try {
    const resolvedExecutionContext = await resolveEmbeddedDashboardWidgetExecutionContext(
      embedId,
      widgetId
    )

    if (!resolvedExecutionContext) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    const result: ResolvedSavedQueryExecutionResult = await executeResolvedSavedQuery(
      resolvedExecutionContext.executionResource
    )

    return result
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    console.error(error)

    return {
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    }
  }
}

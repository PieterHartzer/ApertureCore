import type {
  AuthenticatedOrganizationContext,
  ListSavedSqlQueriesResult,
  SavedSqlQuerySummary
} from '../types/saved-sql-queries'
import {
  AppDatabaseConfigurationError,
  getAppDatabase
} from '../utils/app-database'
import { mapOrganizationIdToStorage } from './organization'

interface SavedSqlQuerySummaryRow {
  query_id: string
  query_name: string
  connection_id: string
  connection_name: string
  created_at: Date
  updated_at: Date
}

const mapSavedSqlQuerySummary = (
  row: SavedSqlQuerySummaryRow
): SavedSqlQuerySummary => ({
  id: row.query_id,
  queryName: row.query_name,
  connectionId: row.connection_id,
  connectionName: row.connection_name,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
})

/**
 * Returns saved SQL query summaries for the authenticated organization without
 * selecting or exposing the encrypted SQL payload.
 */
export const listSavedSqlQueries = async (
  authContext: AuthenticatedOrganizationContext
): Promise<ListSavedSqlQueriesResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const queries = await db
      .selectFrom('app_saved_sql_queries as query')
      .innerJoin('app_database_connections as connection', (join) =>
        join
          .onRef('connection.organization_id', '=', 'query.organization_id')
          .onRef('connection.connection_id', '=', 'query.connection_id')
      )
      .select([
        'query.query_id as query_id',
        'query.query_name as query_name',
        'query.connection_id as connection_id',
        'connection.connection_name as connection_name',
        'query.created_at as created_at',
        'query.updated_at as updated_at'
      ])
      .where('query.organization_id', '=', organizationId)
      .where('query.deleted_at', 'is', null)
      .where('connection.deleted_at', 'is', null)
      .orderBy('query.updated_at', 'desc')
      .orderBy('query.query_name', 'asc')
      .execute() as SavedSqlQuerySummaryRow[]

    return {
      ok: true,
      code: 'success',
      queries: queries.map(mapSavedSqlQuerySummary)
    }
  } catch (error) {
    if (error instanceof AppDatabaseConfigurationError) {
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

import {
  Pool,
  type FieldDef,
  type PoolClient,
  type QueryResultRow
} from 'pg'

import type {
  DatabaseQueryResultRow,
  DatabaseQueryResultValue,
  ExecuteDatabaseReadOnlyQueryInput,
  ExecuteDatabaseReadOnlyQueryResult,
  TestDatabaseConnectionInput,
  TestDatabaseConnectionResult
} from '../../types/database'

import type {
  DatabaseConnectionTester,
  DatabaseQueryExecutor
} from './types'
import { normalizeReadOnlySql } from '../../utils/read-only-sql'

const CONNECT_TIMEOUT_SECONDS = 5
const QUERY_TIMEOUT_MS = 5_000
const QUERY_LOCK_TIMEOUT_MS = 1_000
const QUERY_RESULT_SAMPLE_ROW_LIMIT = 25
const MAX_RESULT_VALUE_LENGTH = 2_000
const QUERY_RESULT_ALIAS = 'aperture_query_result'

type DatabaseError = Error & {
  code?: string
  detail?: string
  hint?: string
}

const AUTHENTICATION_ERROR_CODES = new Set(['28000', '28P01', 'AUTH_TYPE_NOT_IMPLEMENTED'])
const CONNECTION_ERROR_CODES = new Set([
  '08001',
  '08006',
  '57P03',
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
  'CONNECTION_ENDED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
])
const TIMEOUT_ERROR_CODES = new Set(['CONNECT_TIMEOUT', 'ETIMEDOUT'])

const isDatabaseError = (error: unknown): error is DatabaseError => {
  return error instanceof Error
}

const buildErrorDetails = (error: DatabaseError): string => {
  return [error.message, error.detail, error.hint].filter(Boolean).join(' ')
}

const isSslConfigurationError = (error: DatabaseError): boolean => {
  const normalizedMessage = buildErrorDetails(error).toLowerCase()

  return (
    normalizedMessage.includes('ssl') &&
    (
      normalizedMessage.includes('required') ||
      normalizedMessage.includes('ssl off') ||
      normalizedMessage.includes('certificate')
    )
  )
}

const createPool = (
  input: Pick<
    TestDatabaseConnectionInput,
    'host' | 'port' | 'databaseName' | 'username' | 'password' | 'sslMode'
  >
) => {
  return new Pool({
    host: input.host,
    port: input.port,
    database: input.databaseName,
    user: input.username,
    password: input.password,
    ssl: input.sslMode === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: CONNECT_TIMEOUT_SECONDS * 1000,
    max: 1
  })
}

const mapPostgreSqlConnectionError = (
  error: unknown
): TestDatabaseConnectionResult => {
  if (!isDatabaseError(error)) {
    return {
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error',
      details: String(error)
    }
  }

  if (isSslConfigurationError(error)) {
    return {
      ok: false,
      code: 'ssl_required',
      message: 'ssl_required',
      details: buildErrorDetails(error)
    }
  }

  if (error.code && AUTHENTICATION_ERROR_CODES.has(error.code)) {
    return {
      ok: false,
      code: 'authentication_failed',
      message: 'authentication_failed',
      details: buildErrorDetails(error)
    }
  }

  if (error.code === '3D000') {
    return {
      ok: false,
      code: 'database_not_found',
      message: 'database_not_found',
      details: buildErrorDetails(error)
    }
  }

  if (error.code && TIMEOUT_ERROR_CODES.has(error.code)) {
    return {
      ok: false,
      code: 'timeout',
      message: 'timeout',
      details: buildErrorDetails(error)
    }
  }

  if (error.code && CONNECTION_ERROR_CODES.has(error.code)) {
    return {
      ok: false,
      code: 'connection_failed',
      message: 'connection_failed',
      details: buildErrorDetails(error)
    }
  }

  return {
    ok: false,
    code: 'unexpected_error',
    message: 'unexpected_error',
    details: buildErrorDetails(error)
  }
}

const truncateResultValue = (value: string) => {
  if (value.length <= MAX_RESULT_VALUE_LENGTH) {
    return value
  }

  return `${value.slice(0, MAX_RESULT_VALUE_LENGTH)}...`
}

const sanitizeResultValue = (value: unknown): DatabaseQueryResultValue => {
  if (value === null || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : truncateResultValue(String(value))
  }

  if (typeof value === 'string') {
    return truncateResultValue(value)
  }

  if (typeof value === 'bigint') {
    return truncateResultValue(value.toString())
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Buffer.isBuffer(value)) {
    return `[binary ${value.byteLength} bytes]`
  }

  try {
    const serializedValue = JSON.stringify(value)

    return truncateResultValue(serializedValue ?? String(value))
  } catch {
    return truncateResultValue(String(value))
  }
}

const sanitizeResultRow = (
  row: Record<string, unknown>,
  columns: string[]
): DatabaseQueryResultRow => {
  const sanitizedRow: DatabaseQueryResultRow = {}

  for (const column of columns) {
    sanitizedRow[column] = sanitizeResultValue(row[column])
  }

  return sanitizedRow
}

const buildLimitedQuery = (sql: string) => {
  // Always return a small preview from the tested query, even if the inner SQL
  // specifies a larger limit. This keeps test responses bounded.
  return `select * from (${sql}) as ${QUERY_RESULT_ALIAS} limit ${QUERY_RESULT_SAMPLE_ROW_LIMIT}`
}

const mapPostgreSqlQueryError = (
  error: unknown
): ExecuteDatabaseReadOnlyQueryResult => {
  if (!isDatabaseError(error)) {
    return {
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error',
      details: String(error)
    }
  }

  if (isSslConfigurationError(error)) {
    return {
      ok: false,
      code: 'ssl_required',
      message: 'ssl_required',
      details: buildErrorDetails(error)
    }
  }

  if (error.code && AUTHENTICATION_ERROR_CODES.has(error.code)) {
    return {
      ok: false,
      code: 'authentication_failed',
      message: 'authentication_failed',
      details: buildErrorDetails(error)
    }
  }

  if (error.code === '3D000') {
    return {
      ok: false,
      code: 'database_not_found',
      message: 'database_not_found',
      details: buildErrorDetails(error)
    }
  }

  if (error.code && TIMEOUT_ERROR_CODES.has(error.code)) {
    return {
      ok: false,
      code: 'timeout',
      message: 'timeout',
      details: buildErrorDetails(error)
    }
  }

  if (error.code && CONNECTION_ERROR_CODES.has(error.code)) {
    return {
      ok: false,
      code: 'connection_failed',
      message: 'connection_failed',
      details: buildErrorDetails(error)
    }
  }

  if (error.code === '25006') {
    return {
      ok: false,
      code: 'query_rejected',
      message: 'query_rejected',
      details: buildErrorDetails(error)
    }
  }

  if (error.code) {
    return {
      ok: false,
      code: 'query_failed',
      message: 'query_failed',
      details: buildErrorDetails(error)
    }
  }

  return {
    ok: false,
    code: 'unexpected_error',
    message: 'unexpected_error',
    details: buildErrorDetails(error)
  }
}

export class PostgreSqlConnectionTester
implements DatabaseConnectionTester, DatabaseQueryExecutor {
  async testConnection(
    input: TestDatabaseConnectionInput
  ): Promise<TestDatabaseConnectionResult> {
    const pool = createPool(input)

    let result: TestDatabaseConnectionResult

    try {
      await pool.query('select 1')

      result = {
        ok: true,
        code: 'success',
        message: 'success'
      }
    } catch (error) {
      result = mapPostgreSqlConnectionError(error)
    } finally {
      await pool.end()
    }

    return result
  }

  async executeReadOnlyQuery(
    input: ExecuteDatabaseReadOnlyQueryInput
  ): Promise<ExecuteDatabaseReadOnlyQueryResult> {
    const normalizedQuery = normalizeReadOnlySql(input.sql)

    if (!normalizedQuery.ok) {
      return {
        ok: false,
        code: 'query_rejected',
        message: 'query_rejected',
        details: normalizedQuery.details
      }
    }

    const pool = createPool(input)
    let client: PoolClient | null = null

    try {
      client = await pool.connect()
      await client.query('begin')
      await client.query(
        `set local statement_timeout = '${QUERY_TIMEOUT_MS}ms'`
      )
      await client.query(
        `set local idle_in_transaction_session_timeout = '${QUERY_TIMEOUT_MS}ms'`
      )
      await client.query(
        `set local lock_timeout = '${QUERY_LOCK_TIMEOUT_MS}ms'`
      )
      await client.query('set local transaction read only')

      const result = await client.query<QueryResultRow>(
        buildLimitedQuery(normalizedQuery.sql)
      )
      const columns = result.fields.map((field: FieldDef) => field.name)

      await client.query('rollback')

      return {
        ok: true,
        code: 'success',
        message: 'success',
        columns,
        rows: result.rows.map((row: QueryResultRow) => sanitizeResultRow(row, columns)),
        rowLimit: QUERY_RESULT_SAMPLE_ROW_LIMIT
      }
    } catch (error) {
      if (client) {
        try {
          await client.query('rollback')
        } catch {
          // Ignore rollback failures and preserve the original error mapping.
        }
      }

      return mapPostgreSqlQueryError(error)
    } finally {
      client?.release()
      await pool.end()
    }
  }
}

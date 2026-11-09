import { isIP } from 'node:net'
import {
  Pool,
  type FieldDef,
  type PoolClient,
  type QueryResultRow
} from 'pg'
import Cursor from 'pg-cursor'

import type {
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
import { resolvePositiveInteger } from '../../utils/positive-integer'
import {
  CONNECT_TIMEOUT_SECONDS,
  DEFAULT_QUERY_RESULT_ROW_LIMIT,
  DEFAULT_QUERY_TIMEOUT_MS,
  PRIVILEGED_ROLE_DETAILS,
  QUERY_LOCK_TIMEOUT_MS,
  isTlsVerificationError,
  sanitizeResultRow
} from './shared'

// A read-only transaction stops writes, but not these server-level powers.
const PRIVILEGED_ROLE_SQL = `select (
    r.rolsuper or r.rolcreaterole or r.rolreplication or r.rolbypassrls
    or pg_has_role(current_user, 'pg_read_server_files', 'member')
    or pg_has_role(current_user, 'pg_write_server_files', 'member')
    or pg_has_role(current_user, 'pg_execute_server_program', 'member')
    or pg_has_role(current_user, 'pg_signal_backend', 'member')
  ) as privileged
  from pg_catalog.pg_roles r
  where r.rolname = current_user`

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
const TIMEOUT_ERROR_CODES = new Set(['57014', '55P03', 'CONNECT_TIMEOUT', 'ETIMEDOUT'])

// The pg driver raises dropped sockets without an error code.
const isConnectionError = (error: DatabaseError): boolean => {
  return (
    (error.code !== undefined && CONNECTION_ERROR_CODES.has(error.code)) ||
    error.message.includes('Connection terminated')
  )
}

const isDatabaseError = (error: unknown): error is DatabaseError => {
  return error instanceof Error
}

const buildErrorDetails = (error: DatabaseError): string => {
  return [error.message, error.detail, error.hint].filter(Boolean).join(' ')
}

const isSslConfigurationError = (error: DatabaseError): boolean => {
  const normalizedMessage = buildErrorDetails(error).toLowerCase()

  return isTlsVerificationError(error) || (
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
    'host' | 'port' | 'databaseName' | 'username' | 'password' | 'sslMode' | 'connectAddress'
  >
) => {
  return new Pool({
    host: input.connectAddress ?? input.host,
    port: input.port,
    database: input.databaseName,
    user: input.username,
    password: input.password,
    // The certificate must still match the name the customer gave.
    ssl: input.sslMode === 'require'
      ? { rejectUnauthorized: true, ...(input.connectAddress && !isIP(input.host) ? { servername: input.host } : {}) }
      : false,
    connectionTimeoutMillis: CONNECT_TIMEOUT_SECONDS * 1000,
    max: 1
  })
}

const isPrivilegedRole = async (runner: Pick<PoolClient, 'query'>) => {
  const result = await runner.query<{ privileged: boolean }>(PRIVILEGED_ROLE_SQL)

  return result.rows[0]?.privileged !== false
}

// Reading through a cursor enforces the limit without rewriting the SQL, so no
// comment or stray parenthesis in the query text can change it. The extended
// protocol it uses also makes PostgreSQL refuse multiple statements.
const readRows = (client: PoolClient, sql: string, rowLimit: number) => {
  const cursor = new Cursor<QueryResultRow>(sql)

  client.query(cursor)

  return new Promise<{ columns: string[], rows: QueryResultRow[] }>((resolve, reject) => {
    cursor.read(rowLimit, (error, rows, result) => {
      if (error) {
        reject(error)
        return
      }

      const columns = result.fields.map((field: FieldDef) => field.name)

      cursor.close(() => resolve({ columns, rows }))
    })
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

  if (isConnectionError(error)) {
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

  if (isConnectionError(error)) {
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

      result = await isPrivilegedRole(pool as unknown as Pick<PoolClient, 'query'>)
        ? { ok: false, code: 'privileged_role', message: 'privileged_role', details: PRIVILEGED_ROLE_DETAILS }
        : { ok: true, code: 'success', message: 'success' }
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
    const queryTimeoutMs = resolvePositiveInteger(
      input.timeoutMs,
      DEFAULT_QUERY_TIMEOUT_MS
    )
    const rowLimit = resolvePositiveInteger(
      input.maxRows,
      DEFAULT_QUERY_RESULT_ROW_LIMIT
    )

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
        `set local statement_timeout = '${queryTimeoutMs}ms'`
      )
      await client.query(
        `set local idle_in_transaction_session_timeout = '${queryTimeoutMs}ms'`
      )
      await client.query(
        `set local lock_timeout = '${QUERY_LOCK_TIMEOUT_MS}ms'`
      )
      await client.query('set local transaction read only')

      if (await isPrivilegedRole(client)) {
        await client.query('rollback')

        return {
          ok: false,
          code: 'query_rejected',
          message: 'query_rejected',
          details: PRIVILEGED_ROLE_DETAILS
        }
      }

      const { columns, rows } = await readRows(client, normalizedQuery.sql, rowLimit)

      await client.query('rollback')

      return {
        ok: true,
        code: 'success',
        message: 'success',
        columns,
        rows: rows.map((row: QueryResultRow) => sanitizeResultRow(row, columns)),
        rowLimit
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

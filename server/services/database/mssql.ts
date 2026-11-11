import { isIP } from 'node:net'
import sql from 'mssql'

import type {
  ExecuteDatabaseReadOnlyQueryInput,
  ExecuteDatabaseReadOnlyQueryResult,
  TestDatabaseConnectionInput,
  TestDatabaseConnectionResult
} from '../../types/database'
import { resolvePositiveInteger } from '../../utils/positive-integer'
import { findForbiddenTsqlKeyword, normalizeReadOnlySql } from '../../utils/read-only-sql'

import {
  CONNECT_TIMEOUT_SECONDS,
  DEFAULT_QUERY_RESULT_ROW_LIMIT,
  createResultSizeBudget,
  DEFAULT_QUERY_TIMEOUT_MS,
  PRIVILEGED_ROLE_DETAILS,
  QUERY_LOCK_TIMEOUT_MS,
  isTlsVerificationError,
  sanitizeResultRow
} from './shared'
import type { DatabaseConnectionTester, DatabaseQueryExecutor } from './types'

type SqlServerError = Error & { code?: string, number?: number, originalError?: Error }
type QueryFailure = Exclude<ExecuteDatabaseReadOnlyQueryResult, { ok: true }>

const LOGIN_FAILED_ERROR = 18456
const CANNOT_OPEN_DATABASE_ERROR = 4060
const LOCK_TIMEOUT_ERROR = 1222

const isAllowedPermission = (permission: string) => {
  return (
    permission === 'CONNECT' ||
    permission === 'CONNECT SQL' ||
    permission === 'SELECT' ||
    permission === 'SHOWPLAN' ||
    permission.startsWith('VIEW ')
  )
}

// SQL Server has no read-only transaction, so the login's own permissions are
// the boundary. This fails closed on any permission that is not plainly a read.
const EFFECTIVE_PERMISSIONS_SQL = `select permission_name from fn_my_permissions(NULL, 'DATABASE')
union all select permission_name from fn_my_permissions(NULL, 'SERVER')`

const WRITABLE_OBJECT_COUNT_SQL = `select count(*) as writable_objects
from sys.objects o
cross apply (select quotename(schema_name(o.schema_id)) + '.' + quotename(o.name) as object_name) n
where o.type in ('U', 'V') and o.is_ms_shipped = 0
  and (has_perms_by_name(n.object_name, 'OBJECT', 'INSERT') = 1
    or has_perms_by_name(n.object_name, 'OBJECT', 'UPDATE') = 1
    or has_perms_by_name(n.object_name, 'OBJECT', 'DELETE') = 1)`

const openPool = (
  input: Pick<TestDatabaseConnectionInput, 'host' | 'port' | 'databaseName' | 'username' | 'password' | 'sslMode' | 'connectAddress'>,
  requestTimeoutMs: number
) => {
  return new sql.ConnectionPool({
    server: input.connectAddress ?? input.host,
    port: input.port,
    database: input.databaseName,
    user: input.username,
    password: input.password,
    connectionTimeout: CONNECT_TIMEOUT_SECONDS * 1000,
    requestTimeout: requestTimeoutMs,
    pool: { min: 0, max: 1 },
    options: {
      encrypt: input.sslMode === 'require',
      trustServerCertificate: false,
      enableArithAbort: true,
      // The certificate must still match the name the customer gave.
      ...(input.connectAddress && !isIP(input.host) ? { serverName: input.host } : {})
    }
  }).connect()
}

const mapSqlServerError = (error: unknown): QueryFailure => {
  const fail = (code: QueryFailure['code'], details?: string): QueryFailure => ({ ok: false, code, message: code, details })

  if (!(error instanceof Error)) {
    return fail('unexpected_error', String(error))
  }

  const serverError = error as SqlServerError
  const original = serverError.originalError as SqlServerError | undefined
  const number = serverError.number ?? original?.number
  const details = serverError.message

  if (isTlsVerificationError(serverError) || (original && isTlsVerificationError(original))) return fail('ssl_required', details)
  if (number === CANNOT_OPEN_DATABASE_ERROR) return fail('database_not_found', details)
  if (number === LOGIN_FAILED_ERROR || serverError.code === 'ELOGIN') return fail('authentication_failed', details)
  if (number === LOCK_TIMEOUT_ERROR || serverError.code === 'ETIMEOUT') return fail('timeout', details)
  if (serverError.code === 'ESOCKET' || serverError.code === 'ENOTOPEN' || serverError.code === 'ECONNCLOSED') return fail('connection_failed', details)
  if (serverError.code === 'EREQUEST' || number !== undefined) return fail('query_failed', details)

  return fail('unexpected_error', details)
}

/**
 * Reports whether the login can do anything beyond reading. Exported for the
 * integration suite so the policy is tested against a real server.
 */
export const hasPrivilegedPermissions = async (request: () => sql.Request) => {
  const permissions = await request().query<{ permission_name: string }>(EFFECTIVE_PERMISSIONS_SQL)

  if (permissions.recordset.some((row) => !isAllowedPermission(row.permission_name))) {
    return true
  }

  const writable = await request().query<{ writable_objects: number }>(WRITABLE_OBJECT_COUNT_SQL)

  return (writable.recordset[0]?.writable_objects ?? 0) > 0
}

const readRows = (
  transaction: sql.Transaction,
  text: string,
  rowLimit: number
) => new Promise<{ columns: string[], rows: Record<string, unknown>[] }>((resolve, reject) => {
  const request = new sql.Request(transaction)
  const rows: Record<string, unknown>[] = []
  const fits = createResultSizeBudget()
  let columns: string[] | null = null
  let stopped = false
  let failure: Error | null = null

  const stop = () => {
    if (!stopped) {
      stopped = true
      request.cancel()
    }
  }

  request.stream = true
  request.on('recordset', (recordset: Record<string, { index: number, name: string }>) => {
    if (columns) {
      // A batch can return several result sets; only the first is the answer.
      stop()
      return
    }

    columns = Object.values(recordset).sort((a, b) => a.index - b.index).map((column) => column.name)
  })
  request.on('row', (row: Record<string, unknown>) => {
    if (stopped) return

    if (!fits(row)) {
      stop()
      return
    }

    rows.push(row)

    if (rows.length >= rowLimit) stop()
  })
  request.on('error', (error: SqlServerError) => {
    if (!stopped || error.code !== 'ECANCEL') failure = error
  })
  // Resolving on 'done' guarantees the request is idle before rollback.
  request.on('done', () => {
    if (failure) reject(failure)
    else resolve({ columns: columns ?? [], rows })
  })
  request.query(text)
})

export class SqlServerConnectionTester
implements DatabaseConnectionTester, DatabaseQueryExecutor {
  async testConnection(
    input: TestDatabaseConnectionInput
  ): Promise<TestDatabaseConnectionResult> {
    let pool: sql.ConnectionPool | null = null

    try {
      pool = await openPool(input, DEFAULT_QUERY_TIMEOUT_MS)

      const activePool = pool

      if (await hasPrivilegedPermissions(() => new sql.Request(activePool))) {
        return { ok: false, code: 'privileged_role', message: 'privileged_role', details: PRIVILEGED_ROLE_DETAILS }
      }

      return { ok: true, code: 'success', message: 'success' }
    } catch (error) {
      const result = mapSqlServerError(error)
      const isConnectionCode = !['query_failed', 'query_rejected'].includes(result.code)

      return {
        ok: false,
        code: isConnectionCode ? result.code as TestDatabaseConnectionResult['code'] : 'unexpected_error',
        message: isConnectionCode ? result.code : 'unexpected_error',
        details: result.details
      }
    } finally {
      await pool?.close().catch(() => undefined)
    }
  }

  async executeReadOnlyQuery(
    input: ExecuteDatabaseReadOnlyQueryInput
  ): Promise<ExecuteDatabaseReadOnlyQueryResult> {
    const normalizedQuery = normalizeReadOnlySql(input.sql)

    if (!normalizedQuery.ok) {
      return { ok: false, code: 'query_rejected', message: 'query_rejected', details: normalizedQuery.details }
    }

    // T-SQL needs no semicolon between statements, so one "SELECT" can hide
    // several. Refuse every statement keyword other than SELECT up front.
    if (findForbiddenTsqlKeyword(normalizedQuery.sql)) {
      return {
        ok: false,
        code: 'query_rejected',
        message: 'query_rejected',
        details: 'Only read-only SELECT queries are allowed.'
      }
    }

    const timeoutMs = resolvePositiveInteger(input.timeoutMs, DEFAULT_QUERY_TIMEOUT_MS)
    const rowLimit = resolvePositiveInteger(input.maxRows, DEFAULT_QUERY_RESULT_ROW_LIMIT)
    let pool: sql.ConnectionPool | null = null

    try {
      pool = await openPool(input, timeoutMs)

      const transaction = new sql.Transaction(pool)

      await transaction.begin()

      try {
        await new sql.Request(transaction).batch(`set lock_timeout ${QUERY_LOCK_TIMEOUT_MS}`)

        if (await hasPrivilegedPermissions(() => new sql.Request(transaction))) {
          return { ok: false, code: 'query_rejected', message: 'query_rejected', details: PRIVILEGED_ROLE_DETAILS }
        }

        const { columns, rows } = await readRows(transaction, normalizedQuery.sql, rowLimit)

        return {
          ok: true,
          code: 'success',
          message: 'success',
          columns,
          rows: rows.map((row) => sanitizeResultRow(row, columns)),
          rowLimit
        }
      } finally {
        await transaction.rollback().catch(() => undefined)
      }
    } catch (error) {
      return mapSqlServerError(error)
    } finally {
      await pool?.close().catch(() => undefined)
    }
  }
}

import { isIP } from 'node:net'
import sql from 'mssql'

import type {
  ExecuteDatabaseReadOnlyQueryInput,
  ExecuteDatabaseReadOnlyQueryResult,
  ExplainDatabaseQueryInput,
  ExplainDatabaseQueryResult,
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
import { normalizeSqlServerPlan, readSqlServerMissingIndexes, truncateRawPlan } from './query-plan'
import type { DatabaseConnectionTester, DatabaseQueryExecutor } from './types'

type SqlServerError = Error & { code?: string, number?: number, originalError?: Error }
type QueryFailure = Exclude<ExecuteDatabaseReadOnlyQueryResult, { ok: true }>

const LOGIN_FAILED_ERROR = 18456
const CANNOT_OPEN_DATABASE_ERROR = 4060
const LOCK_TIMEOUT_ERROR = 1222
const SHOWPLAN_COLUMN = /showplan/i
// The driver returns bigint as text; decimals may come as text too.
const NUMERIC_TYPES: unknown[] = [sql.BigInt, sql.Decimal, sql.Numeric, sql.Money, sql.SmallMoney]
const SHOWPLAN_PERMISSION_DETAILS =
  'Showing a plan needs the SHOWPLAN permission. Grant it to this read-only login: GRANT SHOWPLAN TO [login user].'

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

/** A login without SHOWPLAN gets a clear answer about the one permission it needs. */
const showplanPermissionFailure = (failure: QueryFailure): ExplainDatabaseQueryResult => {
  return /SHOWPLAN permission denied/i.test(failure.details ?? '')
    ? { ok: false, code: 'permission_denied', message: 'permission_denied', details: SHOWPLAN_PERMISSION_DETAILS }
    : failure
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

/**
 * Runs a batch and keeps only the showplan XML it returns. With STATISTICS XML
 * the query's own rows come first; they are read and dropped, never kept.
 */
const readPlanXml = (
  transaction: sql.Transaction,
  text: string
) => new Promise<string>((resolve, reject) => {
  const request = new sql.Request(transaction)
  let isPlanResult = false
  let plan = ''
  let failure: Error | null = null

  request.stream = true
  request.on('recordset', (recordset: Record<string, { name: string }>) => {
    isPlanResult = Object.values(recordset).some(column => SHOWPLAN_COLUMN.test(column.name))
  })
  request.on('row', (row: Record<string, unknown>) => {
    if (!isPlanResult || plan) return

    plan = String(Object.values(row)[0] ?? '')
  })
  request.on('error', (error: Error) => {
    failure = error
  })
  request.on('done', () => {
    if (failure) reject(failure)
    else resolve(plan)
  })
  // SHOWPLAN answers plain batches only, not sp_executesql. The text has
  // already passed the single-SELECT check in inReadOnlySession.
  request.batch(text)
})

const readRows = (
  transaction: sql.Transaction,
  text: string,
  rowLimit: number
) => new Promise<{ columns: string[], rows: Record<string, unknown>[], numericColumns: Set<string> }>((resolve, reject) => {
  const request = new sql.Request(transaction)
  const rows: Record<string, unknown>[] = []
  const numericColumns = new Set<string>()
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
  request.on('recordset', (recordset: Record<string, { index: number, name: string, type?: unknown }>) => {
    if (columns) {
      // A batch can return several result sets; only the first is the answer.
      stop()
      return
    }

    columns = Object.values(recordset).sort((a, b) => a.index - b.index).map((column) => column.name)

    for (const column of Object.values(recordset)) {
      if (NUMERIC_TYPES.includes(column.type)) numericColumns.add(column.name)
    }
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
    else resolve({ columns: columns ?? [], rows, numericColumns })
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

  /**
   * Runs work inside a transaction that is always rolled back, after refusing
   * anything but a single SELECT and refusing privileged logins. Explaining a
   * query uses exactly the same session as running it.
   */
  private async inReadOnlySession<Success> (
    input: ExecuteDatabaseReadOnlyQueryInput,
    work: (transaction: sql.Transaction, text: string) => Promise<Success>
  ): Promise<Success | QueryFailure> {
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

        return await work(transaction, normalizedQuery.sql)
      } finally {
        await transaction.rollback().catch(() => undefined)
      }
    } catch (error) {
      return mapSqlServerError(error)
    } finally {
      await pool?.close().catch(() => undefined)
    }
  }

  async executeReadOnlyQuery(
    input: ExecuteDatabaseReadOnlyQueryInput
  ): Promise<ExecuteDatabaseReadOnlyQueryResult> {
    const rowLimit = resolvePositiveInteger(input.maxRows, DEFAULT_QUERY_RESULT_ROW_LIMIT)

    return this.inReadOnlySession(input, async (transaction, text) => {
      const { columns, rows, numericColumns } = await readRows(transaction, text, rowLimit)

      return {
        ok: true as const,
        code: 'success' as const,
        message: 'success' as const,
        columns,
        rows: rows.map((row) => sanitizeResultRow(row, columns, numericColumns)),
        rowLimit
      }
    })
  }

  /**
   * Asks SQL Server for its plan. SHOWPLAN_XML only compiles the query; with
   * analyze, STATISTICS XML runs it inside the rolled-back transaction.
   */
  async explainQuery(
    input: ExplainDatabaseQueryInput
  ): Promise<ExplainDatabaseQueryResult> {
    const option = input.analyze ? 'statistics xml' : 'showplan_xml'

    const result = await this.inReadOnlySession(input, async (transaction, text) => {
        // Each SET must be alone in its batch.
        await new sql.Request(transaction).batch(`set ${option} on`)

        try {
          const xml = await readPlanXml(transaction, text)

          return {
            ok: true as const,
            code: 'success' as const,
            message: 'success' as const,
            plan: {
              engine: 'mssql' as const,
              analyzed: input.analyze,
              root: normalizeSqlServerPlan(xml, input.analyze),
              raw: truncateRawPlan(xml),
              missingIndexes: readSqlServerMissingIndexes(xml)
            }
          }
        } finally {
          await new sql.Request(transaction).batch(`set ${option} off`).catch(() => undefined)
        }
      })

    return result.ok ? result : showplanPermissionFailure(result)
  }
}

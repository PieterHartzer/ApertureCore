import { connect } from 'node:net'
import type { Connection as CoreConnection } from 'mysql2'
import { createConnection, type Connection, type ConnectionOptions, type FieldPacket, type RowDataPacket } from 'mysql2/promise'

import type {
  ExecuteDatabaseReadOnlyQueryInput,
  ExecuteDatabaseReadOnlyQueryResult,
  ExplainDatabaseQueryInput,
  ExplainDatabaseQueryResult,
  TestDatabaseConnectionInput,
  TestDatabaseConnectionResult
} from '../../types/database'
import { resolvePositiveInteger } from '../../utils/positive-integer'
import { normalizeMySqlAnalyzeTree, normalizeMySqlPlan, truncateRawPlan } from './query-plan'
import { normalizeReadOnlySql } from '../../utils/read-only-sql'

import {
  CONNECT_TIMEOUT_SECONDS,
  DEFAULT_QUERY_RESULT_ROW_LIMIT,
  createResultSizeBudget,
  DEFAULT_QUERY_TIMEOUT_MS,
  PRIVILEGED_ROLE_DETAILS,
  isTlsVerificationError,
  sanitizeResultRow
} from './shared'
import type { DatabaseConnectionTester, DatabaseQueryExecutor } from './types'

type MySqlError = Error & { code?: string, errno?: number, sqlMessage?: string }
// DECIMAL, BIGINT and NEWDECIMAL, which the driver returns as text so nothing is lost.
const NUMERIC_COLUMN_TYPES = new Set([0, 8, 246])

type QueryFailure = Exclude<ExecuteDatabaseReadOnlyQueryResult, { ok: true }>
type QueryFailureCode = QueryFailure['code']

// Global privileges a read-only login may hold. Everything else, including
// FILE (SELECT ... INTO OUTFILE, LOAD_FILE) and SUPER, is refused.
const ALLOWED_GLOBAL_PRIVILEGES = new Set(['USAGE', 'SELECT', 'SHOW VIEW', 'SHOW DATABASES'])
const AUTHENTICATION_ERROR_CODES = new Set(['ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_NOT_SUPPORTED_AUTH_MODE'])
const SSL_ERROR_CODES = new Set(['HANDSHAKE_NO_SSL_SUPPORT', 'ER_SECURE_TRANSPORT_REQUIRED'])
const TIMEOUT_ERROR_CODES = new Set(['ETIMEDOUT', 'ER_QUERY_TIMEOUT', 'ER_STATEMENT_TIMEOUT', 'ER_LOCK_WAIT_TIMEOUT', 'PROTOCOL_SEQUENCE_TIMEOUT'])
const READ_ONLY_ERROR_CODES = new Set(['ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION'])
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'PROTOCOL_CONNECTION_LOST'
])

const openConnection = (input: Pick<
  TestDatabaseConnectionInput,
  'host' | 'port' | 'databaseName' | 'username' | 'password' | 'sslMode' | 'connectAddress'
>) => {
  const options: ConnectionOptions = {
    // The host stays the customer's name so the certificate is checked against it.
    host: input.host,
    port: input.port,
    ...(input.connectAddress ? { stream: connect(input.port, input.connectAddress) } : {}),
    database: input.databaseName,
    user: input.username,
    password: input.password,
    connectTimeout: CONNECT_TIMEOUT_SECONDS * 1000,
    multipleStatements: false,
    // The host is user-supplied, so a hostile server must not be able to
    // request files from the application server with LOAD DATA LOCAL.
    flags: ['-LOCAL_FILES'],
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true
  }

  if (input.sslMode === 'require') {
    options.ssl = { rejectUnauthorized: true, verifyIdentity: true }
  }

  return createConnection(options)
}

const mapMySqlError = (error: unknown): Exclude<ExecuteDatabaseReadOnlyQueryResult, { ok: true }> => {
  const fail = (code: QueryFailureCode, details?: string) => ({ ok: false as const, code, message: code, details })

  if (!(error instanceof Error)) {
    return fail('unexpected_error', String(error))
  }

  const mysqlError = error as MySqlError
  const details = mysqlError.sqlMessage ?? mysqlError.message
  const code = mysqlError.code ?? ''

  if (SSL_ERROR_CODES.has(code) || isTlsVerificationError(mysqlError)) return fail('ssl_required', details)
  if (AUTHENTICATION_ERROR_CODES.has(code)) return fail('authentication_failed', details)
  if (code === 'ER_BAD_DB_ERROR') return fail('database_not_found', details)
  if (TIMEOUT_ERROR_CODES.has(code)) return fail('timeout', details)
  if (CONNECTION_ERROR_CODES.has(code)) return fail('connection_failed', details)
  if (READ_ONLY_ERROR_CODES.has(code)) return fail('query_rejected', details)
  if (mysqlError.sqlMessage !== undefined) return fail('query_failed', details)

  return fail('unexpected_error', details)
}

const isMariaDb = async (connection: Connection) => {
  const [rows] = await connection.query<RowDataPacket[]>('select version() as version')

  return /mariadb/i.test(String(rows[0]?.version))
}

const parseGlobalPrivileges = (grant: string): string[] | null => {
  const match = /^GRANT\s+(.+?)\s+ON\s+\*\.\*\s+TO\s/i.exec(grant)

  if (!match?.[1]) return null

  const privileges = match[1].split(',').map((privilege) => privilege.trim().toUpperCase())

  return /WITH\s+GRANT\s+OPTION/i.test(grant) ? [...privileges, 'GRANT OPTION'] : privileges
}

/**
 * MySQL has no way to stop FILE-privileged reads inside a read-only
 * transaction, so the login itself must be limited to reading.
 */
export const hasPrivilegedGrant = (grants: string[]) => {
  return grants.some((grant) =>
    parseGlobalPrivileges(grant)?.some((privilege) => !ALLOWED_GLOBAL_PRIVILEGES.has(privilege))
  )
}

const loadGrants = async (connection: Connection, mariaDb: boolean) => {
  let statement = 'show grants'

  if (!mariaDb) {
    // SHOW GRANTS omits privileges inherited from active roles unless asked.
    const [roles] = await connection.query<RowDataPacket[]>('select current_role() as active_roles')
    const activeRoles = String(roles[0]?.active_roles ?? 'NONE')

    if (activeRoles !== 'NONE') {
      statement = `show grants for current_user() using ${activeRoles}`
    }
  }

  const [rows] = await connection.query<RowDataPacket[]>(statement)

  return rows.map((row) => String(Object.values(row)[0]))
}

const readRows = (
  connection: Connection,
  sql: string,
  rowLimit: number,
  timeoutMs: number
) => new Promise<{ columns: string[], rows: Record<string, unknown>[], numericColumns: Set<string> }>((resolve, reject) => {
  const columns: string[] = []
  const numericColumns = new Set<string>()
  const rows: Record<string, unknown>[] = []
  const fits = createResultSizeBudget()
  let settled = false

  const settle = (finish: () => void) => {
    if (settled) return

    settled = true
    clearTimeout(timer)
    finish()
  }

  // Backstop for servers that ignore the session timeout, such as a query
  // blocked before execution starts.
  const timer = setTimeout(() => {
    settle(() => {
      connection.destroy()
      reject(Object.assign(new Error('Query timed out.'), { code: 'ETIMEDOUT' }))
    })
  }, timeoutMs + 1_000)

  // Rows are streamed so the limit holds whatever the SQL text contains.
  const coreConnection = (connection as unknown as { connection: CoreConnection }).connection

  coreConnection.query(sql)
    .on('fields', (fields: FieldPacket[]) => {
      columns.push(...fields.map((field) => field.name))

      for (const field of fields) {
        if (NUMERIC_COLUMN_TYPES.has((field as { columnType?: number }).columnType ?? -1)) numericColumns.add(field.name)
      }
    })
    .on('result', (row: unknown) => {
      if (settled) return

      const full = !fits(row as Record<string, unknown>)

      if (!full) rows.push(row as Record<string, unknown>)

      if (full || rows.length >= rowLimit) {
        settle(() => {
          connection.destroy()
          resolve({ columns, rows, numericColumns })
        })
      }
    })
    .on('error', (error: Error) => settle(() => reject(error)))
    .on('end', () => settle(() => resolve({ columns, rows, numericColumns })))
})

export class MySqlConnectionTester
implements DatabaseConnectionTester, DatabaseQueryExecutor {
  async testConnection(
    input: TestDatabaseConnectionInput
  ): Promise<TestDatabaseConnectionResult> {
    let connection: Connection | null = null

    try {
      connection = await openConnection(input)

      if (hasPrivilegedGrant(await loadGrants(connection, await isMariaDb(connection)))) {
        return { ok: false, code: 'privileged_role', message: 'privileged_role', details: PRIVILEGED_ROLE_DETAILS }
      }

      return { ok: true, code: 'success', message: 'success' }
    } catch (error) {
      const result = mapMySqlError(error)
      const isConnectionCode = !['query_failed', 'query_rejected'].includes(result.code)

      return {
        ok: false,
        code: isConnectionCode ? result.code as TestDatabaseConnectionResult['code'] : 'unexpected_error',
        message: isConnectionCode ? result.code : 'unexpected_error',
        details: result.details
      }
    } finally {
      connection?.destroy()
    }
  }

  /**
   * Runs work inside a read-only transaction with the query's time limits,
   * after refusing privileged logins. Explaining a query uses exactly the same
   * session as running it.
   */
  private async inReadOnlySession<Success> (
    input: ExecuteDatabaseReadOnlyQueryInput,
    work: (connection: Connection, sql: string, mariaDb: boolean, timeoutMs: number) => Promise<Success>
  ): Promise<Success | QueryFailure> {
    const normalizedQuery = normalizeReadOnlySql(input.sql)

    if (!normalizedQuery.ok) {
      return { ok: false, code: 'query_rejected', message: 'query_rejected', details: normalizedQuery.details }
    }

    const timeoutMs = resolvePositiveInteger(input.timeoutMs, DEFAULT_QUERY_TIMEOUT_MS)
    let connection: Connection | null = null

    try {
      connection = await openConnection(input)

      const mariaDb = await isMariaDb(connection)

      if (hasPrivilegedGrant(await loadGrants(connection, mariaDb))) {
        return { ok: false, code: 'query_rejected', message: 'query_rejected', details: PRIVILEGED_ROLE_DETAILS }
      }

      await connection.query(
        mariaDb
          ? `set session max_statement_time = ${timeoutMs / 1000}`
          : `set session max_execution_time = ${timeoutMs}`
      )
      await connection.query('set session lock_wait_timeout = 1')
      await connection.query('start transaction read only')

      return await work(connection, normalizedQuery.sql, mariaDb, timeoutMs)
    } catch (error) {
      return mapMySqlError(error)
    } finally {
      // Closing the session discards the read-only transaction.
      connection?.destroy()
    }
  }

  async executeReadOnlyQuery(
    input: ExecuteDatabaseReadOnlyQueryInput
  ): Promise<ExecuteDatabaseReadOnlyQueryResult> {
    const rowLimit = resolvePositiveInteger(input.maxRows, DEFAULT_QUERY_RESULT_ROW_LIMIT)

    return this.inReadOnlySession(input, async (connection, sql, _mariaDb, timeoutMs) => {
      const { columns, rows, numericColumns } = await readRows(connection, sql, rowLimit, timeoutMs)

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
   * Asks MySQL or MariaDB for its plan. With analyze, the query runs (still
   * read only, still inside the time limit): MariaDB answers in JSON, MySQL
   * as an indented text tree.
   */
  async explainQuery(
    input: ExplainDatabaseQueryInput
  ): Promise<ExplainDatabaseQueryResult> {
    return this.inReadOnlySession(input, async (connection, sql, mariaDb, timeoutMs) => {
      const statement = !input.analyze
        ? `explain format=json ${sql}`
        : mariaDb ? `analyze format=json ${sql}` : `explain analyze ${sql}`
      const { columns, rows } = await readRows(connection, statement, 1, timeoutMs)
      const output = String(rows[0]?.[columns[0] ?? ''] ?? '')
      const tree = input.analyze && !mariaDb

      return {
        ok: true as const,
        code: 'success' as const,
        message: 'success' as const,
        plan: {
          engine: mariaDb ? 'mariadb' as const : 'mysql' as const,
          analyzed: input.analyze,
          root: tree ? normalizeMySqlAnalyzeTree(output) : normalizeMySqlPlan(output),
          raw: truncateRawPlan(output)
        }
      }
    })
  }
}

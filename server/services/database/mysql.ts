import { connect } from 'node:net'
import type { Connection as CoreConnection } from 'mysql2'
import { createConnection, type Connection, type ConnectionOptions, type FieldPacket, type RowDataPacket } from 'mysql2/promise'

import type {
  ExecuteDatabaseReadOnlyQueryInput,
  ExecuteDatabaseReadOnlyQueryResult,
  TestDatabaseConnectionInput,
  TestDatabaseConnectionResult
} from '../../types/database'
import { resolvePositiveInteger } from '../../utils/positive-integer'
import { normalizeReadOnlySql } from '../../utils/read-only-sql'

import {
  CONNECT_TIMEOUT_SECONDS,
  DEFAULT_QUERY_RESULT_ROW_LIMIT,
  DEFAULT_QUERY_TIMEOUT_MS,
  PRIVILEGED_ROLE_DETAILS,
  isTlsVerificationError,
  sanitizeResultRow
} from './shared'
import type { DatabaseConnectionTester, DatabaseQueryExecutor } from './types'

type MySqlError = Error & { code?: string, errno?: number, sqlMessage?: string }
type QueryFailureCode = Exclude<ExecuteDatabaseReadOnlyQueryResult, { ok: true }>['code']

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
) => new Promise<{ columns: string[], rows: Record<string, unknown>[] }>((resolve, reject) => {
  const columns: string[] = []
  const rows: Record<string, unknown>[] = []
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
    })
    .on('result', (row: unknown) => {
      if (settled) return

      rows.push(row as Record<string, unknown>)

      if (rows.length >= rowLimit) {
        settle(() => {
          connection.destroy()
          resolve({ columns, rows })
        })
      }
    })
    .on('error', (error: Error) => settle(() => reject(error)))
    .on('end', () => settle(() => resolve({ columns, rows })))
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

  async executeReadOnlyQuery(
    input: ExecuteDatabaseReadOnlyQueryInput
  ): Promise<ExecuteDatabaseReadOnlyQueryResult> {
    const normalizedQuery = normalizeReadOnlySql(input.sql)

    if (!normalizedQuery.ok) {
      return { ok: false, code: 'query_rejected', message: 'query_rejected', details: normalizedQuery.details }
    }

    const timeoutMs = resolvePositiveInteger(input.timeoutMs, DEFAULT_QUERY_TIMEOUT_MS)
    const rowLimit = resolvePositiveInteger(input.maxRows, DEFAULT_QUERY_RESULT_ROW_LIMIT)
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

      const { columns, rows } = await readRows(connection, normalizedQuery.sql, rowLimit, timeoutMs)

      return {
        ok: true,
        code: 'success',
        message: 'success',
        columns,
        rows: rows.map((row) => sanitizeResultRow(row, columns)),
        rowLimit
      }
    } catch (error) {
      return mapMySqlError(error)
    } finally {
      // Closing the session discards the read-only transaction.
      connection?.destroy()
    }
  }
}

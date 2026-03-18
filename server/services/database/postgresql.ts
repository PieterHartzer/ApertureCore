import postgres from 'postgres'

import type { TestDatabaseConnectionInput, TestDatabaseConnectionResult } from '../../types/database'

import type { DatabaseConnectionTester } from './types'

const CONNECT_TIMEOUT_SECONDS = 5
const DEFAULT_POSTGRES_PORT = 5432

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

const mapPostgreSqlError = (error: unknown): TestDatabaseConnectionResult => {
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

export class PostgreSqlConnectionTester implements DatabaseConnectionTester {
  async testConnection(
    input: TestDatabaseConnectionInput
  ): Promise<TestDatabaseConnectionResult> {
    const sql = postgres({
      host: input.host,
      port: input.port ?? DEFAULT_POSTGRES_PORT,
      database: input.databaseName,
      user: input.username,
      password: input.password,
      ssl: input.sslMode === 'require' ? 'require' : false,
      max: 1,
      idle_timeout: 1,
      connect_timeout: CONNECT_TIMEOUT_SECONDS,
      prepare: false,
      onnotice: () => {}
    })

    try {
      await sql`select 1`

      return {
        ok: true,
        code: 'success',
        message: 'success'
      }
    } catch (error) {
      return mapPostgreSqlError(error)
    } finally {
      await sql.end({ timeout: 0 }).catch(() => undefined)
    }
  }
}

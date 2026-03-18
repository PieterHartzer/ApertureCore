import type {
  DatabaseSslMode,
  DatabaseType,
  TestDatabaseConnectionInput,
  TestDatabaseConnectionValidationError,
  TestDatabaseConnectionValidationIssue,
  TestDatabaseConnectionValidationResult,
} from '../types/database'

import {
  SERVER_DATABASE_SSL_MODES,
  SERVER_DATABASE_TYPES,
} from '../types/database'

const createValidationError = (
  issue: TestDatabaseConnectionValidationIssue,
  field?: TestDatabaseConnectionValidationError['field']
): TestDatabaseConnectionValidationError => ({
  ok: false,
  code: 'invalid_input',
  issue,
  message: issue,
  field
})

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isString = (value: unknown): value is string => {
  return typeof value === 'string'
}

const parsePort = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)

    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

export const validateTestDatabaseConnectionInput = (
  value: unknown
): TestDatabaseConnectionValidationResult => {
  if (!isRecord(value)) {
    return createValidationError(
      'body_invalid',
      'body'
    )
  }

  const connectionName = value.connectionName
  const databaseType = value.databaseType
  const host = value.host
  const port = value.port
  const databaseName = value.databaseName
  const username = value.username
  const password = value.password
  const sslMode = value.sslMode

  if (!isString(connectionName) && connectionName !== undefined) {
    return createValidationError(
      'connection_name_invalid',
      'connectionName'
    )
  }

  if (!isString(databaseType)) {
    return createValidationError(
      'database_type_invalid',
      'databaseType'
    )
  }

  const normalizedDatabaseType = databaseType.trim()

  if (!SERVER_DATABASE_TYPES.includes(normalizedDatabaseType as DatabaseType)) {
    return createValidationError(
      'database_type_invalid',
      'databaseType'
    )
  }

  if (!isString(host) || !host.trim()) {
    return createValidationError('host_required', 'host')
  }

  const normalizedPort = parsePort(port)

  if (normalizedPort === null) {
    return createValidationError(
      'port_invalid',
      'port'
    )
  }

  if (!isString(databaseName) || !databaseName.trim()) {
    return createValidationError(
      'database_name_required',
      'databaseName'
    )
  }

  if (!isString(username) || !username.trim()) {
    return createValidationError(
      'username_required',
      'username'
    )
  }

  if (!isString(password) || !password.trim()) {
    return createValidationError(
      'password_required',
      'password'
    )
  }

  if (!isString(sslMode)) {
    return createValidationError(
      'ssl_mode_invalid',
      'sslMode'
    )
  }

  const normalizedSslMode = sslMode.trim()

  if (!SERVER_DATABASE_SSL_MODES.includes(normalizedSslMode as DatabaseSslMode)) {
    return createValidationError(
      'ssl_mode_invalid',
      'sslMode'
    )
  }

  const normalizedInput: TestDatabaseConnectionInput = {
    connectionName: isString(connectionName) ? connectionName.trim() : '',
    databaseType: normalizedDatabaseType as DatabaseType,
    host: host.trim(),
    port: normalizedPort,
    databaseName: databaseName.trim(),
    username: username.trim(),
    password,
    sslMode: normalizedSslMode as DatabaseSslMode
  }

  return {
    ok: true,
    data: normalizedInput
  }
}

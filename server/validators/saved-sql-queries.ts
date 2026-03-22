import type {
  SaveSavedSqlQueryInput,
  SaveSavedSqlQueryValidationError,
  SaveSavedSqlQueryValidationIssue,
  SaveSavedSqlQueryValidationResult,
  TestSavedSqlQueryInput,
  TestSavedSqlQueryValidationError,
  TestSavedSqlQueryValidationIssue,
  TestSavedSqlQueryValidationResult
} from '../types/saved-sql-queries'
import { isUuid } from '../utils/is-uuid'
import { normalizeReadOnlySql } from '../utils/read-only-sql'

const createValidationError = (
  issue: SaveSavedSqlQueryValidationIssue,
  field?: SaveSavedSqlQueryValidationError['field']
): SaveSavedSqlQueryValidationError => ({
  ok: false,
  code: 'invalid_input',
  issue,
  message: issue,
  field
})

const createTestValidationError = (
  issue: TestSavedSqlQueryValidationIssue,
  field?: TestSavedSqlQueryValidationError['field']
): TestSavedSqlQueryValidationError => ({
  ok: false,
  code: 'invalid_input',
  issue,
  message: issue,
  field
})

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validates the saved SQL query create payload while preserving the exact SQL
 * text for encryption and storage.
 */
export const validateSaveSavedSqlQueryInput = (
  value: unknown
): SaveSavedSqlQueryValidationResult => {
  if (!isRecord(value)) {
    return createValidationError(
      'body_invalid',
      'body'
    )
  }

  if (typeof value.queryName !== 'string') {
    return createValidationError(
      'query_name_invalid',
      'queryName'
    )
  }

  const queryName = value.queryName.trim()

  if (!queryName) {
    return createValidationError(
      'query_name_required',
      'queryName'
    )
  }

  if (typeof value.connectionId !== 'string' || !isUuid(value.connectionId.trim())) {
    return createValidationError(
      'connection_id_invalid',
      'connectionId'
    )
  }

  if (typeof value.sql !== 'string') {
    return createValidationError(
      'sql_invalid',
      'sql'
    )
  }

  if (!value.sql.trim()) {
    return createValidationError(
      'sql_required',
      'sql'
    )
  }

  const normalizedSql = normalizeReadOnlySql(value.sql)

  if (!normalizedSql.ok) {
    return createValidationError(
      normalizedSql.issue,
      'sql'
    )
  }

  const normalizedInput: SaveSavedSqlQueryInput = {
    queryName,
    connectionId: value.connectionId.trim(),
    sql: value.sql
  }

  return {
    ok: true,
    data: normalizedInput
  }
}

/**
 * Validates the saved SQL query test payload while preserving the exact SQL
 * text for read-only execution.
 */
export const validateTestSavedSqlQueryInput = (
  value: unknown
): TestSavedSqlQueryValidationResult => {
  if (!isRecord(value)) {
    return createTestValidationError(
      'body_invalid',
      'body'
    )
  }

  if (typeof value.connectionId !== 'string' || !isUuid(value.connectionId.trim())) {
    return createTestValidationError(
      'connection_id_invalid',
      'connectionId'
    )
  }

  if (typeof value.sql !== 'string') {
    return createTestValidationError(
      'sql_invalid',
      'sql'
    )
  }

  if (!value.sql.trim()) {
    return createTestValidationError(
      'sql_required',
      'sql'
    )
  }

  const normalizedInput: TestSavedSqlQueryInput = {
    connectionId: value.connectionId.trim(),
    sql: value.sql
  }

  return {
    ok: true,
    data: normalizedInput
  }
}

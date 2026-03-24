import type {
  DeleteSavedSqlQueryValidationError,
  DeleteSavedSqlQueryValidationIssue,
  DeleteSavedSqlQueryValidationResult,
  RunSavedSqlQueryInput,
  RunSavedSqlQueryValidationError,
  RunSavedSqlQueryValidationIssue,
  RunSavedSqlQueryValidationResult,
  SaveSavedSqlQueryInput,
  SaveSavedSqlQueryValidationError,
  SaveSavedSqlQueryValidationIssue,
  SaveSavedSqlQueryValidationResult,
  SavedSqlQueryIdValidationResult,
  TestSavedSqlQueryInput,
  TestSavedSqlQueryValidationError,
  TestSavedSqlQueryValidationIssue,
  TestSavedSqlQueryValidationResult,
  UpdateSavedSqlQueryValidationError,
  UpdateSavedSqlQueryValidationIssue,
  UpdateSavedSqlQueryValidationResult
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

const createRunValidationError = (
  issue: RunSavedSqlQueryValidationIssue,
  field?: RunSavedSqlQueryValidationError['field']
): RunSavedSqlQueryValidationError => ({
  ok: false,
  code: 'invalid_input',
  issue,
  message: issue,
  field
})

const createUpdateValidationError = (
  issue: UpdateSavedSqlQueryValidationIssue,
  field?: UpdateSavedSqlQueryValidationError['field']
): UpdateSavedSqlQueryValidationError => ({
  ok: false,
  code: 'invalid_input',
  issue,
  message: issue,
  field
})

const createDeleteValidationError = (
  issue: DeleteSavedSqlQueryValidationIssue,
  field?: DeleteSavedSqlQueryValidationError['field']
): DeleteSavedSqlQueryValidationError => ({
  ok: false,
  code: 'invalid_input',
  issue,
  message: issue,
  field
})

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const validateSavedSqlQueryId = (
  queryId: unknown
): SavedSqlQueryIdValidationResult => {
  if (typeof queryId !== 'string' || !isUuid(queryId.trim())) {
    return {
      ok: false,
      code: 'invalid_input',
      issue: 'query_id_invalid',
      message: 'query_id_invalid',
      field: 'queryId'
    }
  }

  return {
    ok: true,
    data: {
      queryId: queryId.trim()
    }
  }
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

export const validateUpdateSavedSqlQueryInput = (
  queryId: unknown,
  value: unknown
): UpdateSavedSqlQueryValidationResult => {
  const queryIdValidation = validateSavedSqlQueryId(queryId)

  if (!queryIdValidation.ok) {
    return queryIdValidation
  }

  const validationResult = validateSaveSavedSqlQueryInput(value)

  if (!validationResult.ok) {
    return createUpdateValidationError(
      validationResult.issue,
      validationResult.field
    )
  }

  return {
    ok: true,
    data: {
      queryId: queryIdValidation.data.queryId,
      ...validationResult.data
    }
  }
}

export const validateDeleteSavedSqlQueryInput = (
  queryId: unknown,
  value: unknown
): DeleteSavedSqlQueryValidationResult => {
  const queryIdValidation = validateSavedSqlQueryId(queryId)

  if (!queryIdValidation.ok) {
    return queryIdValidation
  }

  if (!isRecord(value)) {
    return createDeleteValidationError(
      'body_invalid',
      'body'
    )
  }

  if (typeof value.confirmationName !== 'string') {
    return createDeleteValidationError(
      'confirmation_name_invalid',
      'confirmationName'
    )
  }

  const confirmationName = value.confirmationName.trim()

  if (!confirmationName) {
    return createDeleteValidationError(
      'confirmation_name_required',
      'confirmationName'
    )
  }

  return {
    ok: true,
    data: {
      queryId: queryIdValidation.data.queryId,
      confirmationName
    }
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

export const validateRunSavedSqlQueryInput = (
  value: unknown
): RunSavedSqlQueryValidationResult => {
  if (!isRecord(value)) {
    return createRunValidationError(
      'body_invalid',
      'body'
    )
  }

  if (typeof value.connectionId !== 'string' || !isUuid(value.connectionId.trim())) {
    return createRunValidationError(
      'connection_id_invalid',
      'connectionId'
    )
  }

  if (typeof value.queryId !== 'string' || !isUuid(value.queryId.trim())) {
    return createRunValidationError(
      'query_id_invalid',
      'queryId'
    )
  }

  const normalizedInput: RunSavedSqlQueryInput = {
    connectionId: value.connectionId.trim(),
    queryId: value.queryId.trim()
  }

  return {
    ok: true,
    data: normalizedInput
  }
}

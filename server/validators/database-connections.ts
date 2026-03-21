import type {
  DeleteDatabaseConnectionValidationError,
  DeleteDatabaseConnectionValidationIssue,
  DeleteDatabaseConnectionValidationResult,
  SaveDatabaseConnectionValidationError,
  SaveDatabaseConnectionValidationIssue,
  SaveDatabaseConnectionValidationResult
} from '../types/database-connections'
import { isUuid } from '../utils/is-uuid'
import { validateTestDatabaseConnectionInput } from './database'

const createValidationError = (
  issue: SaveDatabaseConnectionValidationIssue,
  field?: SaveDatabaseConnectionValidationError['field']
): SaveDatabaseConnectionValidationError => ({
  ok: false,
  code: 'invalid_input',
  issue,
  message: issue,
  field
})

const createDeleteValidationError = (
  issue: DeleteDatabaseConnectionValidationIssue,
  field?: DeleteDatabaseConnectionValidationError['field']
): DeleteDatabaseConnectionValidationError => ({
  ok: false,
  code: 'invalid_input',
  issue,
  message: issue,
  field
})

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const validateSaveDatabaseConnectionInput = (
  value: unknown
): SaveDatabaseConnectionValidationResult => {
  const validationResult = validateTestDatabaseConnectionInput(value)

  if (!validationResult.ok) {
    return {
      ...validationResult
    }
  }

  if (!validationResult.data.connectionName.trim()) {
    return createValidationError(
      'connection_name_required',
      'connectionName'
    )
  }

  return {
    ok: true,
    data: validationResult.data
  }
}

/**
 * Validates the connection deletion request payload and route parameter.
 */
export const validateDeleteDatabaseConnectionInput = (
  connectionId: unknown,
  value: unknown
): DeleteDatabaseConnectionValidationResult => {
  if (typeof connectionId !== 'string' || !isUuid(connectionId.trim())) {
    return createDeleteValidationError(
      'connection_id_invalid',
      'connectionId'
    )
  }

  if (!isRecord(value)) {
    return createDeleteValidationError(
      'body_invalid',
      'body'
    )
  }

  if (
    typeof value.confirmationName !== 'string'
  ) {
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

  if (typeof value.deleteLinkedQueries !== 'boolean') {
    return createDeleteValidationError(
      'delete_linked_queries_invalid',
      'deleteLinkedQueries'
    )
  }

  return {
    ok: true,
    data: {
      connectionId: connectionId.trim(),
      confirmationName,
      deleteLinkedQueries: value.deleteLinkedQueries
    }
  }
}

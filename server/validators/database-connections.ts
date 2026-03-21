import type {
  DeleteDatabaseConnectionValidationError,
  DeleteDatabaseConnectionValidationIssue,
  DeleteDatabaseConnectionValidationResult,
  SavedDatabaseConnectionIdValidationResult,
  SaveDatabaseConnectionValidationError,
  SaveDatabaseConnectionValidationIssue,
  SaveDatabaseConnectionValidationResult,
  UpdateDatabaseConnectionValidationError,
  UpdateDatabaseConnectionValidationIssue,
  UpdateDatabaseConnectionValidationResult
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

const createUpdateValidationError = (
  issue: UpdateDatabaseConnectionValidationIssue,
  field?: UpdateDatabaseConnectionValidationError['field']
): UpdateDatabaseConnectionValidationError => ({
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
 * Validates a saved connection route parameter and returns the normalized UUID.
 */
export const validateSavedDatabaseConnectionId = (
  connectionId: unknown
): SavedDatabaseConnectionIdValidationResult => {
  if (typeof connectionId !== 'string' || !isUuid(connectionId.trim())) {
    return {
      ok: false,
      code: 'invalid_input',
      issue: 'connection_id_invalid',
      message: 'connection_id_invalid',
      field: 'connectionId'
    }
  }

  return {
    ok: true,
    data: {
      connectionId: connectionId.trim()
    }
  }
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
 * Validates the connection update request payload and route parameter.
 */
export const validateUpdateDatabaseConnectionInput = (
  connectionId: unknown,
  value: unknown
): UpdateDatabaseConnectionValidationResult => {
  const connectionIdValidation = validateSavedDatabaseConnectionId(connectionId)

  if (!connectionIdValidation.ok) {
    return connectionIdValidation
  }

  if (!isRecord(value)) {
    return createUpdateValidationError(
      'body_invalid',
      'body'
    )
  }

  if (
    value.password !== undefined &&
    typeof value.password !== 'string'
  ) {
    return createUpdateValidationError(
      'password_required',
      'password'
    )
  }

  const normalizedPassword = value.password?.trim()
  const validationResult = validateSaveDatabaseConnectionInput({
    ...value,
    password: normalizedPassword || '__preserve_existing_password__'
  })

  if (!validationResult.ok) {
    return {
      ok: false,
      code: 'invalid_input',
      issue: validationResult.issue,
      message: validationResult.message,
      field: validationResult.field
    }
  }

  return {
    ok: true,
    data: {
      connectionId: connectionIdValidation.data.connectionId,
      ...validationResult.data,
      password: normalizedPassword || undefined
    }
  }
}

/**
 * Validates the connection deletion request payload and route parameter.
 */
export const validateDeleteDatabaseConnectionInput = (
  connectionId: unknown,
  value: unknown
): DeleteDatabaseConnectionValidationResult => {
  const connectionIdValidation = validateSavedDatabaseConnectionId(connectionId)

  if (!connectionIdValidation.ok) {
    return connectionIdValidation
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
      connectionId: connectionIdValidation.data.connectionId,
      confirmationName,
      deleteLinkedQueries: value.deleteLinkedQueries
    }
  }
}

import type {
  SaveDatabaseConnectionValidationError,
  SaveDatabaseConnectionValidationIssue,
  SaveDatabaseConnectionValidationResult
} from '../types/database-connections'
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

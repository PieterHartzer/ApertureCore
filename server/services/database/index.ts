import type {
  ExecuteDatabaseReadOnlyQueryInput,
  ExecuteDatabaseReadOnlyQueryResult,
  TestDatabaseConnectionInput,
  TestDatabaseConnectionResult,
} from '../../types/database'

import {
  createDatabaseConnectionTester,
  createDatabaseQueryExecutor
} from './factory'

export const testDatabaseConnection = async (
  input: TestDatabaseConnectionInput
): Promise<TestDatabaseConnectionResult> => {
  const tester = createDatabaseConnectionTester(input.databaseType)

  return tester.testConnection(input)
}

export const testDatabaseReadOnlyQuery = async (
  input: ExecuteDatabaseReadOnlyQueryInput
): Promise<ExecuteDatabaseReadOnlyQueryResult> => {
  try {
    const executor = createDatabaseQueryExecutor(input.databaseType)

    return executor.executeReadOnlyQuery(input)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === `unsupported_database_type:${input.databaseType}`
    ) {
      return {
        ok: false,
        code: 'unsupported_database_type',
        message: 'unsupported_database_type'
      }
    }

    throw error
  }
}

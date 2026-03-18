import type {
  TestDatabaseConnectionInput,
  TestDatabaseConnectionResult,
} from '../../types/database'

import { createDatabaseConnectionTester } from './factory'

export const testDatabaseConnection = async (
  input: TestDatabaseConnectionInput
): Promise<TestDatabaseConnectionResult> => {
  const tester = createDatabaseConnectionTester(input.databaseType)

  return tester.testConnection(input)
}

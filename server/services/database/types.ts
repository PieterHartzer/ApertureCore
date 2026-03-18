import type {
  TestDatabaseConnectionInput,
  TestDatabaseConnectionResult,
} from '../../types/database'

export interface DatabaseConnectionTester {
  testConnection(
    input: TestDatabaseConnectionInput
  ): Promise<TestDatabaseConnectionResult>
}

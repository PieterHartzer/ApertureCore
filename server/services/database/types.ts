import type {
  ExecuteDatabaseReadOnlyQueryInput,
  ExecuteDatabaseReadOnlyQueryResult,
  TestDatabaseConnectionInput,
  TestDatabaseConnectionResult,
} from '../../types/database'

export interface DatabaseConnectionTester {
  testConnection(
    input: TestDatabaseConnectionInput
  ): Promise<TestDatabaseConnectionResult>
}

export interface DatabaseQueryExecutor {
  executeReadOnlyQuery(
    input: ExecuteDatabaseReadOnlyQueryInput
  ): Promise<ExecuteDatabaseReadOnlyQueryResult>
}

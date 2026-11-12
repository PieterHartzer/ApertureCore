import type {
  ExecuteDatabaseReadOnlyQueryInput,
  ExecuteDatabaseReadOnlyQueryResult,
  ExplainDatabaseQueryInput,
  ExplainDatabaseQueryResult,
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
  /**
   * The database's plan for a query, in the shared plan shape. Each adapter
   * must apply exactly the same read-only rules as executeReadOnlyQuery.
   */
  explainQuery(
    input: ExplainDatabaseQueryInput
  ): Promise<ExplainDatabaseQueryResult>
}

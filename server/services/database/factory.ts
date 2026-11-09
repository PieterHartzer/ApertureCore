import type { DatabaseType } from '../../types/database'

import { SqlServerConnectionTester } from './mssql'
import { MySqlConnectionTester } from './mysql'
import { PostgreSqlConnectionTester } from './postgresql'
import type {
  DatabaseConnectionTester,
  DatabaseQueryExecutor
} from './types'

const createAdapter = (
  databaseType: DatabaseType
): DatabaseConnectionTester & DatabaseQueryExecutor => {
  switch (databaseType) {
    case 'postgres':
      return new PostgreSqlConnectionTester()
    case 'mysql':
      return new MySqlConnectionTester()
    case 'mssql':
      return new SqlServerConnectionTester()
    default:
      throw new Error(`unsupported_database_type:${databaseType}`)
  }
}

export const createDatabaseConnectionTester = (
  databaseType: DatabaseType
): DatabaseConnectionTester => createAdapter(databaseType)

export const createDatabaseQueryExecutor = (
  databaseType: DatabaseType
): DatabaseQueryExecutor => createAdapter(databaseType)

import type { DatabaseType } from '../../types/database'

import { PostgreSqlConnectionTester } from './postgresql'
import type { DatabaseConnectionTester } from './types'

export const createDatabaseConnectionTester = (
  databaseType: DatabaseType
): DatabaseConnectionTester => {
  switch (databaseType) { // NOSONAR: keep switch for future database adapters
    case 'postgresql':
      return new PostgreSqlConnectionTester()
    default:
      throw new Error(`unsupported_database_type:${databaseType}`)
  }
}

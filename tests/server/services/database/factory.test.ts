import { describe, expect, it } from 'vitest'

import {
  createDatabaseConnectionTester,
  createDatabaseQueryExecutor
} from '../../../../server/services/database/factory'
import { PostgreSqlConnectionTester } from '../../../../server/services/database/postgresql'

describe('createDatabaseConnectionTester', () => {
  it('returns the PostgreSQL tester for postgres', () => {
    expect(createDatabaseConnectionTester('postgres')).toBeInstanceOf(
      PostgreSqlConnectionTester
    )
  })

  it('throws for unsupported database types', () => {
    expect(() =>
      createDatabaseConnectionTester('oracle' as never)
    ).toThrowError('unsupported_database_type:oracle')
  })
})

describe('createDatabaseQueryExecutor', () => {
  it('returns the PostgreSQL query executor for postgres', () => {
    expect(createDatabaseQueryExecutor('postgres')).toBeInstanceOf(
      PostgreSqlConnectionTester
    )
  })

  it('throws for unsupported database types', () => {
    expect(() =>
      createDatabaseQueryExecutor('oracle' as never)
    ).toThrowError('unsupported_database_type:oracle')
  })
})

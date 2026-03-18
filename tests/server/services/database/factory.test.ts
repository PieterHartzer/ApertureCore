import { describe, expect, it } from 'vitest'

import { createDatabaseConnectionTester } from '../../../../server/services/database/factory'
import { PostgreSqlConnectionTester } from '../../../../server/services/database/postgresql'

describe('createDatabaseConnectionTester', () => {
  it('returns the PostgreSQL tester for postgresql', () => {
    expect(createDatabaseConnectionTester('postgresql')).toBeInstanceOf(
      PostgreSqlConnectionTester
    )
  })

  it('throws for unsupported database types', () => {
    expect(() =>
      createDatabaseConnectionTester('mysql' as never)
    ).toThrowError('unsupported_database_type:mysql')
  })
})

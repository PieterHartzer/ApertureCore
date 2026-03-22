import { describe, expect, it } from 'vitest'

import { createEmptySavedSqlQueryInput } from '../../../app/types/saved-sql-queries'

describe('createEmptySavedSqlQueryInput', () => {
  it('returns a blank saved SQL query form state', () => {
    expect(createEmptySavedSqlQueryInput()).toEqual({
      queryName: '',
      connectionId: '',
      sql: ''
    })
  })
})

import { describe, expect, it } from 'vitest'

import {
  MAX_READ_ONLY_SQL_LENGTH,
  normalizeReadOnlySql
} from '../../../server/utils/read-only-sql'

describe('normalizeReadOnlySql', () => {
  it('returns normalized read-only SQL for valid select statements', () => {
    expect(normalizeReadOnlySql('  select * from customers;  ')).toEqual({
      ok: true,
      sql: 'select * from customers'
    })
  })

  it('rejects SQL that exceeds the maximum length', () => {
    expect(normalizeReadOnlySql(`select '${'x'.repeat(MAX_READ_ONLY_SQL_LENGTH + 1)}'`)).toEqual({
      ok: false,
      issue: 'sql_too_long',
      details: 'SQL query exceeds the allowed length.'
    })
  })

  it('rejects SQL containing invalid characters', () => {
    expect(normalizeReadOnlySql('select \0')).toEqual({
      ok: false,
      issue: 'sql_invalid_characters',
      details: 'SQL query contains invalid characters.'
    })
  })

  it('rejects multiple SQL statements', () => {
    expect(normalizeReadOnlySql('select 1; select 2')).toEqual({
      ok: false,
      issue: 'sql_multiple_statements',
      details: 'Only a single SQL statement can be used.'
    })
  })

  it('rejects non-read-only SQL', () => {
    expect(normalizeReadOnlySql('update customers set active = false')).toEqual({
      ok: false,
      issue: 'sql_not_read_only',
      details: 'Only read-only SELECT queries are allowed.'
    })
  })
})

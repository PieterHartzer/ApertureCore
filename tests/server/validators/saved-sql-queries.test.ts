import { describe, expect, it } from 'vitest'

import {
  validateSaveSavedSqlQueryInput,
  validateTestSavedSqlQueryInput
} from '../../../server/validators/saved-sql-queries'

describe('validateSaveSavedSqlQueryInput', () => {
  it('requires the request body to be an object', () => {
    expect(validateSaveSavedSqlQueryInput(null)).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'body_invalid',
      message: 'body_invalid',
      field: 'body'
    })
  })

  it('requires a query name string', () => {
    expect(validateSaveSavedSqlQueryInput({
      queryName: 42,
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: 'select 1'
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'query_name_invalid',
      message: 'query_name_invalid',
      field: 'queryName'
    })
  })

  it('requires a non-empty query name', () => {
    expect(validateSaveSavedSqlQueryInput({
      queryName: '   ',
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: 'select 1'
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'query_name_required',
      message: 'query_name_required',
      field: 'queryName'
    })
  })

  it('requires a valid connection id', () => {
    expect(validateSaveSavedSqlQueryInput({
      queryName: 'Top customers',
      connectionId: 'not-a-uuid',
      sql: 'select 1'
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'connection_id_invalid',
      message: 'connection_id_invalid',
      field: 'connectionId'
    })
  })

  it('requires SQL to be a string', () => {
    expect(validateSaveSavedSqlQueryInput({
      queryName: 'Top customers',
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: 42
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'sql_invalid',
      message: 'sql_invalid',
      field: 'sql'
    })
  })

  it('requires non-empty SQL while preserving valid SQL text', () => {
    expect(validateSaveSavedSqlQueryInput({
      queryName: 'Top customers',
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: '   '
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'sql_required',
      message: 'sql_required',
      field: 'sql'
    })
  })

  it('rejects SQL that exceeds the allowed length', () => {
    expect(validateSaveSavedSqlQueryInput({
      queryName: 'Top customers',
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: `select '${'x'.repeat(20_001)}'`
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'sql_too_long',
      message: 'sql_too_long',
      field: 'sql'
    })
  })

  it('rejects SQL that is not read-only', () => {
    expect(validateSaveSavedSqlQueryInput({
      queryName: 'Top customers',
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: 'delete from customers'
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'sql_not_read_only',
      message: 'sql_not_read_only',
      field: 'sql'
    })
  })

  it('rejects multiple SQL statements', () => {
    expect(validateSaveSavedSqlQueryInput({
      queryName: 'Top customers',
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: 'select 1; select 2'
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'sql_multiple_statements',
      message: 'sql_multiple_statements',
      field: 'sql'
    })
  })

  it('returns normalized data when the payload is valid', () => {
    expect(validateSaveSavedSqlQueryInput({
      queryName: ' Top customers ',
      connectionId: ' 2f8f9425-55cf-4d8e-a446-638848de1942 ',
      sql: '  select * from customers\nwhere active = true\n'
    })).toEqual({
      ok: true,
      data: {
        queryName: 'Top customers',
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        sql: '  select * from customers\nwhere active = true\n'
      }
    })
  })
})

describe('validateTestSavedSqlQueryInput', () => {
  it('requires the request body to be an object', () => {
    expect(validateTestSavedSqlQueryInput(null)).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'body_invalid',
      message: 'body_invalid',
      field: 'body'
    })
  })

  it('requires a valid connection id', () => {
    expect(validateTestSavedSqlQueryInput({
      connectionId: 'bad-id',
      sql: 'select 1'
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'connection_id_invalid',
      message: 'connection_id_invalid',
      field: 'connectionId'
    })
  })

  it('requires SQL to be a string', () => {
    expect(validateTestSavedSqlQueryInput({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: 42
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'sql_invalid',
      message: 'sql_invalid',
      field: 'sql'
    })
  })

  it('requires non-empty SQL', () => {
    expect(validateTestSavedSqlQueryInput({
      connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
      sql: '   '
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'sql_required',
      message: 'sql_required',
      field: 'sql'
    })
  })

  it('returns normalized data when the payload is valid', () => {
    expect(validateTestSavedSqlQueryInput({
      connectionId: ' 2f8f9425-55cf-4d8e-a446-638848de1942 ',
      sql: '  select id from customers where active = true\n'
    })).toEqual({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        sql: '  select id from customers where active = true\n'
      }
    })
  })
})

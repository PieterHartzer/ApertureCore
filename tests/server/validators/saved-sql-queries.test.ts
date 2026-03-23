import { describe, expect, it } from 'vitest'

import {
  validateDeleteSavedSqlQueryInput,
  validateSavedSqlQueryId,
  validateSaveSavedSqlQueryInput,
  validateTestSavedSqlQueryInput,
  validateUpdateSavedSqlQueryInput
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

describe('validateSavedSqlQueryId', () => {
  it('requires a valid saved query id', () => {
    expect(validateSavedSqlQueryId('bad-id')).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'query_id_invalid',
      message: 'query_id_invalid',
      field: 'queryId'
    })
  })

  it('returns normalized saved query ids', () => {
    expect(validateSavedSqlQueryId(' 2f8f9425-55cf-4d8e-a446-638848de1942 ')).toEqual({
      ok: true,
      data: {
        queryId: '2f8f9425-55cf-4d8e-a446-638848de1942'
      }
    })
  })
})

describe('validateUpdateSavedSqlQueryInput', () => {
  it('returns query id validation errors first', () => {
    expect(validateUpdateSavedSqlQueryInput('bad-id', {})).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'query_id_invalid',
      message: 'query_id_invalid',
      field: 'queryId'
    })
  })

  it('maps save validation errors into update validation errors', () => {
    expect(validateUpdateSavedSqlQueryInput(
      '2f8f9425-55cf-4d8e-a446-638848de1942',
      {
        queryName: 'Top customers',
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        sql: '   '
      }
    )).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'sql_required',
      message: 'sql_required',
      field: 'sql'
    })
  })

  it('returns normalized update data when the payload is valid', () => {
    expect(validateUpdateSavedSqlQueryInput(
      ' 2f8f9425-55cf-4d8e-a446-638848de1942 ',
      {
        queryName: ' Top customers ',
        connectionId: ' 7c6d9425-55cf-4d8e-a446-638848de1942 ',
        sql: 'select * from customers'
      }
    )).toEqual({
      ok: true,
      data: {
        queryId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        queryName: 'Top customers',
        connectionId: '7c6d9425-55cf-4d8e-a446-638848de1942',
        sql: 'select * from customers'
      }
    })
  })
})

describe('validateDeleteSavedSqlQueryInput', () => {
  it('returns query id validation errors first', () => {
    expect(validateDeleteSavedSqlQueryInput('bad-id', {})).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'query_id_invalid',
      message: 'query_id_invalid',
      field: 'queryId'
    })
  })

  it('requires the delete request body to be an object', () => {
    expect(validateDeleteSavedSqlQueryInput(
      '2f8f9425-55cf-4d8e-a446-638848de1942',
      null
    )).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'body_invalid',
      message: 'body_invalid',
      field: 'body'
    })
  })

  it('requires a confirmation name string', () => {
    expect(validateDeleteSavedSqlQueryInput(
      '2f8f9425-55cf-4d8e-a446-638848de1942',
      {
        confirmationName: 42
      }
    )).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'confirmation_name_invalid',
      message: 'confirmation_name_invalid',
      field: 'confirmationName'
    })
  })

  it('requires a non-empty confirmation name', () => {
    expect(validateDeleteSavedSqlQueryInput(
      '2f8f9425-55cf-4d8e-a446-638848de1942',
      {
        confirmationName: '   '
      }
    )).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'confirmation_name_required',
      message: 'confirmation_name_required',
      field: 'confirmationName'
    })
  })

  it('returns normalized delete data when the payload is valid', () => {
    expect(validateDeleteSavedSqlQueryInput(
      ' 2f8f9425-55cf-4d8e-a446-638848de1942 ',
      {
        confirmationName: ' Top customers '
      }
    )).toEqual({
      ok: true,
      data: {
        queryId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        confirmationName: 'Top customers'
      }
    })
  })
})

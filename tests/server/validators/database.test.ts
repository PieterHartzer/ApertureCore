import { describe, expect, it } from 'vitest'

import { validateTestDatabaseConnectionInput } from '../../../server/validators/database'

const validInput = {
  connectionName: ' Reporting DB ',
  databaseType: 'postgresql',
  host: ' db.internal ',
  port: '5432',
  databaseName: ' app_db ',
  username: ' admin ',
  password: 'secret',
  sslMode: 'require',
} as const

describe('validateTestDatabaseConnectionInput', () => {
  it('rejects non-object request bodies', () => {
    expect(validateTestDatabaseConnectionInput(null)).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'body_invalid',
      message: 'body_invalid',
      field: 'body',
    })
  })

  it('normalizes valid input', () => {
    expect(validateTestDatabaseConnectionInput(validInput)).toEqual({
      ok: true,
      data: {
        connectionName: 'Reporting DB',
        databaseType: 'postgresql',
        host: 'db.internal',
        port: 5432,
        databaseName: 'app_db',
        username: 'admin',
        password: 'secret',
        sslMode: 'require',
      },
    })
  })

  it('accepts an integer port without string normalization', () => {
    expect(
      validateTestDatabaseConnectionInput({
        ...validInput,
        port: 5432,
      })
    ).toEqual({
      ok: true,
      data: {
        connectionName: 'Reporting DB',
        databaseType: 'postgresql',
        host: 'db.internal',
        port: 5432,
        databaseName: 'app_db',
        username: 'admin',
        password: 'secret',
        sslMode: 'require',
      },
    })
  })

  it('allows an omitted connection name', () => {
    expect(
      validateTestDatabaseConnectionInput({
        ...validInput,
        connectionName: undefined,
      })
    ).toEqual({
      ok: true,
      data: {
        connectionName: '',
        databaseType: 'postgresql',
        host: 'db.internal',
        port: 5432,
        databaseName: 'app_db',
        username: 'admin',
        password: 'secret',
        sslMode: 'require',
      },
    })
  })

  it.each([
    [
      { ...validInput, connectionName: 42 },
      'connection_name_invalid',
      'connectionName',
      'connection_name_invalid',
    ],
    [
      { ...validInput, databaseType: undefined },
      'database_type_invalid',
      'databaseType',
      'database_type_invalid',
    ],
    [
      { ...validInput, databaseType: 'mysql' },
      'database_type_invalid',
      'databaseType',
      'database_type_invalid',
    ],
    [
      { ...validInput, host: '   ' },
      'host_required',
      'host',
      'host_required',
    ],
    [
      { ...validInput, port: 'abc' },
      'port_invalid',
      'port',
      'port_invalid',
    ],
    [
      { ...validInput, port: '' },
      'port_invalid',
      'port',
      'port_invalid',
    ],
    [
      { ...validInput, databaseName: '   ' },
      'database_name_required',
      'databaseName',
      'database_name_required',
    ],
    [
      { ...validInput, username: '   ' },
      'username_required',
      'username',
      'username_required',
    ],
    [
      { ...validInput, password: '   ' },
      'password_required',
      'password',
      'password_required',
    ],
    [
      { ...validInput, sslMode: undefined },
      'ssl_mode_invalid',
      'sslMode',
      'ssl_mode_invalid',
    ],
    [
      { ...validInput, sslMode: 'verify-full' },
      'ssl_mode_invalid',
      'sslMode',
      'ssl_mode_invalid',
    ],
  ])(
    'rejects invalid input %#',
    (input, issue, field, message) => {
      expect(validateTestDatabaseConnectionInput(input)).toEqual({
        ok: false,
        code: 'invalid_input',
        issue,
        field,
        message,
      })
    }
  )
})

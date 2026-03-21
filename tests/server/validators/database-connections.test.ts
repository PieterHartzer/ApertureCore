import { describe, expect, it } from 'vitest'

import { validateSaveDatabaseConnectionInput } from '../../../server/validators/database-connections'

describe('validateSaveDatabaseConnectionInput', () => {
  it('requires a connection name for persisted connections', () => {
    expect(validateSaveDatabaseConnectionInput({
      connectionName: '   ',
      databaseType: 'postgresql',
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'app_user',
      password: 'secret',
      sslMode: 'disable'
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'connection_name_required',
      message: 'connection_name_required',
      field: 'connectionName'
    })
  })

  it('returns normalized data when the payload is valid', () => {
    expect(validateSaveDatabaseConnectionInput({
      connectionName: 'Primary',
      databaseType: 'postgresql',
      host: ' db.internal ',
      port: '5432',
      databaseName: ' app_db ',
      username: ' app_user ',
      password: 'secret',
      sslMode: 'require'
    })).toEqual({
      ok: true,
      data: {
        connectionName: 'Primary',
        databaseType: 'postgresql',
        host: 'db.internal',
        port: 5432,
        databaseName: 'app_db',
        username: 'app_user',
        password: 'secret',
        sslMode: 'require'
      }
    })
  })
})

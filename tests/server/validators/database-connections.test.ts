import { describe, expect, it } from 'vitest'

import {
  validateDeleteDatabaseConnectionInput,
  validateSaveDatabaseConnectionInput
} from '../../../server/validators/database-connections'

describe('validateSaveDatabaseConnectionInput', () => {
  it('passes through validation failures from the base connection validator', () => {
    expect(validateSaveDatabaseConnectionInput(null)).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'body_invalid',
      message: 'body_invalid',
      field: 'body'
    })
  })

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

describe('validateDeleteDatabaseConnectionInput', () => {
  it('requires a valid connection id', () => {
    expect(
      validateDeleteDatabaseConnectionInput('not-a-uuid', {
        confirmationName: 'Primary',
        deleteLinkedQueries: false
      })
    ).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'connection_id_invalid',
      message: 'connection_id_invalid',
      field: 'connectionId'
    })
  })

  it('requires the delete body to be an object', () => {
    expect(
      validateDeleteDatabaseConnectionInput(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        null
      )
    ).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'body_invalid',
      message: 'body_invalid',
      field: 'body'
    })
  })

  it('requires the confirmation name to be a string', () => {
    expect(
      validateDeleteDatabaseConnectionInput(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        {
          confirmationName: 42,
          deleteLinkedQueries: false
        }
      )
    ).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'confirmation_name_invalid',
      message: 'confirmation_name_invalid',
      field: 'confirmationName'
    })
  })

  it('requires the confirmation name to be present', () => {
    expect(
      validateDeleteDatabaseConnectionInput(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        {
          confirmationName: '   ',
          deleteLinkedQueries: false
        }
      )
    ).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'confirmation_name_required',
      message: 'confirmation_name_required',
      field: 'confirmationName'
    })
  })

  it('requires deleteLinkedQueries to be a boolean', () => {
    expect(
      validateDeleteDatabaseConnectionInput(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        {
          confirmationName: 'Primary',
          deleteLinkedQueries: 'yes'
        }
      )
    ).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'delete_linked_queries_invalid',
      message: 'delete_linked_queries_invalid',
      field: 'deleteLinkedQueries'
    })
  })

  it('returns normalized data when the delete payload is valid', () => {
    expect(
      validateDeleteDatabaseConnectionInput(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        {
          confirmationName: ' Primary ',
          deleteLinkedQueries: true
        }
      )
    ).toEqual({
      ok: true,
      data: {
        connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
        confirmationName: 'Primary',
        deleteLinkedQueries: true
      }
    })
  })
})

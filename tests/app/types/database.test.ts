import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PORTS,
  createEmptyDatabaseConnection,
} from '../../../app/types/database'

describe('createEmptyDatabaseConnection', () => {
  it('returns the expected default PostgreSQL form values', () => {
    expect(createEmptyDatabaseConnection()).toEqual({
      connectionName: '',
      databaseType: 'postgresql',
      host: '',
      port: DEFAULT_PORTS.postgresql,
      databaseName: '',
      username: '',
      password: '',
      sslMode: 'disable',
    })
  })

  it('returns a fresh object on each call', () => {
    const first = createEmptyDatabaseConnection()
    const second = createEmptyDatabaseConnection()

    expect(first).not.toBe(second)
  })
})

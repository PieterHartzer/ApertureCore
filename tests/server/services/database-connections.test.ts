import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isUuid } from '../../../server/utils/is-uuid'

const getAppDatabaseMock = vi.fn()
const encryptSavedDatabaseConnectionSecretMock = vi.fn()

class AppDatabaseConfigurationError extends Error {}
class DatabaseConnectionEncryptionConfigurationError extends Error {}

vi.mock('../../../server/utils/app-database', () => ({
  getAppDatabase: getAppDatabaseMock,
  AppDatabaseConfigurationError
}))

vi.mock('../../../server/utils/database-connection-secrets', () => ({
  encryptSavedDatabaseConnectionSecret: encryptSavedDatabaseConnectionSecretMock,
  DatabaseConnectionEncryptionConfigurationError
}))

const authContext = {
  userId: 'user-1',
  organizationId: 'org-1',
  organizationName: 'ACME',
  organizationPrimaryDomain: 'acme.test'
}

const connectionInput = {
  connectionName: 'Primary DB',
  databaseType: 'postgresql' as const,
  host: 'db.internal',
  port: 5432,
  databaseName: 'app_db',
  username: 'app_user',
  password: 'secret',
  sslMode: 'disable' as const
}

const buildConnectionTargetFingerprint = (
  host: string,
  databaseName: string
) => {
  return createHash('sha256')
    .update(`${host}\u0000${databaseName}`, 'utf8')
    .digest('hex')
}

const createMockQueryBuilder = () => ({
  values: vi.fn().mockReturnThis(),
  returningAll: vi.fn().mockReturnThis(),
  onConflict: vi.fn().mockReturnThis(),
  column: vi.fn().mockReturnThis(),
  doUpdateSet: vi.fn().mockReturnThis(),
  executeTakeFirst: vi.fn().mockResolvedValue(undefined),
  select: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([])
})

const createMockDb = () => {
  const insertIntoMock = vi.fn().mockReturnValue(createMockQueryBuilder())
  const selectFromMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([])
  })

  return {
    insertInto: insertIntoMock,
    selectFrom: selectFromMock,
    destroy: vi.fn().mockResolvedValue(undefined)
  }
}

describe('database connection persistence service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    encryptSavedDatabaseConnectionSecretMock.mockReturnValue('encrypted-secret')
  })

  it('saves a connection scoped to the current organization', async () => {
    const mockDb = createMockDb()
    const organizationInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const connectionInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn()
        .mockResolvedValue({
          connection_id: 'connection-1',
          connection_name: 'Primary DB',
          database_type: 'postgres',
          created_at: new Date('2026-03-18T00:00:00.000Z'),
          updated_at: new Date('2026-03-18T00:00:00.000Z')
        })
    }
    mockDb.insertInto = vi.fn().mockImplementation((table: string) => {
      return table === 'app_organizations'
        ? organizationInsertBuilder
        : connectionInsertBuilder
    })
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { saveDatabaseConnection } = await import(
      '../../../server/services/database-connections'
    )

    await expect(saveDatabaseConnection(authContext, connectionInput)).resolves.toEqual({
      ok: true,
      code: 'success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary DB',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z'
      }
    })
    expect(encryptSavedDatabaseConnectionSecretMock).toHaveBeenCalledWith({
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'app_user',
      password: 'secret',
      sslMode: 'disable'
    })
    expect(mockDb.insertInto).toHaveBeenCalledTimes(2)
    expect(organizationInsertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: expect.any(String),
        organization_name: authContext.organizationName,
        organization_primary_domain: authContext.organizationPrimaryDomain
      })
    )
    expect(
      isUuid(organizationInsertBuilder.values.mock.calls[0][0].organization_id)
    ).toBe(true)
    expect(connectionInsertBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: expect.any(String),
        connection_name: connectionInput.connectionName,
        connection_target_fingerprint: buildConnectionTargetFingerprint(
          connectionInput.host,
          connectionInput.databaseName
        ),
        database_type: 'postgres'
      })
    )
    expect(
      isUuid(connectionInsertBuilder.values.mock.calls[0][0].organization_id)
    ).toBe(true)
  })

  it('maps duplicate connection names to a stable error code', async () => {
    const mockDb = createMockDb()
    mockDb.insertInto = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({
          code: '23505',
          constraint: 'app_database_connections_unique_name_per_org'
        })
    })
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { saveDatabaseConnection } = await import(
      '../../../server/services/database-connections'
    )

    await expect(saveDatabaseConnection(authContext, connectionInput)).resolves.toEqual({
      ok: false,
      code: 'duplicate_connection_name',
      message: 'duplicate_connection_name'
    })
  })

  it('maps duplicate connection targets to a stable error code', async () => {
    const mockDb = createMockDb()
    mockDb.insertInto = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({
          code: '23505',
          constraint: 'app_database_connections_unique_target_per_org'
        })
    })
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { saveDatabaseConnection } = await import(
      '../../../server/services/database-connections'
    )

    await expect(saveDatabaseConnection(authContext, connectionInput)).resolves.toEqual({
      ok: false,
      code: 'duplicate_connection_target',
      message: 'duplicate_connection_target'
    })
  })

  it('returns unexpected_error for unrecognized unique-constraint violations', async () => {
    const mockDb = createMockDb()
    mockDb.insertInto = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({
          code: '23505',
          constraint: 'some_other_unique_constraint'
        })
    })
    getAppDatabaseMock.mockReturnValue(mockDb)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { saveDatabaseConnection } = await import(
      '../../../server/services/database-connections'
    )

    await expect(saveDatabaseConnection(authContext, connectionInput)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith({
      code: '23505',
      constraint: 'some_other_unique_constraint'
    })

    consoleErrorSpy.mockRestore()
  })

  it('returns unexpected_error when saving returns no inserted row', async () => {
    const mockDb = createMockDb()
    mockDb.insertInto = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
    })
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { saveDatabaseConnection } = await import(
      '../../../server/services/database-connections'
    )

    await expect(saveDatabaseConnection(authContext, connectionInput)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
  })

  it('defaults missing organization domain and port when saving a connection', async () => {
    const mockDb = createMockDb()
    const organizationInsertBuilder = {
      values: vi.fn().mockImplementation((values) => {
        expect(values.organization_primary_domain).toBeNull()
        return organizationInsertBuilder
      }),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    const connectionInsertBuilder = {
      values: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    mockDb.insertInto = vi.fn().mockImplementation((table: string) => {
      return table === 'app_organizations'
        ? organizationInsertBuilder
        : connectionInsertBuilder
    })
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { saveDatabaseConnection } = await import(
      '../../../server/services/database-connections'
    )

    await expect(saveDatabaseConnection({
      ...authContext,
      organizationPrimaryDomain: undefined
    }, {
      ...connectionInput,
      port: null
    })).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })

    expect(encryptSavedDatabaseConnectionSecretMock).toHaveBeenCalledWith({
      host: 'db.internal',
      port: 5432,
      databaseName: 'app_db',
      username: 'app_user',
      password: 'secret',
      sslMode: 'disable'
    })
  })

  it('maps encryption configuration failures during save cleanly', async () => {
    const mockDb = createMockDb()
    getAppDatabaseMock.mockReturnValue(mockDb)
    encryptSavedDatabaseConnectionSecretMock.mockImplementation(() => {
      throw new DatabaseConnectionEncryptionConfigurationError('missing key')
    })

    const { saveDatabaseConnection } = await import(
      '../../../server/services/database-connections'
    )

    await expect(saveDatabaseConnection(authContext, connectionInput)).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('returns unexpected_error for unrecognized save failures', async () => {
    const mockDb = createMockDb()
    mockDb.insertInto = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      returningAll: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockRejectedValue(new Error('boom'))
    })
    getAppDatabaseMock.mockReturnValue(mockDb)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { saveDatabaseConnection } = await import(
      '../../../server/services/database-connections'
    )

    await expect(saveDatabaseConnection(authContext, connectionInput)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('maps persistence configuration failures cleanly', async () => {
    getAppDatabaseMock.mockImplementation(() => {
      throw new AppDatabaseConfigurationError('missing db')
    })

    const { listSavedDatabaseConnections } = await import(
      '../../../server/services/database-connections'
    )

    await expect(listSavedDatabaseConnections(authContext)).resolves.toEqual({
      ok: false,
      code: 'persistence_unavailable',
      message: 'persistence_unavailable'
    })
  })

  it('lists only the saved summaries for the current organization', async () => {
    const mockDb = createMockDb()
    const selectBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([{
        connection_id: 'connection-1',
        connection_name: 'Primary DB',
        database_type: 'postgres',
        created_at: new Date('2026-03-18T00:00:00.000Z'),
        updated_at: new Date('2026-03-18T01:00:00.000Z')
      }])
    }
    mockDb.selectFrom = vi.fn().mockReturnValue(selectBuilder)
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { listSavedDatabaseConnections } = await import(
      '../../../server/services/database-connections'
    )

    await expect(listSavedDatabaseConnections(authContext)).resolves.toEqual({
      ok: true,
      code: 'success',
      connections: [{
        id: 'connection-1',
        connectionName: 'Primary DB',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T01:00:00.000Z'
      }]
    })
    expect(mockDb.selectFrom).toHaveBeenCalledTimes(1)
    expect(selectBuilder.where).toHaveBeenCalledWith(
      'organization_id',
      '=',
      expect.any(String)
    )
    expect(isUuid(selectBuilder.where.mock.calls[0][2])).toBe(true)
  })

  it('preserves unknown stored database types when listing summaries', async () => {
    const mockDb = createMockDb()
    mockDb.selectFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([{
        connection_id: 'connection-2',
        connection_name: 'Legacy DB',
        database_type: 'sqlite',
        created_at: new Date('2026-03-18T00:00:00.000Z'),
        updated_at: new Date('2026-03-18T01:00:00.000Z')
      }])
    })
    getAppDatabaseMock.mockReturnValue(mockDb)

    const { listSavedDatabaseConnections } = await import(
      '../../../server/services/database-connections'
    )

    await expect(listSavedDatabaseConnections(authContext)).resolves.toEqual({
      ok: true,
      code: 'success',
      connections: [{
        id: 'connection-2',
        connectionName: 'Legacy DB',
        databaseType: 'sqlite',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T01:00:00.000Z'
      }]
    })
  })

  it('returns unexpected_error when listing fails unexpectedly', async () => {
    const mockDb = createMockDb()
    mockDb.selectFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockRejectedValue(new Error('boom'))
    })
    getAppDatabaseMock.mockReturnValue(mockDb)
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { listSavedDatabaseConnections } = await import(
      '../../../server/services/database-connections'
    )

    await expect(listSavedDatabaseConnections(authContext)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    })
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })
})

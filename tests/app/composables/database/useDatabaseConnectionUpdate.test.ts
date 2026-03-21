import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const connection = {
  connectionName: 'Primary',
  databaseType: 'postgresql' as const,
  host: 'db.internal',
  port: 5432,
  databaseName: 'app_db',
  username: 'admin',
  password: '',
  sslMode: 'disable' as const
}

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useDatabaseConnectionUpdate'))
    .useDatabaseConnectionUpdate
}

describe('useDatabaseConnectionUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('puts the connection payload and returns a successful response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'connections.update.success',
      messageKey: 'connections.update.success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T01:00:00.000Z'
      }
    })

    const useDatabaseConnectionUpdate = await loadComposable()

    await expect(
      useDatabaseConnectionUpdate().updateConnection('connection-1', connection)
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.update.success',
      messageKey: 'connections.update.success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T01:00:00.000Z'
      }
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/connections/connection-1', {
      method: 'PUT',
      body: connection
    })
  })

  it('returns structured API errors from failed fetch responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'duplicate_connection_name',
        message: 'connections.update.errors.duplicateConnectionName',
        messageKey: 'connections.update.errors.duplicateConnectionName'
      }
    })

    const useDatabaseConnectionUpdate = await loadComposable()

    await expect(
      useDatabaseConnectionUpdate().updateConnection('connection-1', connection)
    ).resolves.toEqual({
      ok: false,
      code: 'duplicate_connection_name',
      message: 'connections.update.errors.duplicateConnectionName',
      messageKey: 'connections.update.errors.duplicateConnectionName'
    })
  })

  it('falls back to a generic error when fetch fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useDatabaseConnectionUpdate = await loadComposable()

    await expect(
      useDatabaseConnectionUpdate().updateConnection('connection-1', connection)
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.update.errors.unexpected',
      messageKey: 'connections.update.errors.unexpected'
    })
  })
})

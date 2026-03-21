import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useSavedDatabaseConnections'))
    .useSavedDatabaseConnections
}

describe('useSavedDatabaseConnections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns saved connections from the API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'connections.list.success',
      messageKey: 'connections.list.success',
      connections: [{
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z'
      }]
    })

    const useSavedDatabaseConnections = await loadComposable()

    await expect(
      useSavedDatabaseConnections().listConnections()
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.list.success',
      messageKey: 'connections.list.success',
      connections: [{
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgresql',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z'
      }]
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/connections')
  })

  it('returns structured API errors from failed fetch responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'forbidden',
        message: 'connections.list.errors.forbidden',
        messageKey: 'connections.list.errors.forbidden'
      }
    })

    const useSavedDatabaseConnections = await loadComposable()

    await expect(
      useSavedDatabaseConnections().listConnections()
    ).resolves.toEqual({
      ok: false,
      code: 'forbidden',
      message: 'connections.list.errors.forbidden',
      messageKey: 'connections.list.errors.forbidden'
    })
  })

  it('falls back to a generic error when fetch fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useSavedDatabaseConnections = await loadComposable()

    await expect(
      useSavedDatabaseConnections().listConnections()
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.list.errors.unexpected',
      messageKey: 'connections.list.errors.unexpected'
    })
  })
})

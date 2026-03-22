import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useSavedSqlQueries'))
    .useSavedSqlQueries
}

describe('useSavedSqlQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns saved SQL queries from the API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'queries.list.success',
      messageKey: 'queries.list.success',
      queries: [{
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        connectionName: 'Primary DB',
        createdAt: '2026-03-19T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]
    })

    const useSavedSqlQueries = await loadComposable()

    await expect(
      useSavedSqlQueries().listQueries()
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.list.success',
      messageKey: 'queries.list.success',
      queries: [{
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        connectionName: 'Primary DB',
        createdAt: '2026-03-19T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z'
      }]
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/queries')
  })

  it('returns structured API errors from failed fetch responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'forbidden',
        message: 'queries.list.errors.forbidden',
        messageKey: 'queries.list.errors.forbidden'
      }
    })

    const useSavedSqlQueries = await loadComposable()

    await expect(
      useSavedSqlQueries().listQueries()
    ).resolves.toEqual({
      ok: false,
      code: 'forbidden',
      message: 'queries.list.errors.forbidden',
      messageKey: 'queries.list.errors.forbidden'
    })
  })

  it('falls back to a generic error when fetch fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useSavedSqlQueries = await loadComposable()

    await expect(
      useSavedSqlQueries().listQueries()
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.list.errors.unexpected',
      messageKey: 'queries.list.errors.unexpected'
    })
  })
})

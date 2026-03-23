import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useSavedSqlQuery'))
    .useSavedSqlQuery
}

describe('useSavedSqlQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the saved query details from the API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'queries.edit.success',
      messageKey: 'queries.edit.success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        sql: 'select * from customers',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T01:00:00.000Z'
      }
    })

    const useSavedSqlQuery = await loadComposable()

    await expect(
      useSavedSqlQuery().getQuery('query-1')
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.edit.success',
      messageKey: 'queries.edit.success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: 'connection-1',
        sql: 'select * from customers',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T01:00:00.000Z'
      }
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/queries/query-1')
  })

  it('returns structured API errors from failed fetch responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'not_found',
        message: 'queries.edit.errors.notFound',
        messageKey: 'queries.edit.errors.notFound'
      }
    })

    const useSavedSqlQuery = await loadComposable()

    await expect(
      useSavedSqlQuery().getQuery('missing')
    ).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'queries.edit.errors.notFound',
      messageKey: 'queries.edit.errors.notFound'
    })
  })

  it('falls back to a generic error when fetch fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useSavedSqlQuery = await loadComposable()

    await expect(
      useSavedSqlQuery().getQuery('query-1')
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.edit.errors.unexpected',
      messageKey: 'queries.edit.errors.unexpected'
    })
  })
})

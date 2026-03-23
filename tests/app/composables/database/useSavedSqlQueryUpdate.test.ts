import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const query = {
  queryName: 'Top customers',
  connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
  sql: 'select * from customers'
}

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useSavedSqlQueryUpdate'))
    .useSavedSqlQueryUpdate
}

describe('useSavedSqlQueryUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('puts the query payload and returns a successful response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'queries.update.success',
      messageKey: 'queries.update.success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: query.connectionId,
        connectionName: 'Primary DB',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T02:00:00.000Z'
      }
    })

    const useSavedSqlQueryUpdate = await loadComposable()

    await expect(
      useSavedSqlQueryUpdate().updateQuery('query-1', query)
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.update.success',
      messageKey: 'queries.update.success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: query.connectionId,
        connectionName: 'Primary DB',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T02:00:00.000Z'
      }
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/queries/query-1', {
      method: 'PUT',
      body: query
    })
  })

  it('returns structured API errors from failed fetch responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'duplicate_query_name',
        message: 'queries.update.errors.duplicateQueryName',
        messageKey: 'queries.update.errors.duplicateQueryName'
      }
    })

    const useSavedSqlQueryUpdate = await loadComposable()

    await expect(
      useSavedSqlQueryUpdate().updateQuery('query-1', query)
    ).resolves.toEqual({
      ok: false,
      code: 'duplicate_query_name',
      message: 'queries.update.errors.duplicateQueryName',
      messageKey: 'queries.update.errors.duplicateQueryName'
    })
  })

  it('falls back to a generic error when fetch fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useSavedSqlQueryUpdate = await loadComposable()

    await expect(
      useSavedSqlQueryUpdate().updateQuery('query-1', query)
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.update.errors.unexpected',
      messageKey: 'queries.update.errors.unexpected'
    })
  })
})

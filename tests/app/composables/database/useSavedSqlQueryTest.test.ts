import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const query = {
  connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
  sql: 'select * from customers order by total_spend desc'
}

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useSavedSqlQueryTest'))
    .useSavedSqlQueryTest
}

describe('useSavedSqlQueryTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the test payload and returns a successful response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'queries.test.success',
      messageKey: 'queries.test.success',
      columns: ['id', 'name'],
      rows: [{
        id: 1,
        name: 'Alice'
      }],
      rowLimit: 25
    })

    const useSavedSqlQueryTest = await loadComposable()

    await expect(
      useSavedSqlQueryTest().testQuery(query)
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.test.success',
      messageKey: 'queries.test.success',
      columns: ['id', 'name'],
      rows: [{
        id: 1,
        name: 'Alice'
      }],
      rowLimit: 25
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/queries/test', {
      method: 'POST',
      body: query
    })
  })

  it('returns structured API errors from failed fetch responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'query_rejected',
        message: 'queries.test.errors.queryRejected',
        messageKey: 'queries.test.errors.queryRejected',
        details: 'relation "missing_table" does not exist'
      }
    })

    const useSavedSqlQueryTest = await loadComposable()

    await expect(
      useSavedSqlQueryTest().testQuery(query)
    ).resolves.toEqual({
      ok: false,
      code: 'query_rejected',
      message: 'queries.test.errors.queryRejected',
      messageKey: 'queries.test.errors.queryRejected',
      details: 'relation "missing_table" does not exist'
    })
  })

  it('falls back to a generic error when fetch fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useSavedSqlQueryTest = await loadComposable()

    await expect(
      useSavedSqlQueryTest().testQuery(query)
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.test.errors.unexpected',
      messageKey: 'queries.test.errors.unexpected'
    })
  })
})

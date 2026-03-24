import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rawFetchMock = vi.fn()

const fetchMock = Object.assign(vi.fn(), {
  raw: rawFetchMock
})

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/dashboard/useDashboardQueryResults'))
    .useDashboardQueryResults
}

describe('useDashboardQueryResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reuses cached results while the refresh interval is still fresh', async () => {
    const now = 1_000

    rawFetchMock.mockResolvedValue({
      status: 200,
      _data: {
        columns: ['day', 'sales_total'],
        rows: [{
          day: '2026-03-24',
          sales_total: 120
        }],
        etag: '"etag-1"'
      },
      headers: new Headers({
        etag: '"etag-1"'
      })
    })

    const useDashboardQueryResults = await loadComposable()
    const queryResults = useDashboardQueryResults(fetchMock as typeof $fetch, {
      defaultRefreshIntervalMs: 60_000,
      now: () => now
    })
    const target = {
      connectionId: 'connection-1',
      queryId: 'query-1'
    }

    await queryResults.load(target)
    await queryResults.load(target)

    expect(rawFetchMock).toHaveBeenCalledTimes(1)
    expect(queryResults.getState(target)).toMatchObject({
      status: 'success',
      etag: '"etag-1"',
      rows: [{
        day: '2026-03-24',
        sales_total: 120
      }],
      lastFetchedAt: now
    })
  })

  it('uses ETags when refreshing stale results and preserves cached rows on 304', async () => {
    let now = 1_000

    rawFetchMock
      .mockResolvedValueOnce({
        status: 200,
        _data: {
          columns: ['day', 'sales_total'],
          rows: [{
            day: '2026-03-24',
            sales_total: 120
          }],
          etag: '"etag-1"'
        },
        headers: new Headers({
          etag: '"etag-1"'
        })
      })
      .mockResolvedValueOnce({
        status: 304,
        headers: new Headers({
          etag: '"etag-1"'
        })
      })

    const useDashboardQueryResults = await loadComposable()
    const queryResults = useDashboardQueryResults(fetchMock as typeof $fetch, {
      defaultRefreshIntervalMs: 1_000,
      now: () => now
    })
    const target = {
      connectionId: 'connection-1',
      queryId: 'query-1'
    }

    await queryResults.load(target)

    now = 2_500

    await queryResults.load(target)

    expect(rawFetchMock).toHaveBeenCalledTimes(2)
    expect(rawFetchMock).toHaveBeenLastCalledWith('/api/query/run', {
      method: 'POST',
      body: {
        connectionId: 'connection-1',
        queryId: 'query-1'
      },
      headers: {
        'if-none-match': '"etag-1"'
      },
      ignoreResponseError: true
    })
    expect(queryResults.getState(target)).toMatchObject({
      status: 'success',
      etag: '"etag-1"',
      rows: [{
        day: '2026-03-24',
        sales_total: 120
      }],
      lastFetchedAt: 2_500
    })
  })

  it('creates stable cache keys when query parameter object order changes', async () => {
    const { buildDashboardQueryResultCacheKey } = await import('../../../../../app/composables/dashboard/useDashboardQueryResults')

    expect(buildDashboardQueryResultCacheKey({
      connectionId: 'connection-1',
      queryId: 'query-1'
    }, {
      region: 'EMEA',
      nested: {
        limit: 10,
        enabled: true
      }
    })).toBe(buildDashboardQueryResultCacheKey({
      connectionId: 'connection-1',
      queryId: 'query-1'
    }, {
      nested: {
        enabled: true,
        limit: 10
      },
      region: 'EMEA'
    }))
  })

  it('refreshes shared query targets using the shortest configured interval', async () => {
    let now = 1_000

    rawFetchMock
      .mockResolvedValueOnce({
        status: 200,
        _data: {
          columns: ['day', 'sales_total'],
          rows: [{
            day: '2026-03-24',
            sales_total: 120
          }],
          etag: '"etag-1"'
        },
        headers: new Headers({
          etag: '"etag-1"'
        })
      })
      .mockResolvedValueOnce({
        status: 304,
        headers: new Headers({
          etag: '"etag-1"'
        })
      })

    const useDashboardQueryResults = await loadComposable()
    const queryResults = useDashboardQueryResults(fetchMock as typeof $fetch, {
      defaultRefreshIntervalMs: 60_000,
      now: () => now
    })

    await queryResults.load({
      connectionId: 'connection-1',
      queryId: 'query-1',
      refreshIntervalMs: 60_000
    })

    now = 16_000

    await queryResults.refreshStale([
      {
        connectionId: 'connection-1',
        queryId: 'query-1',
        refreshIntervalMs: 60_000
      },
      {
        connectionId: 'connection-1',
        queryId: 'query-1',
        refreshIntervalMs: 15_000
      }
    ])

    expect(rawFetchMock).toHaveBeenCalledTimes(2)
    expect(queryResults.getState({
      connectionId: 'connection-1',
      queryId: 'query-1'
    })).toMatchObject({
      status: 'success',
      lastFetchedAt: 16_000
    })
  })
})

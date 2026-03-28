import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rawFetchMock = vi.fn()

const fetchMock = Object.assign(vi.fn(), {
  raw: rawFetchMock
})

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/dashboard/useEmbeddedDashboardQueryResults'))
    .useEmbeddedDashboardQueryResults
}

describe('useEmbeddedDashboardQueryResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads and caches embedded widget query results', async () => {
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

    const useEmbeddedDashboardQueryResults = await loadComposable()
    const queryResults = useEmbeddedDashboardQueryResults(fetchMock as typeof $fetch, {
      defaultRefreshIntervalMs: 60_000,
      now: () => 1_000
    })
    const target = {
      embedId: 'embed-1',
      widgetId: 'widget-1'
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
      lastFetchedAt: 1_000
    })
  })

  it('preserves embedded widget rows on 304 refreshes', async () => {
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

    const useEmbeddedDashboardQueryResults = await loadComposable()
    const queryResults = useEmbeddedDashboardQueryResults(fetchMock as typeof $fetch, {
      defaultRefreshIntervalMs: 1_000,
      now: () => now
    })
    const target = {
      embedId: 'embed-1',
      widgetId: 'widget-1'
    }

    await queryResults.load(target)

    now = 2_500

    await queryResults.load(target)

    expect(rawFetchMock).toHaveBeenCalledTimes(2)
    expect(rawFetchMock).toHaveBeenLastCalledWith(
      '/api/embed/dashboards/embed-1/widgets/widget-1/run',
      {
        method: 'POST',
        headers: {
          'if-none-match': '"etag-1"'
        },
        ignoreResponseError: true
      }
    )
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
})

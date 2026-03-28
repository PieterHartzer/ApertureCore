import { describe, expect, it, vi } from 'vitest'

describe('useEmbeddedDashboard', () => {
  it('loads an embedded dashboard through the API composable', async () => {
    const requestFetch = vi.fn().mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'dashboards.embed.get.success',
      dashboard: {
        embedId: 'embed-1',
        dashboardName: 'Executive overview',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: []
      }
    })

    const { useEmbeddedDashboard } = await import('../../../../../app/composables/dashboard/useEmbeddedDashboard')
    const embeddedDashboard = useEmbeddedDashboard(requestFetch)

    await expect(embeddedDashboard.getDashboard('embed-1')).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'dashboards.embed.get.success',
      dashboard: {
        embedId: 'embed-1',
        dashboardName: 'Executive overview',
        updatedAt: '2026-03-24T01:00:00.000Z',
        widgets: []
      }
    })
    expect(requestFetch).toHaveBeenCalledWith('/api/embed/dashboards/embed-1')
  })

  it('returns structured API errors from failed requests', async () => {
    const requestFetch = vi.fn().mockRejectedValue({
      data: {
        ok: false,
        code: 'not_found',
        message: 'dashboards.embed.get.errors.notFound',
        messageKey: 'dashboards.embed.get.errors.notFound'
      }
    })

    const { useEmbeddedDashboard } = await import('../../../../../app/composables/dashboard/useEmbeddedDashboard')
    const embeddedDashboard = useEmbeddedDashboard(requestFetch)

    await expect(embeddedDashboard.getDashboard('embed-1')).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'dashboards.embed.get.errors.notFound',
      messageKey: 'dashboards.embed.get.errors.notFound'
    })
  })

  it('falls back to an unexpected error when the request throws without API data', async () => {
    const requestFetch = vi.fn().mockRejectedValue(new Error('network boom'))

    const { useEmbeddedDashboard } = await import('../../../../../app/composables/dashboard/useEmbeddedDashboard')
    const embeddedDashboard = useEmbeddedDashboard(requestFetch)

    await expect(embeddedDashboard.getDashboard('embed-1')).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'dashboards.embed.get.errors.unexpected',
      messageKey: 'dashboards.embed.get.errors.unexpected'
    })
  })
})

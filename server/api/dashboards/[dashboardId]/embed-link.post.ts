import { regenerateDashboardEmbedId } from '../../../services/dashboards'
import { getAuthenticatedOrganizationContext } from '../../../utils/auth-organization'
import { validateDashboardId } from '../../../validators/dashboards'

const STATUS = { not_found: 404, persistence_unavailable: 503, unexpected_error: 500 } as const

/** A new embed address for the dashboard; the old link stops working at once. */
export default defineEventHandler(async (event) => {
  const validation = validateDashboardId(event.context.params?.dashboardId)

  if (!validation.ok) {
    setResponseStatus(event, 400)

    return { ok: false, code: 'invalid_input', messageKey: 'dashboards.embed.regenerate.errors.unexpected' }
  }

  const result = await regenerateDashboardEmbedId(getAuthenticatedOrganizationContext(event), validation.data.dashboardId)

  if (!result.ok) {
    setResponseStatus(event, STATUS[result.code])

    return { ok: false, code: result.code, messageKey: `dashboards.embed.regenerate.errors.${result.code === 'not_found' ? 'notFound' : 'unexpected'}` }
  }

  return { ok: true, code: 'success', embedId: result.embedId }
})

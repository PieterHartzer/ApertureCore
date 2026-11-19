import { duplicateDashboard } from '../../../services/dashboards'
import { getAuthenticatedOrganizationContext } from '../../../utils/auth-organization'
import { buildGuardRejectionResponse, isGuardRejection } from '../../../utils/extensions'
import { validateDashboardId } from '../../../validators/dashboards'

const MAX_NAME_LENGTH = 200

const STATUS: Record<string, number> = {
  not_found: 404,
  duplicate_dashboard_name: 409,
  persistence_unavailable: 503
}

const MESSAGE_KEYS: Record<string, string> = {
  not_found: 'dashboards.duplicate.errors.notFound',
  duplicate_dashboard_name: 'dashboards.create.errors.duplicateDashboardName',
  persistence_unavailable: 'dashboards.create.errors.persistenceUnavailable'
}

/** Copies a dashboard under a new name. The name comes from the app, in the viewer's language. */
export default defineEventHandler(async (event) => {
  const validation = validateDashboardId(event.context.params?.dashboardId)
  const body = await readBody<{ dashboardName?: unknown }>(event).catch(() => null)
  const dashboardName = typeof body?.dashboardName === 'string' ? body.dashboardName.trim() : ''

  if (!validation.ok || !dashboardName || dashboardName.length > MAX_NAME_LENGTH) {
    setResponseStatus(event, 400)

    return { ok: false, code: 'invalid_input', messageKey: 'dashboards.duplicate.errors.unexpected' }
  }

  const result = await duplicateDashboard(getAuthenticatedOrganizationContext(event), {
    dashboardId: validation.data.dashboardId,
    dashboardName
  })

  if (isGuardRejection(result)) {
    return buildGuardRejectionResponse(event, result)
  }

  if (!result.ok) {
    setResponseStatus(event, STATUS[result.code] ?? 500)

    return { ok: false, code: result.code, messageKey: MESSAGE_KEYS[result.code] ?? 'dashboards.duplicate.errors.unexpected' }
  }

  setResponseStatus(event, 201)

  return { ok: true, code: 'success', dashboard: result.dashboard }
})

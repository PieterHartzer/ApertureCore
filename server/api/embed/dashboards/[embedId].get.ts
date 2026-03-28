import type { EmbeddedDashboardApiResponse } from '../../../types/dashboards'

import { getEmbeddedDashboard } from '../../../services/dashboards'
import { validateDashboardEmbedId } from '../../../validators/dashboards'

const VALIDATION_MESSAGE_KEY = 'dashboards.embed.get.errors.embedIdInvalid'

const ERROR_MESSAGE_KEYS: Record<
  Exclude<EmbeddedDashboardApiResponse['code'], 'success' | 'invalid_input'>,
  string
> = {
  not_found: 'dashboards.embed.get.errors.notFound',
  persistence_unavailable: 'dashboards.embed.get.errors.persistenceUnavailable',
  unexpected_error: 'dashboards.embed.get.errors.unexpected'
}

const buildValidationErrorResponse = (): EmbeddedDashboardApiResponse => ({
  ok: false,
  code: 'invalid_input',
  issue: 'embed_id_invalid',
  field: 'embedId',
  message: VALIDATION_MESSAGE_KEY,
  messageKey: VALIDATION_MESSAGE_KEY
})

const buildErrorResponse = (
  code: Exclude<EmbeddedDashboardApiResponse['code'], 'success' | 'invalid_input'>
): EmbeddedDashboardApiResponse => {
  const messageKey = ERROR_MESSAGE_KEYS[code]

  return {
    ok: false,
    code,
    message: messageKey,
    messageKey
  }
}

export default defineEventHandler(async (event) => {
  const validationResult = validateDashboardEmbedId(event.context.params?.embedId)

  if (!validationResult.ok) {
    setResponseStatus(event, 400)

    return buildValidationErrorResponse()
  }

  try {
    const result = await getEmbeddedDashboard(validationResult.data.embedId)

    if (result.ok) {
      setResponseStatus(event, 200)

      return {
        ok: true,
        code: 'success',
        message: 'dashboards.embed.get.success',
        messageKey: 'dashboards.embed.get.success',
        dashboard: result.dashboard
      }
    }

    setResponseStatus(
      event,
      result.code === 'not_found'
        ? 404
        : result.code === 'persistence_unavailable'
          ? 503
          : 500
    )

    return buildErrorResponse(result.code)
  } catch (error) {
    console.error(error)
    setResponseStatus(event, 500)

    return buildErrorResponse('unexpected_error')
  }
})

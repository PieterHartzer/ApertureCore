import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { updateAISettings, type AISettingsAction } from '../../services/ai-settings'
export default defineEventHandler(async event => {
  const owner = getAuthenticatedOrganizationContext(event)
  const body = await readBody<AISettingsAction>(event)
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'Invalid settings request.' })
  try { return await updateAISettings(owner, body) }
  catch (cause) {
    if (cause && typeof cause === 'object' && 'statusCode' in cause) throw cause
    throw createError({ statusCode: 503, statusMessage: 'Could not save AI settings. Check migrations and the server encryption key.' })
  }
})

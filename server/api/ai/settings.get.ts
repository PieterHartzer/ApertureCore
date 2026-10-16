import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { readAISettings } from '../../services/ai-settings'
export default defineEventHandler(async event => {
  const owner = getAuthenticatedOrganizationContext(event)
  try { return (await readAISettings(owner)).settings }
  catch { throw createError({ statusCode: 503, statusMessage: 'AI settings unavailable. Check the application database, migrations and encryption key.' }) }
})

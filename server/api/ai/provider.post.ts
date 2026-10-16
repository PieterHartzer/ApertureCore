import type { AISqlDialect } from '../../../shared/types/ai'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { readAISettings } from '../../services/ai-settings'
import { providerRequest, chatModelIds } from '../../../shared/utils/ai-provider'
import { buildSqlPrompt, extractGeneratedSql } from '../../../app/utils/sql-assistant'
import { consumeAuthenticatedFixedWindowRateLimit } from '../../utils/authenticated-rate-limit'
export default defineEventHandler(async event => {
  const owner = getAuthenticatedOrganizationContext(event)
  const limit = await consumeAuthenticatedFixedWindowRateLimit(event, { keyPrefix: 'ai-provider', limit: 30, windowMs: 60_000 })
  if (!limit.allowed) throw createError({ statusCode: 429, statusMessage: 'Too many AI requests. Wait a minute and retry.' })
  const input = await readBody<{ connectionId?: string, modelId?: string, schema?: string, question?: string, databaseType?: AISqlDialect }>(event)
  const { settings, credentials } = await readAISettings(owner)
  const model = settings.models.find(item => item.id === input.modelId)
  const connection = settings.connections.find(item => item.id === (model?.providerConnectionId ?? input.connectionId))
  if (!connection || connection.providerType !== 'openai') throw createError({ statusCode: 404, statusMessage: 'OpenAI connection not found.' })
  const controller = new AbortController()
  const cancel = () => controller.abort()
  event.node.res.on('close', cancel)
  try {
    if (!input.modelId) {
      const response = await providerRequest('https://api.openai.com/v1', 'models', credentials[connection.id], undefined, controller.signal)
      return { modelIds: chatModelIds(response.data ?? [], true) }
    }
    if (!model || typeof input.schema !== 'string' || typeof input.question !== 'string') throw new Error('Select a configured model and supply a question and schema.')
    if (!input.databaseType) throw new Error('Read the database schema again to identify its SQL dialect.')
    const response = await providerRequest('https://api.openai.com/v1', 'chat/completions', credentials[connection.id], { model: model.modelId, messages: buildSqlPrompt(input.schema, input.question, { databaseType: input.databaseType }) }, controller.signal)
    if (response.choices?.[0]?.finish_reason === 'length') throw new Error('Generated SQL was cut short. Ask a simpler question.')
    return { sql: extractGeneratedSql(response.choices?.[0]?.message?.content ?? '') }
  } catch (cause) {
    throw createError({ statusCode: 502, statusMessage: cause instanceof Error ? cause.message : 'AI provider request failed.' })
  } finally { event.node.res.off('close', cancel) }
})

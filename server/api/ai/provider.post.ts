import type { AISqlDialect } from '../../../shared/types/ai'
import { getAuthenticatedOrganizationContext } from '../../utils/auth-organization'
import { readAISettings } from '../../services/ai-settings'
import { providerRequest, chatModelIds } from '../../../shared/utils/ai-provider'
import { CLOUD_AI_PROVIDERS, isCloudAIProvider, normalizeAzureEndpoint, normalizeProviderModelIds, parseAzureDeployments, type CloudAIProviderType } from '../../../shared/utils/ai-provider-catalog'
import { generateSqlWithClaude, listClaudeModels } from '../../services/ai-anthropic'
import { buildSqlPrompt, extractGeneratedSql } from '../../../app/utils/sql-assistant'
import { consumeAuthenticatedFixedWindowRateLimit } from '../../utils/authenticated-rate-limit'
export default defineEventHandler(async event => {
  const owner = getAuthenticatedOrganizationContext(event)
  const limit = await consumeAuthenticatedFixedWindowRateLimit(event, { keyPrefix: 'ai-provider', limit: 30, windowMs: 60_000 })
  if (!limit.allowed) throw createError({ statusCode: 429, statusMessage: 'Too many AI requests. Wait a minute and retry.' })
  const input = await readBody<{ connectionId?: string, modelId?: string, schema?: string, question?: string, databaseType?: AISqlDialect, language?: string, deployments?: unknown }>(event)
  const { settings, credentials } = await readAISettings(owner)
  const model = settings.models.find(item => item.id === input.modelId)
  const connection = settings.connections.find(item => item.id === (model?.providerConnectionId ?? input.connectionId))
  if (!connection || !isCloudAIProvider(connection.providerType)) throw createError({ statusCode: 404, statusMessage: 'Provider connection not found.' })
  const providerType: CloudAIProviderType = connection.providerType
  const provider = CLOUD_AI_PROVIDERS[providerType]
  const apiKey = credentials[connection.id] ?? ''
  const controller = new AbortController()
  const cancel = () => controller.abort()
  event.node.res.on('close', cancel)
  try {
    const baseUrl = providerType === 'azure' ? normalizeAzureEndpoint(connection.baseUrl) : provider.baseUrl
    const keyHeader = providerType === 'azure' ? 'api-key' as const : 'bearer' as const
    if (!input.modelId && providerType === 'azure') {
      // Azure has no list of deployments for an API key, so each one named is tried.
      const deployments = parseAzureDeployments(input.deployments)
      if (!deployments.length) throw new Error('Enter at least one deployment name.')
      for (const deployment of deployments) {
        await providerRequest(baseUrl, 'chat/completions', apiKey, { model: deployment, messages: [{ role: 'user', content: 'Reply with OK.' }] }, controller.signal, keyHeader)
      }
      return { modelIds: deployments }
    }
    if (!input.modelId) {
      // Some providers do not publish a model list, so only a rejected key stops here.
      const modelIds = await (providerType === 'anthropic'
        ? listClaudeModels(apiKey, controller.signal)
        : providerRequest(baseUrl, 'models', apiKey, undefined, controller.signal).then(response => normalizeProviderModelIds(providerType, chatModelIds(response.data ?? [], providerType === 'openai')))
      ).catch((cause: unknown) => {
        if (cause instanceof Error && cause.message.startsWith('Authentication failed')) throw cause
        return [] as string[]
      })
      return { modelIds: modelIds.length ? modelIds : [...provider.fallbackModels] }
    }
    if (!model || typeof input.schema !== 'string' || typeof input.question !== 'string') throw new Error('Select a configured model and supply a question and schema.')
    if (!input.databaseType) throw new Error('Read the database schema again to identify its SQL dialect.')
    const messages = buildSqlPrompt(input.schema, input.question, { databaseType: input.databaseType, language: input.language })
    if (providerType === 'anthropic') return { sql: extractGeneratedSql(await generateSqlWithClaude(apiKey, model.modelId, messages, controller.signal)) }
    const response = await providerRequest(baseUrl, 'chat/completions', apiKey, { model: model.modelId, messages }, controller.signal, ...(providerType === 'azure' ? [keyHeader] as const : []))
    if (response.choices?.[0]?.finish_reason === 'length') throw new Error('Generated SQL was cut short. Ask a simpler question.')
    return { sql: extractGeneratedSql(response.choices?.[0]?.message?.content ?? '') }
  } catch (cause) {
    throw createError({ statusCode: 502, statusMessage: cause instanceof Error ? cause.message : 'AI provider request failed.' })
  } finally { event.node.res.off('close', cancel) }
})

import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { getAppDatabase } from '../utils/app-database'
import { encryptAICredentials, decryptAICredentials } from '../utils/ai-secrets'
import type { AuthenticatedOrganizationContext } from '../types/database-connections'
import type { AISettings, AIProviderType } from '../../shared/types/ai'
import { validateLMStudioUrl } from '../../shared/utils/ai-provider'
const emptySettings = (): AISettings => ({ connections: [], models: [] })
export const readAISettings = async (owner: AuthenticatedOrganizationContext) => {
  const row = await getAppDatabase().selectFrom('app_ai_settings').selectAll()
    .where('organization_id', '=', owner.organizationId).where('user_id', '=', owner.userId).executeTakeFirst()
  return { settings: row?.settings ?? emptySettings(), credentials: row ? decryptAICredentials(row.encrypted_credentials) : {} }
}
const text = (value: unknown, limit = 250) => {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw createError({ statusCode: 400, statusMessage: 'Enter a valid name or model identifier.' })
  return value.trim()
}
export interface AISettingsAction {
  action: 'connection' | 'models' | 'default' | 'rename' | 'remove' | 'removeConnection'
  id?: string
  name?: string
  providerType?: AIProviderType
  baseUrl?: string
  apiKey?: string
  modelIds?: string[]
}
export const applyAISettingsAction = (settings: AISettings, credentials: Record<string, string>, input: AISettingsAction) => {
  if (input.action === 'connection') {
    if (input.providerType !== 'openai' && input.providerType !== 'lmstudio') throw createError({ statusCode: 400, statusMessage: 'Choose a supported provider.' })
    const existing = settings.connections.find(connection => connection.id === input.id)
    if (input.id && !existing) throw createError({ statusCode: 404, statusMessage: 'Connection not found.' })
    const id = existing?.id ?? randomUUID()
    const apiKey = input.apiKey?.trim()
    if (apiKey && (apiKey.length > 4096 || /[\r\n]/.test(apiKey))) throw createError({ statusCode: 400, statusMessage: 'Invalid API key.' })
    if (input.providerType === 'openai' && !apiKey && !credentials[id]) throw createError({ statusCode: 400, statusMessage: 'An OpenAI API key is required.' })
    // Local credentials are session-only: never round-trip a stored key to the browser.
    if (input.providerType === 'lmstudio' && apiKey) throw createError({ statusCode: 400, statusMessage: 'Enter LM Studio keys in the browser session only.' })
    if (apiKey) credentials[id] = apiKey
    let localUrl = ''
    if (input.providerType === 'lmstudio') {
      try { localUrl = validateLMStudioUrl(input.baseUrl ?? '') }
      catch { throw createError({ statusCode: 400, statusMessage: 'Enter a valid HTTP or HTTPS LM Studio URL without credentials, query parameters or fragments.' }) }
    }
    const now = new Date().toISOString()
    const connection = { id, name: text(input.name), providerType: input.providerType, baseUrl: input.providerType === 'openai' ? 'https://api.openai.com/v1' : localUrl, hasApiKey: !!credentials[id], createdAt: existing?.createdAt ?? now, updatedAt: now }
    if (existing && existing.providerType !== connection.providerType) throw createError({ statusCode: 400, statusMessage: 'Provider type cannot be changed.' })
    settings.connections = [...settings.connections.filter(item => item.id !== id), connection]
    return id
  }
  if (input.action === 'models') {
    const connection = settings.connections.find(item => item.id === input.id)
    if (input.providerType !== 'webllm' && !connection) throw createError({ statusCode: 404, statusMessage: 'Connection not found.' })
    if (!Array.isArray(input.modelIds) || !input.modelIds.length || input.modelIds.length > 100) throw createError({ statusCode: 400, statusMessage: 'Select between 1 and 100 chat models.' })
    for (const raw of input.modelIds) {
      const modelId = text(raw)
      const providerType = connection?.providerType ?? 'webllm'
      if (providerType === 'webllm' && !/^Qwen2\.5-Coder-(0\.5|1\.5|3|7)B-Instruct-q4f(16|32)_1-MLC$/.test(modelId)) throw createError({ statusCode: 400, statusMessage: 'Choose a supported browser model from the catalogue.' })
      const providerConnectionId = connection?.id ?? null
      if (!settings.models.some(model => model.providerConnectionId === providerConnectionId && model.modelId === modelId)) settings.models.push({ id: randomUUID(), providerConnectionId, providerType, modelId, displayName: modelId, modelType: 'chat', status: 'unknown', isDefault: settings.models.length === 0, capabilities: ['chat'] })
    }
    return
  }
  if (input.action === 'removeConnection') {
    if (!settings.connections.some(connection => connection.id === input.id)) throw createError({ statusCode: 404, statusMessage: 'Connection not found.' })
    settings.connections = settings.connections.filter(connection => connection.id !== input.id)
    settings.models = settings.models.filter(model => model.providerConnectionId !== input.id)
    delete credentials[input.id!]
  } else {
    const model = settings.models.find(item => item.id === input.id)
    if (!model) throw createError({ statusCode: 404, statusMessage: 'Model not found.' })
    if (input.action === 'default') settings.models.forEach(item => { item.isDefault = item.id === model.id })
    else if (input.action === 'rename') model.displayName = text(input.name)
    else if (input.action === 'remove') settings.models = settings.models.filter(item => item.id !== model.id)
    else throw createError({ statusCode: 400, statusMessage: 'Unsupported settings action.' })
  }
  if (settings.models.length && !settings.models.some(model => model.isDefault)) settings.models[0]!.isDefault = true
}
export const updateAISettings = async (owner: AuthenticatedOrganizationContext, input: AISettingsAction) => {
  const db = getAppDatabase()
  return db.transaction().execute(async transaction => {
    await transaction.insertInto('app_ai_settings').values({ organization_id: owner.organizationId, user_id: owner.userId, settings: emptySettings(), encrypted_credentials: encryptAICredentials({}) }).onConflict(conflict => conflict.columns(['organization_id', 'user_id']).doNothing()).execute()
    const row = await transaction.selectFrom('app_ai_settings').selectAll().where('organization_id', '=', owner.organizationId).where('user_id', '=', owner.userId).forUpdate().executeTakeFirstOrThrow()
    const credentials = decryptAICredentials(row.encrypted_credentials)
    const connectionId = applyAISettingsAction(row.settings, credentials, input)
    await transaction.updateTable('app_ai_settings').set({ settings: row.settings, encrypted_credentials: encryptAICredentials(credentials) }).where('organization_id', '=', owner.organizationId).where('user_id', '=', owner.userId).execute()
    return { settings: row.settings, connectionId }
  })
}

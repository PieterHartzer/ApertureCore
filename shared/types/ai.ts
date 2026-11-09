// SQL dialects are independent of inference providers; connection adapters remain separately supported.
export type AISqlDialect = 'postgres' | 'mssql' | 'mysql' | 'sqlite'

import type { CloudAIProviderType } from '../utils/ai-provider-catalog'

export type AIProviderType = CloudAIProviderType | 'lmstudio' | 'webllm'
export interface AIProviderConnection {
  id: string
  name: string
  providerType: Exclude<AIProviderType, 'webllm'>
  baseUrl: string
  hasApiKey: boolean
  createdAt: string
  updatedAt: string
}
export interface AIModel {
  id: string
  providerConnectionId: string | null
  providerType: AIProviderType
  modelId: string
  displayName: string
  modelType: 'chat'
  status: 'unknown' | 'ready' | 'unavailable'
  isDefault: boolean
  capabilities: string[]
  estimatedMemoryUsage?: number
}
export interface AISettings { connections: AIProviderConnection[], models: AIModel[] }
export interface AIGenerationRequest {
  model: AIModel
  schema: string
  databaseType: AISqlDialect
  question: string
  language?: string
  signal?: AbortSignal
  options?: { temperature?: number, maxTokens?: number }
}
export interface AIInferenceProvider { generate(request: AIGenerationRequest): Promise<string> }

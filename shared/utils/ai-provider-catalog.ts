export interface CloudAIProvider {
  label: string
  baseUrl: string
  keyUrl: string
  // Offered when a provider's model list cannot be read.
  fallbackModels: string[]
}

// Requests carrying a stored key only ever go to these addresses, so a saved
// setting cannot point the server at another host.
export const CLOUD_AI_PROVIDERS = {
  // Each customer has their own Azure address, checked by normalizeAzureEndpoint.
  azure: { label: 'Azure OpenAI (Microsoft)', baseUrl: '', keyUrl: 'https://portal.azure.com', fallbackModels: [] },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', fallbackModels: ['gpt-4.1', 'gpt-4.1-mini'] },
  anthropic: { label: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com', keyUrl: 'https://platform.claude.com/settings/keys', fallbackModels: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] },
  gemini: { label: 'Gemini (Google)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey', fallbackModels: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys', fallbackModels: ['deepseek-chat', 'deepseek-reasoner'] },
  qwen: { label: 'Qwen (Alibaba)', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', keyUrl: 'https://bailian.console.alibabacloud.com/?apiKey=1', fallbackModels: ['qwen-max', 'qwen-plus', 'qwen-turbo'] },
  moonshot: { label: 'Kimi (Moonshot)', baseUrl: 'https://api.moonshot.ai/v1', keyUrl: 'https://platform.moonshot.ai/console/api-keys', fallbackModels: ['kimi-latest'] },
  zhipu: { label: 'GLM (Zhipu)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys', fallbackModels: ['glm-4-plus', 'glm-4-flash'] }
} as const satisfies Record<string, CloudAIProvider>

export type CloudAIProviderType = keyof typeof CLOUD_AI_PROVIDERS

export const isCloudAIProvider = (value: unknown): value is CloudAIProviderType => {
  return typeof value === 'string' && Object.hasOwn(CLOUD_AI_PROVIDERS, value)
}

const AZURE_HOST_SUFFIXES = [
  '.openai.azure.com',
  '.cognitiveservices.azure.com',
  '.services.ai.azure.com',
  '.openai.azure.us',
  '.cognitiveservices.azure.us',
  '.openai.azure.cn',
  '.cognitiveservices.azure.cn'
]

/**
 * Stored keys are sent to this address from the server, so it must be a real
 * Azure resource and not any host a user types.
 */
export const normalizeAzureEndpoint = (value: string) => {
  const url = new URL(value.trim())

  if (url.protocol !== 'https:' || url.username || url.password || url.port || !AZURE_HOST_SUFFIXES.some(suffix => url.hostname.endsWith(suffix))) {
    throw new Error('Not an Azure OpenAI endpoint.')
  }

  return `https://${url.hostname}/openai/v1`
}

const NON_CHAT_GEMINI_MODEL = /(embedding|image|tts|audio|live|aqa|veo)/

export const normalizeProviderModelIds = (provider: CloudAIProviderType, modelIds: string[]) => {
  if (provider !== 'gemini') return modelIds

  return modelIds
    .map(id => id.replace(/^models\//, ''))
    .filter(id => id.startsWith('gemini-') && !NON_CHAT_GEMINI_MODEL.test(id))
}

const AZURE_DEPLOYMENT_NAME = /^[A-Za-z0-9._-]{1,64}$/

export const parseAzureDeployments = (value: unknown) => {
  const names = Array.isArray(value) ? value : []

  return [...new Set(names.filter((name): name is string => typeof name === 'string' && AZURE_DEPLOYMENT_NAME.test(name)))].slice(0, 20)
}

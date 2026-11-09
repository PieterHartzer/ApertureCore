import Anthropic from '@anthropic-ai/sdk'

import type { buildSqlPrompt } from '../../app/utils/sql-assistant'

const describeFailure = (cause: unknown) => {
  if (cause instanceof Anthropic.APIUserAbortError) return new Error('Generation cancelled.')
  if (cause instanceof Anthropic.AuthenticationError || cause instanceof Anthropic.PermissionDeniedError) return new Error('Authentication failed. Check your API key.')
  if (cause instanceof Anthropic.NotFoundError) return new Error('This Claude model is not available to your account. Choose another model.')
  if (cause instanceof Anthropic.RateLimitError) return new Error('Provider rate limit reached. Wait and retry.')
  if (cause instanceof Anthropic.APIConnectionError) return new Error('Could not reach Claude. Check the network and retry.')
  if (cause instanceof Anthropic.APIError) return new Error(`Provider request failed (${cause.status}). Retry or choose another model.`)
  return cause instanceof Error ? cause : new Error('AI provider request failed.')
}

export const listClaudeModels = async (apiKey: string, signal: AbortSignal) => {
  try {
    const modelIds: string[] = []

    for await (const model of new Anthropic({ apiKey }).models.list({ limit: 100 }, { signal })) {
      modelIds.push(model.id)
    }

    return modelIds
  } catch (cause) {
    throw describeFailure(cause)
  }
}

export const generateSqlWithClaude = async (
  apiKey: string,
  model: string,
  messages: ReturnType<typeof buildSqlPrompt>,
  signal: AbortSignal
) => {
  const textOf = (role: 'system' | 'user') => messages.find(message => message.role === role)?.content ?? ''

  try {
    const response = await new Anthropic({ apiKey }).messages.create({
      model,
      max_tokens: 16000,
      system: textOf('system'),
      messages: [{ role: 'user', content: textOf('user') }]
    }, { signal, timeout: 180_000 })

    if (response.stop_reason === 'refusal') throw new Error('Claude declined this request. Rephrase your question or choose another model.')
    if (response.stop_reason === 'max_tokens') throw new Error('Generated SQL was cut short. Ask a simpler question.')

    return response.content.flatMap((block) => block.type === 'text' ? [block.text] : []).join('')
  } catch (cause) {
    throw describeFailure(cause)
  }
}

export const validateLMStudioUrl = (value: string) => {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('Enter a valid LM Studio server URL.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTP or HTTPS server URL without credentials, query parameters or fragments.')
  return url.toString().replace(/\/$/, '')
}
export class AIProviderRequestError extends Error {}
export const providerRequest = async (baseUrl: string, path: string, apiKey = '', body?: unknown, signal?: AbortSignal) => {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) controller.abort()
  const timer = setTimeout(cancel, body ? 180_000 : 10_000)
  try {
    const response = await fetch(`${baseUrl}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: 'omit', redirect: 'error'
    })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new AIProviderRequestError('Authentication failed. Check your API key.')
      if (response.status === 429) throw new AIProviderRequestError('Provider rate limit reached. Wait and retry.')
      throw new AIProviderRequestError(`Provider request failed (${response.status}). Check that the selected model is loaded and supports chat.`)
    }
    return await response.json() as { data?: { id: string }[], choices?: { finish_reason?: string, message?: { content?: string } }[] }
  } catch (cause) {
    if (signal?.aborted) throw new AIProviderRequestError('Generation cancelled.')
    if (controller.signal.aborted) throw new AIProviderRequestError('Provider request timed out. Check the server and retry.')
    if (cause instanceof TypeError) throw new AIProviderRequestError('Cannot connect to the AI server. For LM Studio, start the local server, enable CORS for this app, and allow local network access in your browser. HTTPS pages may block HTTP servers; use a secure endpoint when required.')
    if (cause instanceof AIProviderRequestError) throw cause
    throw new AIProviderRequestError('The AI server returned an invalid response. Check the endpoint and model, then retry.')
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel) }
}
export const chatModelIds = (records: { id: string }[], openai: boolean) => records
  .filter(record => typeof record.id === 'string' && record.id.length <= 250)
  .filter(record => !openai || /^(gpt-|chatgpt-|o[134](?:-|$))/.test(record.id) && !/(audio|realtime|transcribe|tts|image|search|embedding)/.test(record.id))
  .map(record => record.id)

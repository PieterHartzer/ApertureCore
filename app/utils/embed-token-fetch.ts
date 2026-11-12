type Fetcher = typeof $fetch

/**
 * Wraps a fetch so every request carries the embed's signed-link token, when
 * the page has one (?token=). Keeps .raw working for widget runs.
 */
export const withEmbedToken = (fetcher: Fetcher, token: string): Fetcher => {
  if (!token) return fetcher

  const addHeader = <Options extends { headers?: unknown }>(options?: Options) => ({
    ...options,
    headers: { ...(options?.headers as Record<string, string> | undefined), 'x-embed-token': token }
  })
  const wrapped = ((request: string, options?: { headers?: unknown }) => fetcher(request, addHeader(options) as never)) as unknown as Fetcher
  const raw = (fetcher as Fetcher & { raw?: Fetcher['raw'] }).raw ?? $fetch.raw

  ;(wrapped as Fetcher & { raw: Fetcher['raw'] }).raw = ((request: string, options?: { headers?: unknown }) => raw(request, addHeader(options) as never)) as Fetcher['raw']

  return wrapped
}

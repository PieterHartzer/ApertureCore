/**
 * The websites an embedded dashboard may appear on. Each entry is an origin
 * (scheme and host, optional port), optionally starting with "*." for every
 * subdomain. "example.com" means https://example.com. Plain http is only
 * accepted for localhost, for testing.
 */

export const MAX_EMBED_ORIGINS = 10

const HOST = /^(\*\.)?([a-z0-9-]+\.)*[a-z0-9-]+$/
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

export const normalizeEmbedOrigin = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const trimmed = value.trim().toLowerCase().replace(/\/+$/, '')

  if (!trimmed || trimmed.length > 253) return null

  const withScheme = /^[a-z]+:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
  const match = /^(https?):\/\/([^/:?#]+)(?::(\d{1,5}))?$/.exec(withScheme)

  if (!match) return null

  const [, scheme, host, port] = match

  if (!host || !HOST.test(host)) return null
  // A bare "*" or a top-level domain alone would allow far too much.
  if (!host.includes('.') && !LOCAL_HOSTS.has(host)) return null
  if (scheme === 'http' && !LOCAL_HOSTS.has(host)) return null
  if (port && (Number(port) < 1 || Number(port) > 65535)) return null

  return `${scheme}://${host}${port ? `:${port}` : ''}`
}

/** Cleans a list of origins; null when any entry is invalid or there are too many. */
export const normalizeEmbedOrigins = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length > MAX_EMBED_ORIGINS) return null

  const origins: string[] = []

  for (const entry of value) {
    const origin = normalizeEmbedOrigin(entry)

    if (!origin) return null
    if (!origins.includes(origin)) origins.push(origin)
  }

  return origins
}

/** Reads origins stored in the database, dropping anything that no longer validates. */
export const readStoredEmbedOrigins = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap(entry => normalizeEmbedOrigin(entry) ?? [])
}

/** The CSP frame-ancestors value: only these sites may frame the dashboard. */
export const frameAncestorsFor = (origins: string[]) => origins.length ? origins.join(' ') : '*'

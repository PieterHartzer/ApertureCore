const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Public embeds use no session, so another site can't act as anyone through them.
const EXEMPT_PREFIXES = ['/api/embed/', '/api/_']

export interface RequestOriginInput {
  method: string
  path: string
  /** Host the visitor asked for, as the proxy in front of the app forwarded it. */
  host: string | undefined
  origin: string | undefined
  secFetchSite: string | undefined
}

/**
 * Whether a request that changes something came from another site. Browsers
 * send Origin and Sec-Fetch-Site with every such request, and a page can't set
 * them. A request with neither comes from a script or tool rather than a
 * browser page, which a forged cross-site request can't be.
 *
 * The session cookie's SameSite=Lax already stops other sites; this also
 * stops our own subdomains, which count as the same site.
 */
export const isCrossOriginWrite = ({ method, path, host, origin, secFetchSite }: RequestOriginInput) => {
  if (!UNSAFE_METHODS.has(method.toUpperCase())) return false

  const cleanPath = path.split('?')[0] ?? ''

  if (!cleanPath.startsWith('/api/') || EXEMPT_PREFIXES.some(prefix => cleanPath.startsWith(prefix))) return false

  if (secFetchSite === 'same-origin' || secFetchSite === 'none') return false
  if (secFetchSite) return true

  if (!origin) return false

  try {
    return !host || new URL(origin).host.toLowerCase() !== host.toLowerCase()
  } catch {
    return true
  }
}

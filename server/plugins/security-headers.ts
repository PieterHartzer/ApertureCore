import { randomBytes } from 'node:crypto'

import { getRequestURL, setResponseHeader, type H3Event } from 'h3'

/** Public dashboards are framed by customers' own sites; nothing else may be. */
export const isEmbedPath = (path: string) => path === '/embed' || path.startsWith('/embed/')

/**
 * The page's Content Security Policy. Scripts run only from this site or with
 * this response's nonce, so even a value that slipped past escaping could not
 * run. Embeds render customers' query results for anyone, so they also may not
 * send data anywhere but here.
 */
export const buildContentSecurityPolicy = (nonce: string, embed: boolean, frameAncestors = '*') => [
  "default-src 'self'",
  // WebAssembly runs the optional in-browser SQL model.
  `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'`,
  // Charts, the grid and the dashboard style set inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Outside embeds, the browser talks to the AI service each person chose, with their own key.
  embed ? "connect-src 'self'" : "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  // An embed may be limited to the websites its owner allowed (see middleware/embed-access).
  embed ? `frame-ancestors ${frameAncestors}` : "frame-ancestors 'none'"
].join('; ')

/** Adds the nonce to every script tag the page renders. */
export const addScriptNonce = (chunk: string, nonce: string) => {
  return chunk.replace(/<script\b(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`)
}

const setBaseHeaders = (event: H3Event) => {
  const embed = isEmbedPath(getRequestURL(event).pathname)

  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  if (!embed) {
    setResponseHeader(event, 'X-Frame-Options', 'DENY')
  }
}

export default defineNitroPlugin((nitroApp) => {
  // The dev server injects its own scripts and reloads over a websocket.
  if (process.env.NODE_ENV === 'development') {
    return
  }

  nitroApp.hooks.hook('request', (event) => {
    setBaseHeaders(event)
  })

  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const nonce = randomBytes(16).toString('base64')

    for (const part of ['head', 'bodyPrepend', 'body', 'bodyAppend'] as const) {
      html[part] = html[part].map(chunk => addScriptNonce(chunk, nonce))
    }

    setResponseHeader(
      event,
      'Content-Security-Policy',
      buildContentSecurityPolicy(
        nonce,
        isEmbedPath(getRequestURL(event).pathname),
        typeof event.context.embedFrameAncestors === 'string' ? event.context.embedFrameAncestors : '*'
      )
    )
  })
})

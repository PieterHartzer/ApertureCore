import { frameAncestorsFor } from '../../shared/utils/embed-origins'
import { isFramedRequest, loadEmbedAccess, matchEmbedRequest, readEmbedToken } from '../utils/embed-access'
import { serverExtensions } from '../utils/extensions'

const refusalPage = (title: string, text: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.5 system-ui,sans-serif;color:#61675c;background:#f4f3ee;padding:24px;text-align:center}@media(prefers-color-scheme:dark){body{background:#121511;color:#a3a99c}}h1{font-size:18px;font-weight:600;color:inherit;margin:0 0 6px}</style></head><body><main><h1>${title}</h1><p>${text}</p></main></body></html>`

/**
 * Guards embedded dashboards: the page may only appear on the websites its
 * owner allowed, and a layer may require more (a signed link). The endpoints
 * themselves still check that the embed exists and is switched on.
 */
export default defineEventHandler(async (event) => {
  const match = matchEmbedRequest(getRequestURL(event).pathname)

  if (!match) return

  const access = await loadEmbedAccess(match.embedId).catch(() => null)

  // Unknown or switched-off embeds get the endpoints' own "not found".
  if (!access) return

  if (match.kind === 'page' && access.allowedOrigins.length) {
    event.context.embedFrameAncestors = frameAncestorsFor(access.allowedOrigins)
    setResponseHeader(event, 'Content-Security-Policy', `frame-ancestors ${event.context.embedFrameAncestors}`)

    if (!isFramedRequest(event)) {
      setResponseStatus(event, 403)
      setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')

      return refusalPage('This dashboard lives on another website', 'It can only be viewed on the website it was made for.')
    }
  }

  const decision = await serverExtensions.embedAccess?.({
    event,
    embedId: access.embedId,
    dashboardId: access.dashboardId,
    organizationId: access.organizationId,
    kind: match.kind,
    token: readEmbedToken(event, match.kind)
  })

  if (decision && !decision.ok) {
    setResponseStatus(event, 403)

    if (match.kind === 'data') {
      return { ok: false, code: 'forbidden', message: 'dashboards.embed.access.denied', messageKey: 'dashboards.embed.access.denied' }
    }

    setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')

    return refusalPage('This link has expired', 'Reload the page you came from to see the dashboard again.')
  }
})

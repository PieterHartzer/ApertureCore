import type { H3Event } from 'h3'

import { readStoredEmbedOrigins } from '../../shared/utils/embed-origins'
import { getAppDatabase } from './app-database'
import { isUuid } from './is-uuid'

export interface EmbedAccessRecord {
  embedId: string
  dashboardId: string
  organizationId: string
  allowedOrigins: string[]
}

const PAGE = /^\/embed\/dashboard\/([^/?#]+)\/?$/
const DATA = /^\/api\/embed\/dashboards\/([^/?#]+)(?:\/|$)/

/** Which embed a request is for, if any: the page itself or its data. */
export const matchEmbedRequest = (path: string): { kind: 'page' | 'data', embedId: string } | null => {
  const page = PAGE.exec(path)

  if (page?.[1]) return { kind: 'page', embedId: page[1] }

  const data = DATA.exec(path)

  return data?.[1] ? { kind: 'data', embedId: data[1] } : null
}

export const loadEmbedAccess = async (embedId: string): Promise<EmbedAccessRecord | null> => {
  if (!isUuid(embedId)) return null

  const row = await getAppDatabase()
    .selectFrom('app_dashboards')
    .select(['dashboard_id', 'organization_id', 'embed_allowed_origins'])
    .where('embed_id', '=', embedId)
    .where('embed_enabled', '=', true)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()

  return row
    ? { embedId, dashboardId: row.dashboard_id, organizationId: row.organization_id, allowedOrigins: readStoredEmbedOrigins(row.embed_allowed_origins) }
    : null
}

/**
 * Whether the browser is loading the page inside a frame. Browsers send
 * Sec-Fetch-Dest themselves and scripts in a web page cannot change it, so a
 * link opened directly in a tab, or copied into another site's frame (which
 * frame-ancestors then blocks), does not show the dashboard.
 */
export const isFramedRequest = (event: H3Event) => {
  const destination = getRequestHeader(event, 'sec-fetch-dest')

  return destination === 'iframe' || destination === 'frame'
}

/** The signed-link token: the page's ?token= or a data request's x-embed-token header. */
export const readEmbedToken = (event: H3Event, kind: 'page' | 'data') => {
  const value = kind === 'page' ? getQuery(event).token : getRequestHeader(event, 'x-embed-token')

  return typeof value === 'string' ? value.slice(0, 4096) : ''
}

import { getRequestHost, getRequestHeader, setResponseStatus } from 'h3'

import { isCrossOriginWrite } from '../utils/request-origin'

/** Refuses API writes sent from another origin, before anything else runs. */
export default defineEventHandler((event) => {
  if (!isCrossOriginWrite({
    method: event.method,
    path: event.path,
    host: getRequestHost(event, { xForwardedHost: true }),
    origin: getRequestHeader(event, 'origin'),
    secFetchSite: getRequestHeader(event, 'sec-fetch-site')
  })) return

  setResponseStatus(event, 403)

  return {
    ok: false,
    code: 'cross_origin',
    message: 'errors.auth.crossOrigin',
    messageKey: 'errors.auth.crossOrigin'
  }
})

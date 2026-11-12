import { isIP } from 'node:net'

import type { H3Event } from 'h3'

import { pickString } from './pick-string'

const HEADER_NAME = /^[a-z0-9-]{1,64}$/

/**
 * The header a trusted proxy in front of the app puts the visitor's address
 * in, for example `cf-connecting-ip` behind Cloudflare. Only set it when the
 * server accepts traffic from that proxy alone; otherwise anyone can send the
 * header and choose their own address.
 */
const trustedHeader = () => {
  const name = process.env.CLIENT_IP_HEADER?.trim().toLowerCase()

  return name && HEADER_NAME.test(name) ? name : null
}

const valid = (value: string | undefined) => {
  const address = value?.trim()

  return address && isIP(address) ? address : null
}

/**
 * The visitor's address, for rate limits and the audit log. Uses the trusted
 * proxy header when one is configured, otherwise the last X-Forwarded-For
 * entry (the one our own proxy added; earlier entries come from the client),
 * otherwise the connection itself.
 */
export const getClientAddress = (event: H3Event): string | null => {
  const header = trustedHeader()

  if (header) {
    const trusted = valid(pickString(event.node.req.headers[header]))

    if (trusted) return trusted
  }

  const forwarded = pickString(event.node.req.headers['x-forwarded-for'])?.split(',').at(-1)

  return valid(forwarded) ?? valid(event.node.req.socket?.remoteAddress) ?? null
}

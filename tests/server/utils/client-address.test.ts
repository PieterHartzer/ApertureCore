import { afterEach, describe, expect, it } from 'vitest'

import { getClientAddress } from '../../../server/utils/client-address'

const request = (headers: Record<string, string>, remoteAddress = '10.0.0.2') => ({
  node: { req: { headers, socket: { remoteAddress } } }
}) as never

describe('getClientAddress', () => {
  afterEach(() => {
    delete process.env.CLIENT_IP_HEADER
  })

  it('takes the address our own proxy added, not one the client wrote', () => {
    expect(getClientAddress(request({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('falls back to the connection', () => {
    expect(getClientAddress(request({}))).toBe('10.0.0.2')
    expect(getClientAddress(request({ 'x-forwarded-for': 'not-an-ip' }))).toBe('10.0.0.2')
  })

  it('uses the trusted proxy header only when the deployment names it', () => {
    const headers = { 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '198.51.100.7, 172.70.1.1' }

    expect(getClientAddress(request(headers))).toBe('172.70.1.1')

    process.env.CLIENT_IP_HEADER = 'CF-Connecting-IP'

    expect(getClientAddress(request(headers))).toBe('198.51.100.7')
    expect(getClientAddress(request({ 'cf-connecting-ip': 'junk', 'x-forwarded-for': '172.70.1.1' }))).toBe('172.70.1.1')
  })
})

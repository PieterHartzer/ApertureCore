import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

const alwaysBlockedAddresses = new BlockList()

// Link-local ranges hold cloud metadata services, which a tenant-supplied
// database host must never be able to reach.
alwaysBlockedAddresses.addSubnet('169.254.0.0', 16, 'ipv4')
alwaysBlockedAddresses.addSubnet('fe80::', 10, 'ipv6')
alwaysBlockedAddresses.addSubnet('fd00:ec2::', 64, 'ipv6')

const nonPublicAddresses = new BlockList()

// Everything a customer on a hosted service has no reason to reach.
nonPublicAddresses.addSubnet('0.0.0.0', 8, 'ipv4')
nonPublicAddresses.addSubnet('10.0.0.0', 8, 'ipv4')
nonPublicAddresses.addSubnet('100.64.0.0', 10, 'ipv4')
nonPublicAddresses.addSubnet('127.0.0.0', 8, 'ipv4')
nonPublicAddresses.addSubnet('172.16.0.0', 12, 'ipv4')
nonPublicAddresses.addSubnet('192.0.0.0', 24, 'ipv4')
nonPublicAddresses.addSubnet('192.168.0.0', 16, 'ipv4')
nonPublicAddresses.addSubnet('198.18.0.0', 15, 'ipv4')
nonPublicAddresses.addSubnet('224.0.0.0', 4, 'ipv4')
nonPublicAddresses.addSubnet('240.0.0.0', 4, 'ipv4')
nonPublicAddresses.addAddress('::', 'ipv6')
nonPublicAddresses.addAddress('::1', 'ipv6')
nonPublicAddresses.addSubnet('64:ff9b::', 96, 'ipv6')
nonPublicAddresses.addSubnet('2002::', 16, 'ipv6')
nonPublicAddresses.addSubnet('fc00::', 7, 'ipv6')
nonPublicAddresses.addSubnet('ff00::', 8, 'ipv6')

export type DatabaseTarget =
  | { allowed: true, connectAddress?: string }
  | { allowed: false, reason: 'blocked' | 'unresolved' }

const resolveAddresses = async (host: string) => {
  if (isIP(host)) {
    return [host]
  }

  try {
    const results = await lookup(host, { all: true })

    return results.map((result) => result.address)
  } catch {
    return []
  }
}

const isInList = (list: BlockList, address: string) => {
  return list.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4')
}

const getAppDatabaseTarget = () => {
  try {
    const url = new URL(process.env.APP_DATABASE_URL ?? '')

    return { host: url.hostname, port: Number(url.port || 5432) }
  } catch {
    return null
  }
}

const isAppDatabase = async (addresses: string[], port: number) => {
  const appDatabase = getAppDatabaseTarget()

  if (!appDatabase || appDatabase.port !== port) {
    return false
  }

  const appAddresses = await resolveAddresses(appDatabase.host)

  return addresses.some((address) => appAddresses.includes(address))
}

/** Self-hosted installs opt in, so a hosted deployment is safe by default. */
const allowsPrivateNetworks = () => {
  return (
    process.env.ALLOW_PRIVATE_DATABASE_HOSTS === 'true' ||
    process.env.NODE_ENV === 'development'
  )
}

/**
 * Decides whether a customer's database host may be contacted. Metadata
 * services and the application's own database are always refused. Other
 * private addresses are refused unless the deployment opts in.
 *
 * The returned address must be the one connected to. Looking the name up again
 * would let a hostile DNS server answer differently the second time.
 */
export const resolveDatabaseTarget = async (
  host: string,
  port: number
): Promise<DatabaseTarget> => {
  const addresses = await resolveAddresses(host)

  if (
    addresses.some((address) => isInList(alwaysBlockedAddresses, address)) ||
    await isAppDatabase(addresses, port)
  ) {
    return { allowed: false, reason: 'blocked' }
  }

  if (allowsPrivateNetworks()) {
    return { allowed: true }
  }

  if (addresses.length === 0) {
    return { allowed: false, reason: 'unresolved' }
  }

  if (addresses.some((address) => isInList(nonPublicAddresses, address))) {
    return { allowed: false, reason: 'blocked' }
  }

  return { allowed: true, connectAddress: addresses[0] }
}

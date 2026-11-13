import { DEFAULT_PORTS, type DatabaseConnection } from '../types/database'

/**
 * Reads the connection string most database providers show (Neon, Supabase,
 * AWS, Azure, Railway...) into the connection form's fields:
 *
 *   postgres://user:pass@host:5432/db?sslmode=require
 *   mysql://user:pass@host:3306/db?ssl-mode=REQUIRED
 *   sqlserver://host:1433;databaseName=db;user=u;password=p;encrypt=true
 *   Server=tcp:host,1433;Database=db;User Id=u;Password=p;Encrypt=True;
 *
 * A "jdbc:" prefix is ignored. Only the fields the string mentions are returned.
 */
export type ParsedConnectionString = Partial<Omit<DatabaseConnection, 'connectionName'>>

export type ConnectionStringResult =
  | { ok: true, value: ParsedConnectionString }
  | { ok: false }

const SCHEMES: Record<string, DatabaseConnection['databaseType']> = {
  postgres: 'postgres',
  postgresql: 'postgres',
  mysql: 'mysql',
  mariadb: 'mysql',
  sqlserver: 'mssql',
  mssql: 'mssql'
}

const decode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const toPort = (value: string | undefined) => {
  const port = Number(value)

  return Number.isInteger(port) && port > 0 && port < 65536 ? port : undefined
}

/** Maps every provider's SSL wording onto the form's two choices. */
const sslFrom = (value: string | undefined): DatabaseConnection['sslMode'] | undefined => {
  if (value === undefined) return undefined

  const text = value.trim().toLowerCase()

  if (['disable', 'disabled', 'false', 'no', 'off', '0', 'optional'].includes(text)) return 'disable'
  if (['require', 'required', 'verify-ca', 'verify-full', 'verify_ca', 'verify_identity', 'true', 'yes', 'on', '1', 'mandatory', 'strict'].includes(text)) return 'require'

  return undefined
}

const withoutEmpty = (value: ParsedConnectionString): ParsedConnectionString => {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== '')) as ParsedConnectionString
}

/** Server=tcp:host,1433;Database=db;User Id=u;Password=p;Encrypt=True */
const parseKeyValue = (text: string): ConnectionStringResult => {
  const pairs = new Map<string, string>()

  for (const part of text.split(';')) {
    const index = part.indexOf('=')

    if (index > 0) pairs.set(part.slice(0, index).trim().toLowerCase().replace(/\s+/g, ' '), part.slice(index + 1).trim())
  }

  const server = pairs.get('server') ?? pairs.get('data source') ?? pairs.get('address') ?? pairs.get('addr')

  if (!server) return { ok: false }

  const [hostPart = '', portPart] = server.replace(/^tcp:/i, '').split(',')

  return {
    ok: true,
    value: withoutEmpty({
      databaseType: 'mssql',
      host: hostPart.trim(),
      port: toPort(portPart?.trim()) ?? DEFAULT_PORTS.mssql,
      databaseName: pairs.get('database') ?? pairs.get('initial catalog'),
      username: pairs.get('user id') ?? pairs.get('uid') ?? pairs.get('user'),
      password: pairs.get('password') ?? pairs.get('pwd'),
      sslMode: sslFrom(pairs.get('encrypt'))
    })
  }
}

/** sqlserver://host:1433;databaseName=db;user=u;password=p;encrypt=true (JDBC) */
const parseSqlServerUrl = (rest: string): ConnectionStringResult => {
  const [address = '', ...properties] = rest.split(';')
  const pairs = new Map(properties.map((part) => {
    const index = part.indexOf('=')

    return [part.slice(0, index).trim().toLowerCase(), part.slice(index + 1).trim()] as const
  }))
  const [host = '', port] = address.replace(/\/+$/, '').split(':')

  if (!host) return { ok: false }

  return {
    ok: true,
    value: withoutEmpty({
      databaseType: 'mssql',
      host,
      port: toPort(port) ?? DEFAULT_PORTS.mssql,
      databaseName: pairs.get('databasename') ?? pairs.get('database'),
      username: pairs.get('user') ?? pairs.get('username'),
      password: pairs.get('password'),
      sslMode: sslFrom(pairs.get('encrypt'))
    })
  }
}

export const parseConnectionString = (input: string): ConnectionStringResult => {
  const text = input.trim().replace(/^jdbc:/i, '')

  if (!text) return { ok: false }

  const scheme = /^([a-z]+):\/\//i.exec(text)?.[1]?.toLowerCase()

  if (!scheme) return text.includes('=') ? parseKeyValue(text) : { ok: false }

  const databaseType = SCHEMES[scheme]

  if (!databaseType) return { ok: false }

  if (databaseType === 'mssql' && /^[a-z]+:\/\/[^/?]*;/i.test(text)) {
    return parseSqlServerUrl(text.slice(scheme.length + 3))
  }

  let url: URL

  try {
    // URL only understands known schemes fully, so read it as http.
    url = new URL(text.replace(/^[a-z]+:\/\//i, 'http://'))
  } catch {
    return { ok: false }
  }

  if (!url.hostname) return { ok: false }

  const params = url.searchParams
  const ssl = sslFrom(params.get('sslmode') ?? params.get('ssl-mode') ?? params.get('ssl_mode') ?? params.get('ssl') ?? params.get('encrypt') ?? undefined)

  return {
    ok: true,
    value: withoutEmpty({
      databaseType,
      host: decode(url.hostname),
      port: toPort(url.port) ?? DEFAULT_PORTS[databaseType],
      databaseName: decode(url.pathname.replace(/^\/+/, '').split('/')[0] ?? ''),
      username: decode(url.username),
      password: decode(url.password),
      sslMode: ssl
    })
  }
}

export const DATABASE_TYPES = ['postgresql'] as const
export type DatabaseType = (typeof DATABASE_TYPES)[number]

export const DATABASE_SSL_MODES = ['disable', 'require'] as const
export type DatabaseSslMode = (typeof DATABASE_SSL_MODES)[number]

export const DEFAULT_PORTS = {
  postgresql: 5432,
} as const

export interface DatabaseConnection {
  connectionName: string
  databaseType: DatabaseType
  host: string
  port: number | null
  databaseName: string
  username: string
  password: string
  sslMode: DatabaseSslMode
}

export type DatabaseConnectionTestResultCode =
  | 'success'
  | 'unauthorized'
  | 'rate_limited'
  | 'invalid_input'
  | 'saved_connection_not_found'
  | 'unsupported_database_type'
  | 'authentication_failed'
  | 'database_not_found'
  | 'connection_failed'
  | 'timeout'
  | 'ssl_required'
  | 'not_implemented'
  | 'unexpected_error'

export interface DatabaseConnectionTestResponse {
  ok: boolean
  code: DatabaseConnectionTestResultCode
  message: string
  messageKey?: string
}

export const createEmptyDatabaseConnection = (): DatabaseConnection => ({
  connectionName: '',
  databaseType: 'postgresql',
  host: '',
  port: DEFAULT_PORTS.postgresql,
  databaseName: '',
  username: '',
  password: '',
  sslMode: 'disable'
})

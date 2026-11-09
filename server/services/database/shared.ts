import type {
  DatabaseQueryResultRow,
  DatabaseQueryResultValue
} from '../../types/database'

export const CONNECT_TIMEOUT_SECONDS = 5
export const DEFAULT_QUERY_TIMEOUT_MS = 5_000
export const QUERY_LOCK_TIMEOUT_MS = 1_000
export const DEFAULT_QUERY_RESULT_ROW_LIMIT = 25

const MAX_RESULT_VALUE_LENGTH = 2_000

const TLS_VERIFICATION_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
])

/**
 * Identifies a failed server certificate check, which every adapter reports as
 * an SSL configuration problem instead of a generic connection failure.
 */
export const isTlsVerificationError = (error: Error & { code?: string }) => {
  return (
    (error.code !== undefined && TLS_VERIFICATION_ERROR_CODES.has(error.code)) ||
    /self[- ]signed certificate|unable to verify the first certificate|does not match certificate/i.test(error.message)
  )
}

export const PRIVILEGED_ROLE_DETAILS =
  'This database login has more privileges than AutoDash allows. Use a dedicated login that can only read data.'

const truncateResultValue = (value: string) => {
  if (value.length <= MAX_RESULT_VALUE_LENGTH) {
    return value
  }

  return `${value.slice(0, MAX_RESULT_VALUE_LENGTH)}...`
}

const sanitizeResultValue = (value: unknown): DatabaseQueryResultValue => {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return value ?? null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : truncateResultValue(String(value))
  }

  if (typeof value === 'string') {
    return truncateResultValue(value)
  }

  if (typeof value === 'bigint') {
    return truncateResultValue(value.toString())
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Buffer.isBuffer(value)) {
    return `[binary ${value.byteLength} bytes]`
  }

  try {
    const serializedValue = JSON.stringify(value)

    return truncateResultValue(serializedValue ?? String(value))
  } catch {
    return truncateResultValue(String(value))
  }
}

export const sanitizeResultRow = (
  row: Record<string, unknown>,
  columns: string[]
): DatabaseQueryResultRow => {
  const sanitizedRow: DatabaseQueryResultRow = {}

  for (const column of columns) {
    sanitizedRow[column] = sanitizeResultValue(row[column])
  }

  return sanitizedRow
}

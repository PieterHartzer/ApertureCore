import type {
  DatabaseQueryResultRow,
  DatabaseQueryResultValue
} from '../../types/database'

export const CONNECT_TIMEOUT_SECONDS = 5
export const DEFAULT_QUERY_TIMEOUT_MS = 5_000
export const QUERY_LOCK_TIMEOUT_MS = 1_000
export const DEFAULT_QUERY_RESULT_ROW_LIMIT = 25

const MAX_RESULT_VALUE_LENGTH = 2_000
/** Roughly the most a single result may take up, whatever its row and column count. */
export const MAX_RESULT_SIZE = 5 * 1024 * 1024

/**
 * Counts what each row will take up once sanitised, so an adapter can stop
 * reading before a query of very wide rows uses up the server's memory.
 * Returns false once the result is full; that row is not kept.
 */
export const createResultSizeBudget = (maximum = MAX_RESULT_SIZE) => {
  let used = 0

  return (row: Record<string, unknown>) => {
    for (const [column, value] of Object.entries(row)) {
      const length = typeof value === 'string' ? value.length : Buffer.isBuffer(value) ? 32 : String(value).length

      used += column.length + Math.min(length, MAX_RESULT_VALUE_LENGTH + 3) + 8
    }

    return used <= maximum
  }
}

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
  'This database login can do more than read data. Use a dedicated login that can only read data.'

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

// A double holds 15 significant digits exactly; beyond that the text is kept.
const MAX_EXACT_DIGITS = 15

/**
 * Drivers return big integers and decimals as text so nothing is lost. A
 * number is far more useful to charts, so convert when that is exact and keep
 * the text when it isn't.
 */
export const toExactNumber = (value: unknown) => {
  if (typeof value !== 'string') return value

  const text = value.trim()

  if (!/^-?\d+(\.\d+)?$/.test(text)) return value

  const number = Number(text)

  if (!text.includes('.')) return Number.isSafeInteger(number) ? number : value

  const digits = text.replace('-', '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '')

  return digits.length <= MAX_EXACT_DIGITS ? number : value
}

/** numericColumns: columns the database typed as numbers (bigint, decimal) that the driver may return as text. */
export const sanitizeResultRow = (
  row: Record<string, unknown>,
  columns: string[],
  numericColumns?: ReadonlySet<string>
): DatabaseQueryResultRow => {
  const sanitizedRow: DatabaseQueryResultRow = {}

  for (const column of columns) {
    sanitizedRow[column] = sanitizeResultValue(numericColumns?.has(column) ? toExactNumber(row[column]) : row[column])
  }

  return sanitizedRow
}

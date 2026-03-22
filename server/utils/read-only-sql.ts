export const MAX_READ_ONLY_SQL_LENGTH = 20_000

export type ReadOnlySqlValidationIssue =
  | 'sql_required'
  | 'sql_too_long'
  | 'sql_invalid_characters'
  | 'sql_multiple_statements'
  | 'sql_not_read_only'

export type NormalizeReadOnlySqlResult =
  | {
      ok: true
      sql: string
    }
  | {
      ok: false
      issue: ReadOnlySqlValidationIssue
      details: string
    }

/**
 * Applies the shared SQL safety policy for saved and tested queries. The exact
 * SQL text is preserved on success so encryption stores the user-authored text.
 */
export const normalizeReadOnlySql = (
  sql: string
): NormalizeReadOnlySqlResult => {
  const trimmedSql = sql.trim()

  if (!trimmedSql) {
    return {
      ok: false,
      issue: 'sql_required',
      details: 'SQL query is required.'
    }
  }

  if (trimmedSql.length > MAX_READ_ONLY_SQL_LENGTH) {
    return {
      ok: false,
      issue: 'sql_too_long',
      details: 'SQL query exceeds the allowed length.'
    }
  }

  if (trimmedSql.includes('\0')) {
    return {
      ok: false,
      issue: 'sql_invalid_characters',
      details: 'SQL query contains invalid characters.'
    }
  }

  const normalizedSql = trimmedSql.replace(/;\s*$/, '')

  if (normalizedSql.includes(';')) {
    return {
      ok: false,
      issue: 'sql_multiple_statements',
      details: 'Only a single SQL statement can be used.'
    }
  }

  const leadingKeyword = normalizedSql.match(/^[a-z]+/i)?.[0]?.toLowerCase()

  if (leadingKeyword !== 'select' && leadingKeyword !== 'with') {
    return {
      ok: false,
      issue: 'sql_not_read_only',
      details: 'Only read-only SELECT queries are allowed.'
    }
  }

  return {
    ok: true,
    sql: normalizedSql
  }
}

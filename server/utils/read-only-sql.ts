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

const FORBIDDEN_TSQL_KEYWORDS = new Set([
  'ALTER', 'BACKUP', 'BEGIN', 'BULK', 'CHECKPOINT', 'COMMIT', 'CREATE', 'DBCC',
  'DECLARE', 'DELETE', 'DENY', 'DISABLE', 'DROP', 'ENABLE', 'EXEC', 'EXECUTE',
  'GRANT', 'INSERT', 'INTO', 'KILL', 'MERGE', 'OPENDATASOURCE', 'OPENQUERY',
  'OPENROWSET', 'READTEXT', 'RECONFIGURE', 'RESTORE', 'REVOKE', 'ROLLBACK',
  'SET', 'SHUTDOWN', 'TRUNCATE', 'UPDATE', 'UPDATETEXT', 'USE', 'WAITFOR',
  'WHILE', 'WRITETEXT'
])

const skipDelimited = (sql: string, start: number, close: string) => {
  let index = start + 1

  while (index < sql.length) {
    if (sql[index] !== close) {
      index += 1
    } else if (sql[index + 1] === close) {
      index += 2
    } else {
      return index + 1
    }
  }

  return -1
}

const skipBlockComment = (sql: string, start: number) => {
  let depth = 1
  let index = start + 2

  while (index < sql.length && depth > 0) {
    if (sql.startsWith('/*', index)) {
      depth += 1
      index += 2
    } else if (sql.startsWith('*/', index)) {
      depth -= 1
      index += 2
    } else {
      index += 1
    }
  }

  return depth === 0 ? index : -1
}

/**
 * T-SQL separates statements with whitespace alone, so a single leading SELECT
 * proves nothing. Returns the first statement keyword found outside strings,
 * quoted identifiers and comments, or 'UNTERMINATED' for text that cannot be
 * tokenized safely.
 */
export const findForbiddenTsqlKeyword = (sql: string): string | null => {
  const delimiters: Record<string, string> = { '\'': '\'', '"': '"', '[': ']' }
  let index = 0

  while (index < sql.length) {
    const character = sql[index] as string
    const close = delimiters[character]

    if (close) {
      index = skipDelimited(sql, index, close)
    } else if (sql.startsWith('--', index)) {
      const lineEnd = sql.indexOf('\n', index)

      index = lineEnd === -1 ? sql.length : lineEnd + 1
    } else if (sql.startsWith('/*', index)) {
      index = skipBlockComment(sql, index)
    } else if (/[\p{L}_@#$]/u.test(character)) {
      const word = /^[\p{L}\p{N}_@#$]+/u.exec(sql.slice(index))?.[0] ?? character

      if (FORBIDDEN_TSQL_KEYWORDS.has(word.toUpperCase())) {
        return word.toUpperCase()
      }

      index += word.length
    } else {
      index += 1
    }

    if (index === -1) {
      return 'UNTERMINATED'
    }
  }

  return null
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

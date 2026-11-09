import { MSSQL, MySQL, PostgreSQL, SQLite, sql, type SQLDialect } from '@codemirror/lang-sql'

const DIALECTS: Record<string, SQLDialect> = {
  postgres: PostgreSQL,
  mysql: MySQL,
  mssql: MSSQL,
  sqlite: SQLite
}

const IDENTIFIER = '(?:"(?:[^"]|"")*"|`(?:[^`]|``)*`|\\[(?:[^\\]]|\\]\\])*\\])'
const SCHEMA_LINE = new RegExp(`^(${IDENTIFIER})\\.(${IDENTIFIER})\\.(${IDENTIFIER})(?:\\s|$)`)

const unquote = (identifier: string) => {
  const close = identifier.slice(-1)

  return identifier.slice(1, -1).replaceAll(close + close, close)
}

type CompletionSchema = Record<string, Record<string, string[]>>

/** Reads the `schema.table.column type` lines the schema endpoint returns. */
export const parseCompletionSchema = (schema: string) => {
  // No prototype, so a table called __proto__ is only ever a table.
  const namespace: CompletionSchema = Object.create(null)

  for (const line of schema.split('\n')) {
    const match = SCHEMA_LINE.exec(line)

    if (!match) continue

    const [schemaName, tableName, columnName] = [match[1]!, match[2]!, match[3]!].map(unquote) as [string, string, string]

    namespace[schemaName] ??= Object.create(null) as Record<string, string[]>
    ;(namespace[schemaName][tableName] ??= []).push(columnName)
  }

  return namespace
}

const defaultSchemaFor = (namespace: CompletionSchema, databaseType: string) => {
  const preferred = { postgres: 'public', mssql: 'dbo' }[databaseType]

  return preferred && preferred in namespace ? preferred : Object.keys(namespace)[0]
}

export const sqlLanguageFor = (databaseType: string, schema: string) => {
  const namespace = parseCompletionSchema(schema)

  return sql({
    dialect: DIALECTS[databaseType] ?? PostgreSQL,
    schema: namespace,
    defaultSchema: defaultSchemaFor(namespace, databaseType),
    upperCaseKeywords: true
  })
}

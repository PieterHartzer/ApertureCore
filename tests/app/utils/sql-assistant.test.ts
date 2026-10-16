import { describe, expect, it } from 'vitest'
import { buildSqlPrompt, extractGeneratedSql, WEBLLM_SQL_INPUT_CHARACTER_LIMIT } from '../../../app/utils/sql-assistant'

describe('SQL generation prompts', () => {
  it('grounds generation in the actual schema and keeps user text separate from instructions', () => {
    const messages = buildSqlPrompt('"public"."orders"."total" numeric', 'Show monthly sales')
    expect(messages[0]?.content).toContain('PostgreSQL')
    expect(messages[0]?.content).toContain('Do not add date filters unless requested')
    expect(messages[1]?.content).toContain('"public"."orders"."total" numeric')
    expect(messages[1]?.content).toContain('Show monthly sales')
  })
  it('rejects missing schema or questions', () => {
    expect(() => buildSqlPrompt('', 'sales')).toThrow('No accessible tables')
    expect(() => buildSqlPrompt('orders', '')).toThrow('Enter a question')

  })
  it('keeps large provider prompts intact instead of applying the browser context budget', () => {
    const schema = 'public.orders.amount numeric\n'.repeat(2000)
    expect(schema.length).toBeGreaterThan(WEBLLM_SQL_INPUT_CHARACTER_LIMIT)
    expect(buildSqlPrompt(schema, 'Total sales')[1]?.content).toContain(schema)
  })
  it('enforces the browser budget only when explicitly requested', () => {
    const options = { maxInputCharacters: WEBLLM_SQL_INPUT_CHARACTER_LIMIT }
    expect(() => buildSqlPrompt('x'.repeat(WEBLLM_SQL_INPUT_CHARACTER_LIMIT - 1), 'x', options)).not.toThrow()
    expect(() => buildSqlPrompt('x'.repeat(WEBLLM_SQL_INPUT_CHARACTER_LIMIT), 'x', options)).toThrow('browser model')
  })
  it('includes PostgreSQL dialect and explicit conversion rules for text dates', () => {
    const messages = buildSqlPrompt('"public"."spray_application_logs"."date" text', 'Monthly poison usage', { databaseType: 'postgres' })
    expect(messages[0]?.content).toContain('Database dialect: PostgreSQL')
    expect(messages[0]?.content).toContain('explicitly cast text/varchar date columns to timestamp')
    expect(messages[0]?.content).toContain("NULLIF(BTRIM(column), '')")
    expect(messages[1]?.content).toContain('"date" text')
  })
  it.each([
    ['mssql', 'Microsoft SQL Server (T-SQL)'],
    ['mysql', 'MySQL'],
    ['sqlite', 'SQLite']
  ] as const)('builds %s-specific instructions without the PostgreSQL default', (databaseType, label) => {
    const prompt = buildSqlPrompt('events.date text', 'Monthly events', { databaseType })[0]!.content
    expect(prompt).toContain(`Database dialect: ${label}`)
    expect(prompt).toContain('Never mix SQL dialects')
  })
  it('accepts SELECT and WITH output and removes markdown fences', () => {
    expect(extractGeneratedSql('```sql\nSELECT 1;\n```')).toBe('SELECT 1;')
    expect(extractGeneratedSql(' WITH s AS (SELECT 1) SELECT * FROM s ')).toBe('WITH s AS (SELECT 1) SELECT * FROM s')
  })
  it('rejects explanations, empty output and mutations', () => {
    for (const value of ['', 'Here is your SQL: SELECT 1', 'DELETE FROM orders']) {
      expect(() => extractGeneratedSql(value)).toThrow('did not return a SELECT')
    }
  })
})

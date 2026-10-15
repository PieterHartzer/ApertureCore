import { describe, expect, it } from 'vitest'
import { buildSqlPrompt, extractGeneratedSql } from '../../../app/utils/sql-assistant'

describe('local SQL generation', () => {
  it('grounds generation in the actual schema and keeps user text separate from instructions', () => {
    const messages = buildSqlPrompt('"public"."orders"."total" numeric', 'Show monthly sales')
    expect(messages[0]?.content).toContain('PostgreSQL')
    expect(messages[0]?.content).toContain('Do not add date filters unless requested')
    expect(messages[1]?.content).toContain('"public"."orders"."total" numeric')
    expect(messages[1]?.content).toContain('Show monthly sales')
  })
  it('rejects missing or oversized schema instead of silently truncating it', () => {
    expect(() => buildSqlPrompt('', 'sales')).toThrow('No accessible tables')
    expect(() => buildSqlPrompt('orders', '')).toThrow('Enter a question')
    expect(() => buildSqlPrompt('x'.repeat(12001), 'sales')).toThrow('too large')
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

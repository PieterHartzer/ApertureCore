import { describe, expect, it } from 'vitest'

import { createResultSizeBudget, sanitizeResultRow, toExactNumber } from '../../../../server/services/database/shared'

describe('result size budget', () => {
  it('accepts ordinary rows', () => {
    const fits = createResultSizeBudget()

    for (let index = 0; index < 1000; index++) {
      expect(fits({ id: index, name: `Customer ${index}`, total: 12.5 })).toBe(true)
    }
  })

  it('stops a result of very wide rows long before it reaches the row limit', () => {
    const fits = createResultSizeBudget()
    const wideRow = Object.fromEntries(Array.from({ length: 1000 }, (_, column) => [`c${column}`, 'x'.repeat(5000)]))
    let kept = 0

    while (fits(wideRow)) kept++

    // Each cell counts as its sanitised size (2,000 characters), so about 2 MB per row.
    expect(kept).toBeGreaterThan(0)
    expect(kept).toBeLessThan(5)
  })

  it('counts a huge cell only as the size it is cut down to', () => {
    const fits = createResultSizeBudget(10_000)

    expect(fits({ note: 'x'.repeat(1_000_000) })).toBe(true)
    expect(sanitizeResultRow({ note: 'x'.repeat(1_000_000) }, ['note']).note).toHaveLength(2003)
  })
})

describe('numbers the driver returned as text', () => {
  it('becomes a number when that is exact', () => {
    expect(toExactNumber('42')).toBe(42)
    expect(toExactNumber('-12.50')).toBe(-12.5)
    expect(toExactNumber('0.000123')).toBe(0.000123)
    expect(toExactNumber('9007199254740991')).toBe(9007199254740991)
  })

  it('stays text when a number would lose digits, or when it is not a plain number', () => {
    expect(toExactNumber('9007199254740993')).toBe('9007199254740993')
    expect(toExactNumber('1234567890.123456789')).toBe('1234567890.123456789')
    expect(toExactNumber('1e5')).toBe('1e5')
    expect(toExactNumber('$12')).toBe('$12')
    expect(toExactNumber(7)).toBe(7)
  })

  it('only converts columns the database typed as numbers, so codes like 0123 keep their zeros', () => {
    expect(sanitizeResultRow({ total: '42', postcode: '0123' }, ['total', 'postcode'], new Set(['total']))).toEqual({ total: 42, postcode: '0123' })
  })
})

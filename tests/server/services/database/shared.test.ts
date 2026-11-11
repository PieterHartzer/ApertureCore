import { describe, expect, it } from 'vitest'

import { createResultSizeBudget, sanitizeResultRow } from '../../../../server/services/database/shared'

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

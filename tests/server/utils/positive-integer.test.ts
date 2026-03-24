import { describe, expect, it } from 'vitest'

import { resolvePositiveInteger } from '../../../server/utils/positive-integer'

describe('resolvePositiveInteger', () => {
  it('returns valid positive integer numbers unchanged', () => {
    expect(resolvePositiveInteger(42, 7)).toBe(42)
  })

  it('parses trimmed positive integer strings', () => {
    expect(resolvePositiveInteger(' 15 ', 7)).toBe(15)
  })

  it('falls back for zero, negatives, floats, and invalid strings', () => {
    expect(resolvePositiveInteger(0, 7)).toBe(7)
    expect(resolvePositiveInteger(-1, 7)).toBe(7)
    expect(resolvePositiveInteger(2.5, 7)).toBe(7)
    expect(resolvePositiveInteger('abc', 7)).toBe(7)
    expect(resolvePositiveInteger('   ', 7)).toBe(7)
  })
})

import { describe, expect, it } from 'vitest'

import { isHexColor, joinHexColor, splitHexColor } from '../../shared/utils/color'

describe('hex colours with opacity', () => {
  it('accepts six and eight digit hex only', () => {
    expect(isHexColor('#a1b2c3')).toBe(true)
    expect(isHexColor('#a1b2c380')).toBe(true)
    expect(isHexColor('#abc')).toBe(false)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('#a1b2c3; background: url(x)')).toBe(false)
  })

  it('splits a colour into its solid part and opacity', () => {
    expect(splitHexColor('#A1B2C3')).toEqual({ solid: '#a1b2c3', opacity: 100 })
    expect(splitHexColor('#a1b2c366')).toEqual({ solid: '#a1b2c3', opacity: 40 })
  })

  it('keeps fully opaque colours in the short form', () => {
    expect(joinHexColor('#A1B2C3', 100)).toBe('#a1b2c3')
    expect(joinHexColor('#a1b2c3', 40)).toBe('#a1b2c366')
    expect(joinHexColor('#a1b2c3', 0)).toBe('#a1b2c300')
    expect(joinHexColor('#a1b2c3', 140)).toBe('#a1b2c3')
  })
})

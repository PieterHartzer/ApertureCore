import { describe, expect, it } from 'vitest'

import { buildDashboardCss, getDashboardChartStyle, normalizeDashboardStyle } from '../../shared/utils/dashboard-style'

describe('style properties', () => {
  it('keeps only known, valid values and clamps sizes', () => {
    expect(normalizeDashboardStyle({ borderWidth: 99, borderColor: 'red;}', shadow: 'huge', titleAlign: 'center', unknown: 1 }).style).toEqual({ borderWidth: 8, titleAlign: 'center' })
  })

  it('removes borders when the width is zero', () => {
    expect(buildDashboardCss({ borderWidth: 0 })).toContain('outline: 0px solid var(--ui-border) !important')
  })

  it('ignores custom CSS', () => {
    expect(buildDashboardCss({ customCss: '.a { color: red }' })).not.toContain('color: red')
  })

  it('passes chart colours and fonts through', () => {
    expect(getDashboardChartStyle({ chartPrimary: '#112233', fontFamily: 'serif' })).toMatchObject({ primary: '#112233', fontFamily: expect.stringContaining('serif') })
  })
})

describe('dashboard border styles', () => {
  it('draws the chosen border style inside the card', () => {
    const css = buildDashboardCss({ borderWidth: 2, borderStyle: 'dashed', borderColor: '#ff000080' })

    expect(css).toContain('outline: 2px dashed #ff000080 !important')
    expect(css).toContain('outline-offset: -2px !important')
  })

  it('ignores unknown border styles', () => {
    expect(buildDashboardCss({ borderStyle: 'groove; background: red' })).not.toContain('groove')
  })
})

describe('widgets that hide the shadow', () => {
  const rule = (css: string) => css.split('\n').find(line => line.includes('[data-hide-shadow]')) ?? ''

  it('brings back the thin ring when the shadow had replaced it', () => {
    expect(rule(buildDashboardCss({ shadow: 'medium' }))).toContain('box-shadow: inset 0 0 0 1px var(--ui-border) !important')
  })

  it('draws nothing extra when the dashboard has its own border', () => {
    expect(rule(buildDashboardCss({ shadow: 'medium', borderWidth: 2 }))).toContain('box-shadow: none !important')
  })

  it('adds no rule when the dashboard has no shadow', () => {
    expect(rule(buildDashboardCss({}))).toBe('')
  })
})

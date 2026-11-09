import { describe, expect, it } from 'vitest'

import { buildDashboardCss, getDashboardChartStyle, normalizeDashboardStyle } from '../../shared/utils/dashboard-style'

describe('style properties', () => {
  it('keeps only known, valid values and clamps sizes', () => {
    expect(normalizeDashboardStyle({ borderWidth: 99, borderColor: 'red;}', shadow: 'huge', titleAlign: 'center', unknown: 1 }).style).toEqual({ borderWidth: 8, titleAlign: 'center' })
  })

  it('removes borders when the width is zero', () => {
    expect(buildDashboardCss({ borderWidth: 0 })).toContain('box-shadow: inset 0 0 0 0px var(--ui-border) !important')
  })

  it('ignores custom CSS', () => {
    expect(buildDashboardCss({ customCss: '.a { color: red }' })).not.toContain('color: red')
  })

  it('passes chart colours and fonts through', () => {
    expect(getDashboardChartStyle({ chartPrimary: '#112233', fontFamily: 'serif' })).toMatchObject({ primary: '#112233', fontFamily: expect.stringContaining('serif') })
  })
})

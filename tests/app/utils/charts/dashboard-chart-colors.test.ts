import { describe, expect, it, vi } from 'vitest'

import { applyDashboardChartColors, getChartColors, mixHexColors } from '../../../../app/utils/charts/chart-colors'
import { getDashboardChartStyle } from '../../../../shared/utils/dashboard-style'

vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))

const { parseHexInput } = await import('../../../../app/view-models/components/ui/ColorField')

const base = getChartColors(false)

describe('applyDashboardChartColors', () => {
  it('keeps the default palette when the dashboard sets no colours', () => {
    expect(applyDashboardChartColors(base, {})).toMatchObject({
      categorical: base.categorical,
      sequential: base.sequential,
      ordinal: base.ordinal
    })
  })

  it('replaces series slot by slot and keeps defaults in the gaps', () => {
    const colors = applyDashboardChartColors(base, { primary: '#8b5cf6', series: ['#ec4899', undefined, '#14b8a6'] })

    expect(colors.categorical.slice(0, 5)).toEqual(['#8b5cf6', '#ec4899', base.categorical[2], '#14b8a6', base.categorical[4]])
    expect(colors.categorical).toHaveLength(base.categorical.length)
  })

  it('runs heatmaps and funnel stages between the lowest and highest colours', () => {
    const colors = applyDashboardChartColors(base, { heatLow: '#1e293b', heatHigh: '#8b5cf6' })

    expect(colors.sequential).toEqual(['#1e293b', '#8b5cf6'])
    expect(colors.ordinal[0]).toBe('#8b5cf6')
    expect(colors.ordinal).toHaveLength(base.ordinal.length)
  })

  it('fades a main colour into the widget background when no heatmap colours are set', () => {
    const colors = applyDashboardChartColors(base, { primary: '#8b5cf6', surface: '#1e293b' })

    expect(colors.surface).toBe('#1e293b')
    expect(colors.sequential).toEqual([mixHexColors('#8b5cf6', '#1e293b', 0.88), '#8b5cf6'])
  })
})

describe('getDashboardChartStyle', () => {
  it('reads series, heatmap and background colours', () => {
    expect(getDashboardChartStyle({ chartColor2: '#ec4899', chartHeatHigh: '#8b5cf6', cardBackground: '#1e293bcc' })).toMatchObject({
      series: ['#ec4899', undefined, undefined, undefined, undefined],
      heatHigh: '#8b5cf6',
      surface: '#1e293b'
    })
  })
})

describe('mixHexColors', () => {
  it('mixes channel by channel and drops opacity', () => {
    expect(mixHexColors('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHexColors('#8b5cf680', '#8b5cf6', 0)).toBe('#8b5cf6')
  })
})

describe('parseHexInput', () => {
  it('reads the usual ways people write HTML colours', () => {
    expect(parseHexInput('#8B5CF6')).toBe('#8b5cf6')
    expect(parseHexInput(' 8b5cf6 ')).toBe('#8b5cf6')
    expect(parseHexInput('#abc')).toBe('#aabbcc')
    expect(parseHexInput('#8b5cf680')).toBe('#8b5cf680')
  })

  it('refuses anything else', () => {
    expect(parseHexInput('violet')).toBeNull()
    expect(parseHexInput('#8b5cf')).toBeNull()
    expect(parseHexInput('rgb(1, 2, 3)')).toBeNull()
  })
})

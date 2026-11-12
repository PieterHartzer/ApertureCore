import { describe, expect, it } from 'vitest'

import { applySeriesStyle, getChartColors } from '../../../../app/utils/charts/chart-colors'

const colors = { ...getChartColors(false), lineWidth: 2.5, areaOpacity: 0.3, areaColor: '#cdeb7b' }

describe('applySeriesStyle', () => {
  it('leaves charts alone when the palette sets no line style', () => {
    const option = { series: [{ type: 'line', lineStyle: { width: 2 } }] }

    expect(applySeriesStyle(option, getChartColors(false))).toBe(option)
  })

  it('widens default lines and fills the only area with the area colour', () => {
    const option = applySeriesStyle({ series: [{ type: 'line', lineStyle: { width: 2 }, areaStyle: { opacity: 0.08 } }] }, colors)

    expect(option.series[0]).toMatchObject({ lineStyle: { width: 2.5 }, areaStyle: { opacity: 0.3, color: '#cdeb7b' } })
  })

  it('keeps hidden lines, chosen widths, stacked areas and bars as they are', () => {
    const option = applySeriesStyle({
      series: [
        { type: 'line', lineStyle: { opacity: 0 } },
        { type: 'line', lineStyle: { width: 1 } },
        { type: 'line', stack: 'total', areaStyle: { opacity: 0.55 } },
        { type: 'bar' }
      ]
    }, colors)

    expect(option.series[0]!.lineStyle).toEqual({ opacity: 0 })
    expect(option.series[1]!.lineStyle).toEqual({ width: 1 })
    expect(option.series[2]!.areaStyle).toEqual({ opacity: 0.55 })
    expect(option.series[3]).toEqual({ type: 'bar' })
  })

  it('keeps each line’s own colour when several lines share a chart', () => {
    const option = applySeriesStyle({ series: [{ type: 'line', areaStyle: {} }, { type: 'line', areaStyle: {} }] }, colors)

    expect(option.series[0]!.areaStyle).toEqual({ opacity: 0.3 })
  })
})

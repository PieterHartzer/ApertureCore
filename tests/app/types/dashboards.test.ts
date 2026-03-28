import { describe, expect, it } from 'vitest'

import {
  createEmptyDashboardCreateInput,
  toDashboardSaveInput
} from '../../../app/types/dashboards'

describe('dashboard client types helpers', () => {
  it('creates an empty dashboard create input', () => {
    expect(createEmptyDashboardCreateInput()).toEqual({
      dashboardName: ''
    })
  })

  it('converts dashboard details into a save payload', () => {
    expect(toDashboardSaveInput({
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: [{
        id: 'widget-1',
        dashboardId: 'dashboard-1',
        title: 'Revenue',
        queryId: 'query-1',
        pluginId: 'table',
        pluginConfig: {
          visibleColumns: ['sales']
        },
        layout: {
          x: 0,
          y: 1,
          w: 6,
          h: 4,
          minW: 3,
          minH: 3
        },
        refreshIntervalSeconds: 15
      }]
    })).toEqual({
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: [{
        id: 'widget-1',
        title: 'Revenue',
        queryId: 'query-1',
        pluginId: 'table',
        pluginConfig: {
          visibleColumns: ['sales']
        },
        layout: {
          x: 0,
          y: 1,
          w: 6,
          h: 4,
          minW: 3,
          minH: 3
        },
        refreshIntervalSeconds: 15
      }]
    })
  })
})

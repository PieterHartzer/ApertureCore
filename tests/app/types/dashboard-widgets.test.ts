import { describe, expect, it } from 'vitest'

import {
  createDashboardWidget,
  createEmptyDashboardWidgetDraft,
  isDashboardWidgetPluginConfigComplete,
  normalizeDashboardWidgetPluginConfig
} from '../../../app/types/dashboard-widgets'

describe('dashboard widget helpers', () => {
  it('creates a blank widget draft', () => {
    expect(createEmptyDashboardWidgetDraft()).toEqual({
      dashboardId: 'default-dashboard',
      title: '',
      queryId: '',
      pluginId: '',
      pluginConfig: {},
      refreshIntervalSeconds: 60
    })
  })

  it('normalizes plugin config against the selected plugin schema', () => {
    const plugin = {
      inputSchema: [
        {
          key: 'xField',
          label: 'X axis field',
          type: 'string' as const
        },
        {
          key: 'yField',
          label: 'Y axis field',
          type: 'string' as const,
          required: true
        }
      ]
    }

    expect(normalizeDashboardWidgetPluginConfig(plugin, {
      xField: ' created_at ',
      yField: 'sales_total',
      ignored: 'value'
    })).toEqual({
      xField: 'created_at',
      yField: 'sales_total'
    })
  })

  it('checks whether required plugin config is complete', () => {
    const plugin = {
      inputSchema: [
        {
          key: 'valueField',
          label: 'Value field',
          type: 'string' as const,
          required: true
        },
        {
          key: 'labelField',
          label: 'Label field',
          type: 'string' as const
        }
      ]
    }

    expect(isDashboardWidgetPluginConfigComplete(plugin, {
      valueField: 'sales_total'
    })).toBe(true)

    expect(isDashboardWidgetPluginConfigComplete(plugin, {
      valueField: '   '
    })).toBe(false)
  })

  it('creates a widget from a draft and trims identifiers', () => {
    expect(createDashboardWidget({
      dashboardId: ' ',
      title: ' Revenue ',
      queryId: ' query-1 ',
      pluginId: ' stat-card ',
      pluginConfig: {
        valueField: 'total_sales'
      },
      refreshIntervalSeconds: 30
    }, () => 'widget-1')).toEqual({
      id: 'widget-1',
      dashboardId: 'default-dashboard',
      title: 'Revenue',
      queryId: 'query-1',
      pluginId: 'stat-card',
      pluginConfig: {
        valueField: 'total_sales'
      },
      refreshIntervalSeconds: 30
    })
  })
})

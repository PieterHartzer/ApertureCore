import { describe, expect, it } from 'vitest'

import {
  createDashboardWidget,
  createDashboardWidgetDraftFromWidget,
  createEmptyDashboardWidgetDraft,
  isDashboardWidgetPluginConfigComplete,
  normalizeDashboardWidgetPluginConfig,
  updateDashboardWidget
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

  it('normalizes multi-select plugin inputs into string arrays', () => {
    const plugin = {
      inputSchema: [
        {
          key: 'visibleColumns',
          label: 'Visible columns',
          type: 'string' as const,
          selectionMode: 'multiple' as const
        }
      ]
    }

    expect(normalizeDashboardWidgetPluginConfig(plugin, {
      visibleColumns: [' created_at ', '', 'sales_total', 'created_at', null]
    })).toEqual({
      visibleColumns: ['created_at', 'sales_total']
    })
  })

  it('drops invalid values for option-based plugin inputs', () => {
    const plugin = {
      inputSchema: [
        {
          key: 'aggregation',
          label: 'Aggregation',
          type: 'string' as const,
          source: 'option' as const,
          options: [
            {
              label: 'Sum',
              value: 'sum' as const
            },
            {
              label: 'Average',
              value: 'avg' as const
            }
          ]
        }
      ]
    }

    expect(normalizeDashboardWidgetPluginConfig(plugin, {
      aggregation: 'avg'
    })).toEqual({
      aggregation: 'avg'
    })

    expect(normalizeDashboardWidgetPluginConfig(plugin, {
      aggregation: 'median'
    })).toEqual({
      aggregation: null
    })
  })

  it('treats required multi-select inputs as incomplete when empty', () => {
    const plugin = {
      inputSchema: [
        {
          key: 'visibleColumns',
          label: 'Visible columns',
          type: 'string' as const,
          selectionMode: 'multiple' as const,
          required: true
        }
      ]
    }

    expect(isDashboardWidgetPluginConfigComplete(plugin, {
      visibleColumns: ['created_at']
    })).toBe(true)

    expect(isDashboardWidgetPluginConfigComplete(plugin, {
      visibleColumns: []
    })).toBe(false)
  })

  it('creates a widget from a draft and trims identifiers', () => {
    const visibleColumns = ['region', 'sales_total']

    expect(createDashboardWidget({
      dashboardId: ' ',
      title: ' Revenue ',
      queryId: ' query-1 ',
      pluginId: ' stat-card ',
      pluginConfig: {
        valueField: 'total_sales',
        visibleColumns
      },
      refreshIntervalSeconds: 30
    }, () => 'widget-1')).toEqual({
      id: 'widget-1',
      dashboardId: 'default-dashboard',
      title: 'Revenue',
      queryId: 'query-1',
      pluginId: 'stat-card',
      pluginConfig: {
        valueField: 'total_sales',
        visibleColumns: ['region', 'sales_total']
      },
      refreshIntervalSeconds: 30
    })
  })

  it('clones array-based plugin config values when creating widgets', () => {
    const visibleColumns = ['region', 'sales_total']
    const widget = createDashboardWidget({
      dashboardId: 'default-dashboard',
      title: 'Revenue',
      queryId: 'query-1',
      pluginId: 'table',
      pluginConfig: {
        visibleColumns
      },
      refreshIntervalSeconds: 60
    }, () => 'widget-2')

    expect(widget.pluginConfig.visibleColumns).toEqual(['region', 'sales_total'])
    expect(widget.pluginConfig.visibleColumns).not.toBe(visibleColumns)
  })

  it('creates an editable draft from an existing widget', () => {
    const widget = {
      id: 'widget-1',
      dashboardId: 'default-dashboard',
      title: 'Revenue',
      queryId: 'query-1',
      pluginId: 'table',
      pluginConfig: {
        visibleColumns: ['region', 'sales_total']
      },
      refreshIntervalSeconds: 30
    }

    const draft = createDashboardWidgetDraftFromWidget(widget)

    expect(draft).toEqual({
      dashboardId: 'default-dashboard',
      title: 'Revenue',
      queryId: 'query-1',
      pluginId: 'table',
      pluginConfig: {
        visibleColumns: ['region', 'sales_total']
      },
      refreshIntervalSeconds: 30
    })
    expect(draft.pluginConfig.visibleColumns).not.toBe(widget.pluginConfig.visibleColumns)
  })

  it('updates an existing widget without changing its identifier', () => {
    const widget = {
      id: 'widget-1',
      dashboardId: 'default-dashboard',
      title: 'Revenue',
      queryId: 'query-1',
      pluginId: 'table',
      pluginConfig: {
        visibleColumns: ['region']
      },
      refreshIntervalSeconds: 30
    }
    const updatedWidget = updateDashboardWidget(widget, {
      dashboardId: 'default-dashboard',
      title: ' Revenue by region ',
      queryId: ' query-2 ',
      pluginId: ' bar-chart ',
      pluginConfig: {
        xField: 'region',
        yField: 'sales_total'
      },
      refreshIntervalSeconds: 60
    })

    expect(updatedWidget).toEqual({
      id: 'widget-1',
      dashboardId: 'default-dashboard',
      title: 'Revenue by region',
      queryId: 'query-2',
      pluginId: 'bar-chart',
      pluginConfig: {
        xField: 'region',
        yField: 'sales_total'
      },
      refreshIntervalSeconds: 60
    })
  })
})

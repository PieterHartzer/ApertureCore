import { describe, expect, it } from 'vitest'

import {
  createDashboardWidget,
  createDashboardWidgetDraftFromWidget,
  createEmptyDashboardWidgetDraft,
  isDashboardWidgetPluginConfigComplete,
  normalizeDashboardWidgetLayout,
  normalizeDashboardWidgetPluginConfig,
  updateDashboardWidget,
  updateDashboardWidgetLayout
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

  it('normalizes widget layouts with sane defaults', () => {
    expect(normalizeDashboardWidgetLayout()).toEqual({
      x: undefined,
      y: undefined,
      w: 6,
      h: 4,
      minW: 3,
      minH: 3
    })

    expect(normalizeDashboardWidgetLayout({
      x: -1,
      y: 2,
      w: 1,
      h: 2,
      minW: 4,
      minH: 5,
      maxW: 3,
      maxH: 4
    })).toEqual({
      x: undefined,
      y: 2,
      w: 4,
      h: 5,
      minW: 4,
      minH: 5
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
      layout: {
        x: undefined,
        y: undefined,
        w: 6,
        h: 4,
        minW: 3,
        minH: 3
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
    expect(widget.layout).toEqual({
      x: undefined,
      y: undefined,
      w: 6,
      h: 4,
      minW: 3,
      minH: 3
    })
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
      layout: {
        x: 0,
        y: 1,
        w: 8,
        h: 5,
        minW: 3,
        minH: 3
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
      layout: {
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        minW: 3,
        minH: 3
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
      layout: {
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        minW: 3,
        minH: 3
      },
      refreshIntervalSeconds: 60
    })
  })

  it('updates widget layout independently of the edit draft', () => {
    const widget = {
      id: 'widget-1',
      dashboardId: 'default-dashboard',
      title: 'Revenue',
      queryId: 'query-1',
      pluginId: 'table',
      pluginConfig: {},
      layout: {
        w: 6,
        h: 4,
        minW: 3,
        minH: 3
      },
      refreshIntervalSeconds: 30
    }

    expect(updateDashboardWidgetLayout(widget, {
      x: 2,
      y: 3,
      w: 8,
      h: 5
    })).toEqual({
      id: 'widget-1',
      dashboardId: 'default-dashboard',
      title: 'Revenue',
      queryId: 'query-1',
      pluginId: 'table',
      pluginConfig: {},
      layout: {
        x: 2,
        y: 3,
        w: 8,
        h: 5,
        minW: 3,
        minH: 3
      },
      refreshIntervalSeconds: 30
    })
  })
})

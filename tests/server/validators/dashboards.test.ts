import { describe, expect, it } from 'vitest'

import {
  validateCreateDashboardInput,
  validateDashboardEmbedId,
  validateDashboardId,
  validateDashboardWidgetId,
  validateSaveDashboardInput
} from '../../../server/validators/dashboards'

const DASHBOARD_ID = '2f8f9425-55cf-4d8e-a446-638848de1942'
const WIDGET_ID = '7c6d9425-55cf-4d8e-a446-638848de1942'
const QUERY_ID = '1c6d9425-55cf-4d8e-a446-638848de1942'

describe('dashboard validators', () => {
  it('requires a non-empty dashboard name when creating dashboards', () => {
    expect(validateCreateDashboardInput({
      dashboardName: '   '
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'dashboard_name_required',
      message: 'dashboard_name_required',
      field: 'dashboardName'
    })
  })

  it('normalizes nested dashboard widget payloads when saving', () => {
    expect(validateSaveDashboardInput(DASHBOARD_ID, {
      dashboardName: ' Executive overview ',
      embedEnabled: true,
      widgets: [{
        id: WIDGET_ID,
        title: ' Revenue ',
        queryId: QUERY_ID,
        pluginId: 'table',
        pluginConfig: {
          visibleColumns: ['created_at', 'created_at', null, 'sales'],
          titleCase: ' yes '
        },
        layout: {
          x: 0,
          y: 1,
          w: 2,
          h: 1,
          minW: 4,
          minH: 3
        },
        refreshIntervalSeconds: 15
      }]
    })).toEqual({
      ok: true,
      data: {
        dashboardId: DASHBOARD_ID,
        dashboardName: 'Executive overview',
        embedEnabled: true,
        widgets: [{
          id: WIDGET_ID,
          title: 'Revenue',
          queryId: QUERY_ID,
          pluginId: 'table',
          pluginConfig: {
            visibleColumns: ['created_at', 'sales'],
            titleCase: 'yes'
          },
          layout: {
            x: 0,
            y: 1,
            w: 4,
            h: 3,
            minW: 4,
            minH: 3
          },
          refreshIntervalSeconds: 15
        }]
      }
    })
  })

  it('rejects invalid widget payloads when saving dashboards', () => {
    expect(validateSaveDashboardInput(DASHBOARD_ID, {
      dashboardName: 'Executive overview',
      embedEnabled: true,
      widgets: [{
        id: WIDGET_ID,
        title: 'Revenue',
        queryId: 'bad-id',
        pluginId: 'table',
        pluginConfig: {},
        layout: {
          w: 6,
          h: 4
        },
        refreshIntervalSeconds: 15
      }]
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'widget_query_id_invalid',
      message: 'widget_query_id_invalid',
      field: 'widgets'
    })
  })

  it('validates dashboard and embed identifiers', () => {
    expect(validateDashboardId(` ${DASHBOARD_ID} `)).toEqual({
      ok: true,
      data: {
        dashboardId: DASHBOARD_ID
      }
    })
    expect(validateDashboardEmbedId(` ${DASHBOARD_ID} `)).toEqual({
      ok: true,
      data: {
        embedId: DASHBOARD_ID
      }
    })
    expect(validateDashboardWidgetId(` ${WIDGET_ID} `)).toEqual({
      ok: true,
      data: {
        widgetId: WIDGET_ID
      }
    })
  })
})

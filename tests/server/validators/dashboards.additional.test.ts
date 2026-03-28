import { describe, expect, it } from 'vitest'

import {
  validateCreateDashboardInput,
  validateDashboardEmbedId,
  validateDashboardId,
  validateDashboardWidgetId,
  validateDeleteDashboardInput,
  validateSaveDashboardInput
} from '../../../server/validators/dashboards'

const DASHBOARD_ID = '2f8f9425-55cf-4d8e-a446-638848de1942'
const WIDGET_ID = '7c6d9425-55cf-4d8e-a446-638848de1942'
const SECOND_WIDGET_ID = '8c6d9425-55cf-4d8e-a446-638848de1942'
const QUERY_ID = '1c6d9425-55cf-4d8e-a446-638848de1942'

const createValidWidget = (overrides: Record<string, unknown> = {}) => ({
  id: WIDGET_ID,
  title: 'Revenue',
  queryId: QUERY_ID,
  pluginId: 'table',
  pluginConfig: {},
  layout: {
    w: 6,
    h: 4,
    minW: 3,
    minH: 3
  },
  refreshIntervalSeconds: 15,
  ...overrides
})

const createValidSaveInput = (overrides: Record<string, unknown> = {}) => ({
  dashboardName: 'Executive overview',
  embedEnabled: true,
  widgets: [createValidWidget()],
  ...overrides
})

describe('dashboard validators additional coverage', () => {
  it('rejects invalid create dashboard payload shapes', () => {
    expect(validateCreateDashboardInput(null)).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'body_invalid',
      message: 'body_invalid',
      field: 'body'
    })

    expect(validateCreateDashboardInput({
      dashboardName: 42
    })).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'dashboard_name_invalid',
      message: 'dashboard_name_invalid',
      field: 'dashboardName'
    })
  })

  it('rejects invalid dashboard, embed, and widget ids', () => {
    expect(validateDashboardId('bad-id')).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'dashboard_id_invalid',
      message: 'dashboard_id_invalid',
      field: 'dashboardId'
    })

    expect(validateDashboardEmbedId('bad-id')).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'embed_id_invalid',
      message: 'embed_id_invalid',
      field: 'embedId'
    })

    expect(validateDashboardWidgetId('bad-id')).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'widget_id_invalid',
      message: 'widget_id_invalid',
      field: 'widgetId'
    })
  })

  it.each([
    [
      'body_invalid',
      DASHBOARD_ID,
      null,
      {
        ok: false,
        code: 'invalid_input',
        issue: 'body_invalid',
        message: 'body_invalid',
        field: 'body'
      }
    ],
    [
      'dashboard_id_invalid',
      'bad-id',
      {
        confirmationName: 'Executive overview'
      },
      {
        ok: false,
        code: 'invalid_input',
        issue: 'dashboard_id_invalid',
        message: 'dashboard_id_invalid',
        field: 'dashboardId'
      }
    ],
    [
      'confirmation_name_invalid',
      DASHBOARD_ID,
      {
        confirmationName: 42
      },
      {
        ok: false,
        code: 'invalid_input',
        issue: 'confirmation_name_invalid',
        message: 'confirmation_name_invalid',
        field: 'confirmationName'
      }
    ],
    [
      'confirmation_name_required',
      DASHBOARD_ID,
      {
        confirmationName: '   '
      },
      {
        ok: false,
        code: 'invalid_input',
        issue: 'confirmation_name_required',
        message: 'confirmation_name_required',
        field: 'confirmationName'
      }
    ]
  ])(
    'rejects delete payload issue %s',
    (_issue, dashboardId, payload, expected) => {
      expect(validateDeleteDashboardInput(dashboardId, payload)).toEqual(expected)
    }
  )

  it('normalizes a valid delete payload', () => {
    expect(validateDeleteDashboardInput(DASHBOARD_ID, {
      confirmationName: '  Executive overview  '
    })).toEqual({
      ok: true,
      data: {
        dashboardId: DASHBOARD_ID,
        confirmationName: 'Executive overview'
      }
    })
  })

  it.each([
    [
      'body_invalid',
      null,
      {
        ok: false,
        code: 'invalid_input',
        issue: 'body_invalid',
        message: 'body_invalid',
        field: 'body'
      }
    ],
    [
      'dashboard_name_invalid',
      createValidSaveInput({
        dashboardName: 42
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'dashboard_name_invalid',
        message: 'dashboard_name_invalid',
        field: 'dashboardName'
      }
    ],
    [
      'dashboard_name_required',
      createValidSaveInput({
        dashboardName: '   '
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'dashboard_name_required',
        message: 'dashboard_name_required',
        field: 'dashboardName'
      }
    ],
    [
      'embed_enabled_invalid',
      createValidSaveInput({
        embedEnabled: 'yes'
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'embed_enabled_invalid',
        message: 'embed_enabled_invalid',
        field: 'embedEnabled'
      }
    ],
    [
      'widgets_invalid',
      createValidSaveInput({
        widgets: 'nope'
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'widgets_invalid',
        message: 'widgets_invalid',
        field: 'widgets'
      }
    ]
  ])('rejects save payload issue %s', (_issue, payload, expected) => {
    expect(validateSaveDashboardInput(DASHBOARD_ID, payload)).toEqual(expected)
  })

  it.each([
    [
      'widgets_invalid',
      null,
      {
        ok: false,
        code: 'invalid_input',
        issue: 'widgets_invalid',
        message: 'widgets_invalid',
        field: 'widgets'
      }
    ],
    [
      'widget_id_invalid',
      createValidWidget({
        id: 'bad-id'
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'widget_id_invalid',
        message: 'widget_id_invalid',
        field: 'widgets'
      }
    ],
    [
      'widget_title_invalid',
      createValidWidget({
        title: 42
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'widget_title_invalid',
        message: 'widget_title_invalid',
        field: 'widgets'
      }
    ],
    [
      'widget_title_required',
      createValidWidget({
        title: '   '
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'widget_title_required',
        message: 'widget_title_required',
        field: 'widgets'
      }
    ],
    [
      'widget_query_id_invalid',
      createValidWidget({
        queryId: 'bad-id'
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'widget_query_id_invalid',
        message: 'widget_query_id_invalid',
        field: 'widgets'
      }
    ],
    [
      'widget_plugin_id_invalid',
      createValidWidget({
        pluginId: 42
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'widget_plugin_id_invalid',
        message: 'widget_plugin_id_invalid',
        field: 'widgets'
      }
    ],
    [
      'widget_plugin_id_required',
      createValidWidget({
        pluginId: '   '
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'widget_plugin_id_required',
        message: 'widget_plugin_id_required',
        field: 'widgets'
      }
    ],
    [
      'widget_plugin_config_invalid',
      createValidWidget({
        pluginConfig: 'nope'
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'widget_plugin_config_invalid',
        message: 'widget_plugin_config_invalid',
        field: 'widgets'
      }
    ],
    [
      'widget_layout_invalid',
      createValidWidget({
        layout: 'nope'
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'widget_layout_invalid',
        message: 'widget_layout_invalid',
        field: 'widgets'
      }
    ],
    [
      'widget_refresh_interval_invalid',
      createValidWidget({
        refreshIntervalSeconds: 0
      }),
      {
        ok: false,
        code: 'invalid_input',
        issue: 'widget_refresh_interval_invalid',
        message: 'widget_refresh_interval_invalid',
        field: 'widgets'
      }
    ]
  ])('rejects widget issue %s', (_issue, widget, expected) => {
    expect(validateSaveDashboardInput(DASHBOARD_ID, createValidSaveInput({
      widgets: [widget]
    }))).toEqual(expected)
  })

  it('rejects duplicate widget ids when saving dashboards', () => {
    expect(validateSaveDashboardInput(DASHBOARD_ID, createValidSaveInput({
      widgets: [
        createValidWidget(),
        createValidWidget({
          id: WIDGET_ID
        })
      ]
    }))).toEqual({
      ok: false,
      code: 'invalid_input',
      issue: 'widget_id_invalid',
      message: 'widget_id_invalid',
      field: 'widgets'
    })
  })

  it('normalizes widget config values, layout bounds, and widget ids when saving', () => {
    expect(validateSaveDashboardInput(` ${DASHBOARD_ID} `, {
      dashboardName: ' Executive overview ',
      embedEnabled: false,
      widgets: [
        {
          id: ` ${WIDGET_ID} `,
          title: ' Revenue ',
          queryId: QUERY_ID,
          pluginId: ' table ',
          pluginConfig: {
            visibleColumns: ['sales', 'sales', '', null, 'region'],
            showTotals: false,
            threshold: 25,
            nestedConfig: {
              unsupported: true
            }
          },
          layout: {
            x: -1,
            y: 2,
            w: 2,
            h: 1,
            minW: 4,
            minH: 3,
            maxW: 8,
            maxH: 6
          },
          refreshIntervalSeconds: 30
        },
        {
          id: SECOND_WIDGET_ID,
          title: ' Users ',
          queryId: QUERY_ID,
          pluginId: ' stat-card ',
          pluginConfig: {},
          layout: {
            w: 6,
            h: 4
          },
          refreshIntervalSeconds: 60
        }
      ]
    })).toEqual({
      ok: true,
      data: {
        dashboardId: DASHBOARD_ID,
        dashboardName: 'Executive overview',
        embedEnabled: false,
        widgets: [
          {
            id: WIDGET_ID,
            title: 'Revenue',
            queryId: QUERY_ID,
            pluginId: 'table',
            pluginConfig: {
              visibleColumns: ['sales', 'region'],
              showTotals: false,
              threshold: 25,
              nestedConfig: null
            },
            layout: {
              x: undefined,
              y: 2,
              w: 4,
              h: 3,
              minW: 4,
              minH: 3,
              maxW: 8,
              maxH: 6
            },
            refreshIntervalSeconds: 30
          },
          {
            id: SECOND_WIDGET_ID,
            title: 'Users',
            queryId: QUERY_ID,
            pluginId: 'stat-card',
            pluginConfig: {},
            layout: {
              x: undefined,
              y: undefined,
              w: 6,
              h: 4,
              minW: 3,
              minH: 3
            },
            refreshIntervalSeconds: 60
          }
        ]
      }
    })
  })
})

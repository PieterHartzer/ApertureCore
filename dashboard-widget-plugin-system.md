# Dashboard Widget UI Plugin System

## Delivered Architecture
- `app/types/uiPlugin.ts`
  - Defines the shared plugin contract, plugin input schema, and field-type inference helpers used by the widget configuration flow.
- `app/composables/useUIPlugins.ts`
  - Holds the plugin registry and default plugin registration flow.
- `app/components/plugins/`
  - Ships the first default plugins: table, line chart, bar chart, and stat card.
- `app/composables/database/useSavedSqlQueryRun.ts`
  - Wraps `POST /api/query/run` and normalizes 200, 304, and error responses for the client.
- `app/composables/dashboard/useDashboardQueryResults.ts`
  - Caches query results by `queryId + connectionId + queryParameters`, reuses ETags, and dedupes concurrent fetches.
- `app/components/dashboard/PluginRenderer.vue`
  - Looks up the plugin definition and renders the plugin component dynamically.
- `app/components/dashboard/WidgetGrid.vue`
  - Wraps GridStack, enhances the Vue-rendered widget cards on the client, and emits normalized layout changes back into widget state.
- `app/pages/index.vue`
  - Provides the dashboard edit mode, modal widget builder flow, widget editing flow, and GridStack-backed dashboard layout UI.
- `app/types/dashboard-widgets.ts`
  - Stores widget plugin config plus shared widget layout metadata so drag/resize state can be persisted later without depending on GridStack DOM attributes.

## Current Behavior
1. The user selects a saved query.
2. The dashboard page loads its cached query result through `/api/query/run`.
3. The user selects a plugin.
4. The page reads the plugin `inputSchema` and offers compatible query fields for each plugin input.
5. Saving the widget stores `queryId`, `pluginId`, `pluginConfig`, and refresh interval in the dashboard widget model.
6. Widget cards render through `PluginRenderer` and reuse the same cached query result store as the preview flow.
7. Widgets can be edited, dragged, and resized on a GridStack layout, and the resulting layout is written back into widget state.
8. Widget controls are only shown while the dashboard is in edit mode, and chart plugins adapt their axes/margins to smaller widget sizes to avoid clipped rendering.
9. Widget creation and editing now happen in a large modal with live preview, so the main dashboard page only shows widgets unless edit mode is active.
10. Widget cards show live refresh/error status inline instead of a fixed "refresh every N seconds" label, while still falling back to full alerts when a widget cannot render at all.

## Future Extension Points
- Persist dashboard widgets server-side without changing the plugin interface.
- Add richer plugin input types beyond field mapping.
- Persist multiple dashboards and layout presets using the current widget layout model.
- Support query parameters and row-level security by extending the existing dashboard query cache key and widget config model.

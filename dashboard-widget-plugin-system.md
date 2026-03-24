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
- `app/pages/index.vue`
  - Provides the first widget builder and widget grid UI for the dashboard page.

## Current Behavior
1. The user selects a saved query.
2. The dashboard page loads its cached query result through `/api/query/run`.
3. The user selects a plugin.
4. The page reads the plugin `inputSchema` and offers compatible query fields for each plugin input.
5. Saving the widget stores `queryId`, `pluginId`, `pluginConfig`, and refresh interval in the dashboard widget model.
6. Widget cards render through `PluginRenderer` and reuse the same cached query result store as the preview flow.

## Future Extension Points
- Persist dashboard widgets server-side without changing the plugin interface.
- Add richer plugin input types beyond field mapping.
- Add dashboard layouts or drag/drop placement on top of the current widget model.
- Support query parameters and row-level security by extending the existing dashboard query cache key and widget config model.

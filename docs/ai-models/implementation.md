# AI provider and model management

## Architecture
`useAIModels` owns selection and dispatches a common `AIGenerationRequest` through an `AIInferenceProvider` registry. All providers use the existing SQL prompt and SQL extraction. The workspace still requires explicit testing and saving; generation never executes SQL. Existing server SQL validation, read-only PostgreSQL transactions, row limits and timeouts remain in place. Provision database connections with a dedicated read-only database role.

OpenAI model discovery and inference run on the authenticated Nuxt server against the fixed official endpoint. LM Studio discovery and inference run in the browser against the configured URL, so localhost means the user's computer even when Nuxt is hosted remotely. WebLLM retains the installed runtime, model catalogue, engine and browser cache APIs.

## Persistence and isolation
Migration `005_create_ai_settings` adds one PostgreSQL settings row per organization/user pair. JSON settings contain provider connections, selected models and exactly one default whenever models exist. Credentials are stored separately as AES-256-GCM authenticated ciphertext with a random nonce, using the existing server-only `APP_DATABASE_ENCRYPTION_KEY`. Raw stored keys never appear in API responses, URLs or browser storage. Every database read and update includes both authenticated identifiers; transactional row locks serialize mutations. Newly added models preserve the default. Removing the default selects the first remaining model, as stated in the confirmation dialog.

LM Studio API keys are optional and memory-only. Enter them again after navigation/reload. They are deliberately never saved server-side, since the browser must authenticate directly to the local server. No credential-retrieval endpoint exists.

## Setup
- Existing OIDC organization claims and authenticated user are required.
- Configure `APP_DATABASE_URL` and a strong `APP_DATABASE_ENCRYPTION_KEY`; retain the encryption key across restarts. Rotating it requires re-encrypting existing secrets.
- Run `pnpm db:migrate` on each deployment. Migration 005 was applied successfully to the configured development database during implementation.
- Open Settings → AI Models from the dashboard or SQL workspace.
- OpenAI keys use the official endpoint; custom server-side URLs are intentionally unsupported to avoid a credential-bearing arbitrary proxy.
- For LM Studio, start its OpenAI-compatible server, normally `http://localhost:1234/v1`, enable CORS for the application, and permit browser local-network access. Browser mixed-content policies may require a secure endpoint. Existing LM Studio models are discovered, never downloaded by this app.
- Browser models require WebGPU and a secure context. Memory requirements are GPU estimates, not transfer sizes. Exact transfer sizes are unavailable. Weights-cache checks use actual WebLLM storage, and the UI labels them as cached weights rather than guaranteeing full offline usability. Load successfully to verify usable runtime files. Site storage eviction still removes downloads.

## Limits and verification
OpenAI model discovery uses a conservative text-chat candidate filter; account access and endpoint compatibility are ultimately verified at inference. LM Studio can list embeddings alongside chat models: users are instructed to select text-chat models. Known HTTP errors, timeouts, CORS/network failures, truncated output and cancellation have actionable errors. Browser downloads have progress and cancellation without an inactivity cutoff.

No live OpenAI credentials, multi-GB downloads, or live LM Studio inference were used during automated testing. WebLLM load, inference, engine identity, cancellation, cache behavior and long idle downloads are covered with mocked engine/storage APIs. Browser visual inspection could not be completed reliably in the active shared browser session.

## Changed files
- `shared/types/ai.ts`, `shared/utils/ai-provider.ts`: shared contracts and compatible HTTP transport.
- `server/database/migrations/005_create_ai_settings.mjs`, `server/utils/app-database.ts`: existing PostgreSQL store extension.
- `server/utils/ai-secrets.ts`, `server/services/ai-settings.ts`: encryption, validation, owner isolation and atomic settings mutations.
- `server/api/ai/settings.get.ts`, `settings.post.ts`, `provider.post.ts`: authenticated settings, discovery and inference routes.
- `app/composables/useAIModels.ts`, `app/composables/useLocalSqlModel.ts`: provider dispatch and preserved browser engine lifecycle.
- `app/pages/settings/ai-models.vue`, `app/pages/sql-workspace.vue`, `app/components/dashboard/DashboardHeader.vue`: management, unified selection and navigation.
- `vitest.config.ts`: shared-module alias for tests.
- `tests/shared/ai-provider.test.ts`, `tests/server/services/ai-settings.test.ts`, `tests/server/api/ai/provider.test.ts`, `tests/app/composables/useAIModels.test.ts`, `tests/app/composables/useLocalSqlModel.test.ts`: transport, security, persistence, routing and browser lifecycle tests.

Pre-existing uncommitted changes outside this feature were preserved.

## Checks executed
- `pnpm test`: **86 files, 643 tests passed**. External provider responses and WebLLM runtime are mocked.
- `pnpm typecheck`: **passed (exit 0)**. Existing Vue Router Volar plugin resolution warning remains.
- `pnpm build`: **passed** after correcting the shared-module import. Existing font/CSS sourcemap warnings remain. The first build's font download was blocked by sandbox DNS; retry with network access resolved it.
- `pnpm db:migrate`: **passed**, migration 005 applied. The first attempt was blocked by sandbox networking.
- Focused ESLint over feature files: **passed** using a temporary configuration that enables the installed TypeScript parser and its unused-variable rule.
- Repository `pnpm lint`: **failed**, 8 errors and 5 warnings. The repository's generated ESLint configuration does not enable its TypeScript parser (affecting existing TypeScript files and the new settings page); existing dashboard duplicate-key, unused-variable and attribute-order findings also remain. No lint-rule suppression was added to the application.
- `git diff --check`: reports two pre-existing trailing spaces in `SavedSqlQueryForm.vue`, outside this feature.

## Navigation and saved-query follow-up
The create/edit saved-query form now uses `useAIModels`, including provider grouping, connection name/URL, remote data notices and session-only LM Studio keys. The existing WebLLM-only form was missed in the initial integration. Its Generate handler is now exposed to the template, and cancellation invalidates pending schema fetches and stale model results before changing the SQL editor. Generated SQL still requires an explicit test before saving.

AI settings links are present on the query list, query create/edit pages, and database connection list/create/edit pages. The new-connection page again exports its registered view-model; contextual breadcrumbs now live in that view-model rather than replacing it. Browser inspection confirmed the database form renders and the settings link opens AI Models. Authentication failures now identify expired sessions and offer sign-in recovery.

Additional changed files: `app/components/database/SavedSqlQueryForm.vue`, `app/view-models/components/database/SavedSqlQueryForm.ts`, `app/view-models/pages/connections/new.ts`, the query/connection pages above, `i18n/locales/en.json`, and tests under `tests/app/view-models/`. Vitest also resolves the existing `~` application alias for these regression tests.

Follow-up checks: 88 test files / 650 tests passed, typecheck passed with the existing Volar warning, and focused type-aware ESLint passed.

LM Studio diagnostic: `GET http://localhost:1234/v1/models` with Origin `http://localhost:3300` returned HTTP 200 and available models, but no `Access-Control-Allow-Origin`. This identifies a CORS configuration issue rather than a stopped server or missing downloads. Enable CORS in LM Studio Developer → Server Settings, then refresh available models. No security settings were changed automatically.

Follow-up `pnpm build`: passed. Feature-file whitespace checks also passed.

## Provider-specific prompt budget fix
The shared SQL prompt previously rejected every provider above 12,000 input characters, so a large LM Studio schema never reached its chat endpoint and could not trigger model loading. The prompt builder now validates content without imposing a universal context estimate. Only `useLocalSqlModel`, whose engine explicitly loads with an 8192-token context, opts into the conservative browser character budget. LM Studio and OpenAI receive the complete schema and enforce their own model context limits. No schema truncation, provider prompt changes or model downloads were introduced.

Regression tests cover a 58,000-character schema through LM Studio dispatch and both client/server OpenAI paths, the browser budget boundary, and rejection before browser inference. Full suite: 88 files, 655 tests passed.

## Schema endpoint authentication recovery
A schema HTTP 401 means the application login is expired or invalid, before any AI request. Both SQL entry points now show a sign-in recovery action in a new tab, retaining the question and edited SQL in the original tab. A successful retry clears the expired-session indicator; no schema or AI call bypasses authentication. Regression coverage verifies that a failed schema request never reaches inference and that the draft survives reauthentication and retry.

The local `.env.development` lacked the three OIDC session/token secrets. Missing values were generated securely and saved only in that ignored file with owner-only permissions; values were not printed or committed. Existing configured values were retained. Development-only Nitro OIDC storage now persists encrypted refresh-token records under the ignored `.data/oidc-sessions` directory so dev runtime restarts do not discard the backing session. An existing login must be renewed after the new configuration takes effect. Production OIDC storage remains deployment-specific.

Validation: 656 tests passed, typecheck passed (existing Volar tooling warning), focused type-aware lint passed.

## SQL dialect and declared column types
Schema discovery now returns the SQL adapter's explicit `databaseType` alongside the schema. Both SQL entry points retain that metadata and include it in the common generation request. WebLLM, LM Studio and the server-side OpenAI route all use it to construct the same dialect-specific prompt. Missing dialect metadata stops generation rather than inferring it from model/provider names. The current schema discovery adapter is PostgreSQL; prompt definitions for T-SQL/MySQL/SQLite are separate from connection-adapter support and do not enable those connections.

Prompts now insist on declared column types rather than names. PostgreSQL instructions explicitly require converting text/varchar dates to timestamp before DATE_TRUNC, handle blank strings with NULLIF/BTRIM, and prohibit inventing unknown date format masks. Generated SQL still requires an explicit test. These instructions cannot establish the actual format of text date values; nonstandard formats need supplied context or a manual conversion. Existing SQL in the editor is not rewritten automatically.

Validation: 88 test files / 661 tests passed; typecheck and focused type-aware lint passed. Tests verify dialect metadata in schema responses, schema-to-generation wiring, dialect-specific LM Studio prompts, forwarding to OpenAI and browser inference, and PostgreSQL text-date conversion instructions. No live database records or credentials were sent to an AI provider during these tests.

## Shared top menu and interface localization
`AppNavigation` is mounted once in the application shell on private application routes. It replaces page breadcrumbs and repeated header navigation with Dashboard, Connections, SQL queries, SQL workspace and AI models links, plus the language selector. Active sections include nested create/edit routes. The bar stays in document flow when sticky, has visible keyboard focus and `aria-current`, and scrolls horizontally on narrow screens. Public login and embedded dashboards keep their dedicated layouts.

All authored static Vue labels, descriptions, placeholders, accessibility labels, confirmations and display text now use locale keys. Runtime API/engine feedback is localized at presentation boundaries through `localizeAppMessage`, preserving existing error contracts; parameterized counts, memory labels and error details retain their data. User model/connection names, SQL, database identifiers and native provider/database diagnostics remain data, rather than translation keys. WebLLM exposes a translatable progress stage and numeric progress instead of third-party English status prose. Notifications also translate application feedback and fallback titles.

The pseudo locale now covers every English catalog key. Regression tests compile all interface messages in both locales, audit all Vue templates for untranslated static text/labels and missing literal keys, check nested-route activation, and verify translated runtime feedback while preserving model/database data. New files include `app/components/ui/AppNavigation.vue`, `app/utils/navigation.ts`, `app/utils/localized-message.ts`, `shared/i18n/message-keys.ts` and `tests/app/navigation-i18n.test.ts`; both locale catalogs and affected templates were updated.

Navigation/localization validation: 89 test files, 675 tests passed; typecheck, production build, focused type-aware lint and whitespace checks passed. Catalog coverage and message compilation were checked for both English and pseudo locales.

### Query editing in the SQL workspace

- Query-list New and Edit actions use `/sql-workspace`; `queryId` selects an existing query. Previous query editor URLs redirect to the workspace.
- Existing queries load their saved database connection, name and SQL. Saving uses PUT for edits and POST for new queries, then switches new queries to their saved identity.
- Saving requires a successful test of the current SQL and connection. Failed query loads show a retry action and cannot be saved as new queries.
- Added English and pseudo-locale messages. Validation: 675 tests, Nuxt typecheck, focused ESLint, and whitespace checks.

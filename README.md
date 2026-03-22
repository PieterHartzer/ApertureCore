# ApertureCore

ApertureCore is a dashboard application for surfacing stats, KPI cards, and
other analytical views from the user's database.

The product direction includes text-to-SQL AI models that translate normal
language requests into SQL so users can explore their data without writing
queries directly.

ApertureCore will also support a view-only dashboard mode so customers can
embed curated dashboards inside their own applications without exposing editing
or authoring capabilities.

The frontend is built with Nuxt. Look at the
[Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to
learn more.

## Testing

Run the current test suite with:

```bash
pnpm test
```

Use watch mode while developing:

```bash
pnpm test:watch
```

Run the suite with coverage enabled:

```bash
pnpm test:coverage
```

Coverage output is written to `coverage/`, including the HTML report at
`coverage/index.html`.

## Quality Checks

Run the full local quality gate with:

```bash
pnpm quality
```

The same checks run in GitHub Actions on pull requests and pushes to `main`.

This runs:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:coverage`
- `pnpm build`

You can also run each step individually:

```bash
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
```

## Database Migrations

The app now has its own persistence database for multitenant application data,
separate from the OIDC/Zitadel database.

Run migrations with:

```bash
pnpm db:migrate
```

Required environment variables:

```dotenv
APP_DATABASE_URL=postgres://user:password@host:5432/database
APP_DATABASE_ENCRYPTION_KEY=change-me-to-a-long-random-secret
```

Saved external database credentials are encrypted at rest with
`APP_DATABASE_ENCRYPTION_KEY`. Tenant isolation is enforced on the server using
the authenticated organisation claim from Zitadel, so the API never trusts an
`organizationId` from the browser.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3300`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

This repo does not use `http://localhost:3000` by default. The default local
Nuxt URL is `http://localhost:3300`.

## OIDC Configuration

This application is OpenID Connect provider agnostic. Any provider that supports
the standard authorization code flow with PKCE should work.

For non-Docker development, create a local `.env.development` file and fill in the values
for your provider. You can start from [`.env.example`](/Users/pieterhartzer/Source/AutoDash/.env.example).

If your app runs in a container and your provider does not expose a discovery
document and JWKS URL that are reachable from inside that container, set these
as well:

```dotenv
NUXT_OIDC_PROVIDERS_OIDC_ISSUER=https://your-provider.example.com
NUXT_OIDC_PROVIDERS_OIDC_JWKS_URI=https://your-provider.example.com/path/to/jwks
```

## Docker Workflows

This repo now has two separate compose entry points:

- [`docker-compose.dev.yml`](/Users/pieterhartzer/Source/AutoDash/docker-compose.dev.yml): local development stack with the app, a stable edge proxy, a dev-only OIDC provider, the app persistence database, Postgres for Zitadel, Mailpit, and the internal OIDC proxy.
- [`docker-compose.yml`](/Users/pieterhartzer/Source/AutoDash/docker-compose.yml): app-only containerized run for production-style testing.

They use separate compose project names, so they are clearly isolated from each other.

### Dev Stack With Local Debug Failover

Start the full dev stack with:

```bash
docker compose -f docker-compose.dev.yml up -d --force-recreate --remove-orphans
```

This dev stack exposes:

- Stable browser URL: `http://localhost:3300`
- Local VS Code debug upstream: `http://localhost:3002`
- Dockerized Nuxt fallback upstream: internal only on `app:3003`
- App persistence Postgres: `localhost:55432`
- Zitadel dev console: `http://localhost:18080`
- Mailpit web UI: `http://localhost:8025`
- Mailpit API: `http://localhost:8025/api/v1/messages`

The browser should always use `http://localhost:3300`.

- If no local debug app is running, the edge proxy serves the Dockerized Nuxt app.
- If you launch Nuxt locally from VS Code on port `3002`, the same proxy switches to that local process automatically.
- When you stop the local debug session, the proxy falls back to the Docker app again.

The included VS Code launch profiles are configured for this:

- `Nuxt: local dev server`
- `Nuxt: browser via proxy`
- `Nuxt: full stack via proxy`

Those profiles run the local Nuxt server on `3002` while keeping the public app URL on `http://localhost:3300`, so OIDC callbacks still return through the stable proxy URL.

Source changes are picked up by the Dockerized dev app because the project is bind-mounted into the container and the app runs with `nuxt dev`. This is live reload/HMR, not a full container restart on every file change.

The Zitadel Postgres data persists in `./.data/oidc-db` by default, so your local provider setup survives normal `docker compose` restarts and recreates.
The app persistence database state persists in `./.data/app-db`, and the app
container runs `pnpm db:migrate` automatically before `pnpm dev`.

### Database Connection Testing Network

The containerized dev app is attached to an external Docker network named
`shared-db` in addition to its default compose network. This is used for
testing database connections from the app to other Postgres containers.

Create the shared network once if it does not already exist:

```bash
docker network create shared-db
```

Attach any external Postgres container you want to test against to that same
network, then connect to it from the app using the container name or a network
alias.

Example:

```bash
docker network connect shared-db CentralDb-PG-1
```

In our current local setup, the external Postgres container is attached to
`shared-db` with the alias `centraldb-pg`, so the app can reach it at
`centraldb-pg:5432` once that container is running.

Use these host rules when testing connections:

- From the browser URL `http://localhost:3300`, requests are usually handled by the Dockerized app, so `localhost` means the app container, not your Mac.
- For databases running in Docker on the `shared-db` network, use the service or container hostname such as `oidc-db` or `centraldb-pg`.
- For databases published on your host machine, use `host.docker.internal` from the containerized app.
- Only use `localhost` when the Nuxt server itself is running directly on the host, for example via the VS Code/F5 flow on `http://localhost:3002`.

If you are switching from an older local dev-provider setup and the auth routes still behave strangely, reset the local dev-provider data and start again:

```bash
docker compose --env-file .env.development -f docker-compose.dev.yml down --remove-orphans
rm -rf .data/oidc-db
docker compose --env-file .env.development -f docker-compose.dev.yml up -d --force-recreate --remove-orphans
```

### App-Only Compose

The default [`docker-compose.yml`](/Users/pieterhartzer/Source/AutoDash/docker-compose.yml) only starts the app itself. It is useful for a containerized app-only run without the bundled dev provider, database, mail catcher, or helper proxies.

Start it with:

```bash
docker compose up -d --build
```

By default that serves the app on `http://localhost:3300`.

If you use OIDC with this app-only compose flow, make sure your provider callback and logout URLs match the public app URL for that run. The app derives its callback URL from `NUXT_PUBLIC_APP_URL`, so set that explicitly if you are not using the default `http://localhost:3300`.

If you want saved database connections to work in this app-only flow, provide:

```dotenv
APP_DATABASE_URL=postgres://user:password@host:5432/database
APP_DATABASE_ENCRYPTION_KEY=change-me-to-a-long-random-secret
```

Run `pnpm db:migrate` against that database before starting the app.

### Mailpit

The bundled Mailpit instance is a local email catcher for development. The included dev-provider setup sends its emails there instead of trying to deliver them externally. Use it to inspect verification, password reset, and account setup emails without sending anything to real inboxes.

Useful local Mailpit links:

- Web UI: `http://localhost:8025`
- API: `http://localhost:8025/api/v1/messages`
- Docs: `https://mailpit.axllent.org/docs/`

If you already have an existing persisted local Zitadel instance, those default mail settings may already be stored in the database from an earlier startup. In that case, either update the SMTP settings in the Zitadel console or recreate the local dev database directory with:

```bash
docker compose --env-file .env.development -f docker-compose.dev.yml down --remove-orphans
rm -rf .data/oidc-db
docker compose --env-file .env.development -f docker-compose.dev.yml up -d --force-recreate --remove-orphans
```

### Optional Local Dev Provider Setup

The included dev compose setup uses Zitadel as a local dev-only OIDC provider. It does not auto-provision the OIDC app, so you need to create it once.

1. Start the stack with `docker compose --env-file .env.development -f docker-compose.dev.yml up -d --force-recreate --remove-orphans`.
2. Open the Zitadel console at:

```text
http://localhost:18080/ui/console?login_hint=root@zitadel.localhost
```

3. Sign in with the first-instance admin credentials:
   - Email / login name: `root@zitadel.localhost`
   - Password: `RootPassword1!`

   The compose default first-instance username is `root`, but the login
   identifier used at sign-in is the email-style value shown in the
   `login_hint`.

   This is only the initial admin account used to configure the local dev
   provider. It is not the user your app signs in as.

   These defaults come from [`docker-compose.dev.yml`](/Users/pieterhartzer/Source/AutoDash/docker-compose.dev.yml). You can override them with:
   - `OIDC_DEV_ADMIN_USERNAME`
   - `OIDC_DEV_ADMIN_PASSWORD`

   If you override `OIDC_DEV_ADMIN_USERNAME`, use that value as the local-part
   of the sign-in email, for example `alice@zitadel.localhost`.

4. In Zitadel, open the instance default settings and set the Default Redirect
   URI to:

```text
http://localhost:3300/login
```

   This matters for flows that do not have an active app auth request, such as
   account initialization, verification, and password reset links from email.
   Without it, Zitadel can send the browser back to the management console
   instead of your app.

5. In Zitadel, create a project for this app if you do not already have one.
6. Under that project, create an OIDC application for the Nuxt frontend:
   - Application type: `User Agent`
     This is Zitadel's browser/public client type. Other providers use
     equivalent public-client or SPA settings.
   - During initial app creation, choose `PKCE` as the auth method.
   - Add these URLs:
     - Redirect URI: `http://localhost:3300/auth/oidc/callback`
     - Post logout redirect URI: `http://localhost:3300/`
   - If Zitadel warns about plain `http://` localhost URLs, enable its
     development/debug allowance for HTTP so those local URLs can be saved.
   - After the URLs are in place, switch the app settings to:
     - Auth method: `none`
     - Response type: `code`
     - Grant types: `authorization_code`, `refresh_token`
7. Copy the generated client ID.
8. Put that value in a local `.env.development` file:

```dotenv
NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID=your-oidc-client-id
```

9. Restart the Nuxt container so it picks up the new client ID:

```bash
docker compose --env-file .env.development -f docker-compose.dev.yml restart app
```

At runtime, users are authenticated by whichever OIDC provider you configure and
then redirected back to Nuxt through `nuxt-oidc-auth`. The bundled Zitadel stack
is only one local development option.

### Optional Overrides

You can override these dev compose defaults with environment variables before starting Docker Compose:

- `DEV_PROXY_HOST_PORT` default: `3300`
- `OIDC_DEV_PROVIDER_HOST_PORT` default: `18080`
- `OIDC_DEV_DB_NAME` default: `oidc_dev`
- `OIDC_DEV_DB_USER` default: `postgres`
- `OIDC_DEV_DB_PASSWORD` default: `YourPassword!`
- `OIDC_DEV_DB_DATA_DIR` default: `./.data/oidc-db`
- `OIDC_DEV_PROVIDER_MASTERKEY` default: `MasterkeyNeedsToHave32Characters`
- `OIDC_DEV_ADMIN_USERNAME` default: `root`
- `OIDC_DEV_ADMIN_PASSWORD` default: `RootPassword1!`
- `OIDC_DEV_MAIL_UI_HOST_PORT` default: `8025`
- `OIDC_DEV_MAIL_MAX_MESSAGES` default: `5000`
- `OIDC_DEV_MAIL_FROM` default: `no-reply@localhost`
- `OIDC_DEV_MAIL_FROM_NAME` default: `ApertureCore Dev`
- `OIDC_DEV_MAIL_REPLY_TO` default: `no-reply@localhost`
- `NUXT_HOST_PORT` default in app-only compose: `3300`
- `NUXT_PUBLIC_APP_URL` default in app-only compose: `http://localhost:3300`

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## License

This project is licensed under the GNU Affero General Public License v3.0 only
(`AGPL-3.0-only`). See the [LICENSE](LICENSE) file for the full text.

If you deploy a modified version of this application for users over a network,
make the corresponding source available as required by AGPL-3.0
section 13.

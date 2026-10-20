# Installation and local development

[Documentation home](README.md) · [Architecture](ARCHITECTURE.md) · [Deployment](DEPLOYMENT.md) · [User guide](USER_GUIDE.md)

Commands in this guide run in **PowerShell from the repository root**, unless another directory is named. Environment values shown are placeholders. Never paste a real connection string, token, password or OAuth response into documentation or terminal output retained as evidence.

## Prerequisites

1. Install Git, Node.js **24 LTS**, pnpm **11.8.0**, and PostgreSQL **18**. Install PostgreSQL client tools (`psql`, `createdb`, `pg_dump`, `pg_restore`) and add their `bin` directory to your terminal PATH. PostgreSQL 18 tools are required by the restore verification runner. Node's root engine says `>=24`; a later major is not an independently verified supported baseline.
2. Use your normal approved package-manager installation method to obtain pnpm 11.8.0. The repository pins it in `packageManager`; do not substitute npm/yarn for workspace dependency installation or create another lockfile.
3. Have a PostgreSQL login allowed to create your **new** application database. The test setup additionally requires a local login with `CREATEDB` connecting to the administrative `postgres` database; the script creates a separate random test database and never resets `postgres`.
4. For providers, obtain the relevant developer-app access only when you intend to use them. Provider credentials are optional for local campaign/file workflows. SMTP is optional in development. A PDF font with required glyphs is needed for reliable report rendering.

Verify tools:

```powershell
git --version
node --version
pnpm --version
psql --version
```

Expected majors: Node 24, pnpm 11.8.0, PostgreSQL client 18. The executable selected by PATH matters; open a new terminal after installing/changing Node.

## Clone and configure

For a fresh checkout:

```powershell
git clone https://github.com/tolukusan/social-media-dashboard.git
Set-Location social-media-dashboard
git switch main
git pull --ff-only origin main
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

For an existing checkout, inspect `git status --short` first. Do not overwrite existing ignored environment files with these copy commands. Preserve local work and use a separate branch for changes. Do not copy the root example into multiple services indiscriminately: the API scripts load the API package's `.env`; Next.js loads `apps/web/.env.local`.

### API core variables

Edit `apps/api/.env` privately:

| Variable                                  | Requirement / value                                                                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                            | Required for API, migration, generation configuration and seed. `postgresql://<user>:<url-encoded-password>@localhost:5432/marketwise?schema=social_media_dashboard`                           |
| `APP_ORIGIN`                              | Required operational configuration: `http://localhost:3000` locally; exact HTTPS web origin in production. Used by CORS, unsafe-request Origin checks and return links.                        |
| `NODE_ENV`                                | `development` locally; **`production` on both deployed services**. Changes cookie security, recovery delivery and seed policy. Tests set `test`.                                               |
| `API_PORT`                                | Optional local port; default 4000. Platform `PORT` takes priority in production.                                                                                                               |
| `REPORTING_TIMEZONE`                      | Set explicitly, normally `Africa/Lagos` for this installation. Account/integration defaults are Lagos; campaign default-period logic falls back to UTC if unset.                               |
| `SESSION_COOKIE_NAME`                     | Optional; defaults to `smd_session`. Keep stable across an installation.                                                                                                                       |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | A pair required to create the first Administrator. Configure privately only for bootstrap. Development seed can update the configured existing user; production skips existing Administrators. |
| `INTEGRATIONS_SCHEDULER_ENABLED`          | Set `false` for local work with no provider collection; set `true` for active provider jobs. False also prevents manually enqueued Meta jobs from running.                                     |
| `REPORT_FONT_PATH`                        | Optional absolute server path to a readable font supporting your required characters. PDF code searches DejaVu Sans/Windows Arial when absent.                                                 |

`SESSION_TTL_DAYS` appears in the root example but is not consumed by current source; sessions are seven days. `REPORTING_CURRENCY` is legacy/ignored; an Administrator selects currency in Settings. Do not treat every example variable as an implemented setting. Duplicate provider entries in the API example should have one consistent value in your private file.

### Web variables

| Variable                        | Local / deployed use                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`           | Local `http://localhost:4000/api/v1`; Render **`/api/v1`**. Public value; never put a credential here.                                                                                         |
| `SMD_API_ORIGIN`                | Production-only required server configuration: `https://smmd-api.onrender.com` or your actual API origin, with no path/query/credentials. Required when web is built, then rebuild if changed. |
| `NODE_ENV`                      | `production` on the deployed web service; Next.js dev command uses development mode.                                                                                                           |
| `SMD_NEXT_DIST_DIR`             | Optional local verification output directory, e.g. `.next-doc-check`, to avoid overwriting a running dev server's build.                                                                       |
| `SMD_E2E_ALLOW_HTTP_API_ORIGIN` | Isolated E2E runner only. Never set it on Render.                                                                                                                                              |

### Connected-account OAuth variables

All belong on the API server, not in `NEXT_PUBLIC_*` or browser storage configuration.

| Group                 | Variables                                                                                                  | Required when                                                                                                                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared Accounts setup | `INTEGRATION_OAUTH_REDIRECT_URI`, `INTEGRATION_TOKEN_ENCRYPTION_KEY`                                       | Connecting any account. Local callback is `http://localhost:4000/api/v1/accounts/oauth/callback` if provider accepts it; otherwise use the approved HTTPS tunnel flow. Render uses the web callback in [DEPLOYMENT](DEPLOYMENT.md). Key must decode to 32 bytes of base64. |
| Facebook/Instagram    | `INTEGRATION_META_APP_ID`, `INTEGRATION_META_APP_SECRET`, `INTEGRATION_META_API_VERSION`                   | Meta Accounts. Version must have form `v<number>.<number>` and be supported by the provider.                                                                                                                                                                               |
| LinkedIn              | `INTEGRATION_LINKEDIN_CLIENT_ID`, `INTEGRATION_LINKEDIN_CLIENT_SECRET`, `INTEGRATION_LINKEDIN_API_VERSION` | LinkedIn Accounts. Version is a provider-supported six-digit `YYYYMM`, not an invented current month.                                                                                                                                                                      |
| YouTube               | `INTEGRATION_GOOGLE_CLIENT_ID`, `INTEGRATION_GOOGLE_CLIENT_SECRET`                                         | YouTube Accounts, with both Data and Analytics APIs enabled.                                                                                                                                                                                                               |
| Zoho                  | `INTEGRATION_ZOHO_CLIENT_ID`, `INTEGRATION_ZOHO_CLIENT_SECRET`, `INTEGRATION_ZOHO_REGION`                  | Zoho Accounts. Supported region codes: `US`, `EU`, `IN`, `AU`, `JP`, `CN`; choose the actual account region.                                                                                                                                                               |

Generate a **new** independent key for a fresh installation with a trusted tool such as `openssl rand -base64 32`, and transfer it privately into configuration. Preserve existing keys during restore/migration; generating a replacement makes saved credentials unreadable. [Provider setup and migration](../docs/guides/provider-setup-and-migration.md) gives console steps and prerequisites. Configuration readiness does not establish scope approval or successful synchronization.

### Campaign integration variables

These configure the separate **Accounts → Connections** workflow:

- Environment-token mode uses a server variable named by `credentialReference` (pattern `INTEGRATION_*_ACCESS_TOKEN`), such as `INTEGRATION_META_ACCESS_TOKEN`, `INTEGRATION_LINKEDIN_ACCESS_TOKEN`, or `INTEGRATION_ZOHO_ACCESS_TOKEN`. The UI/API stores the reference, never asks for the raw token as a mapping field. Applicable Meta/LinkedIn API-version settings are still required.
- Campaign OAuth uses **`INTEGRATION_OAUTH_ENCRYPTION_KEY`**, a separate stable 32-byte base64 key, plus `INTEGRATION_OAUTH_API_ORIGIN` and comma-separated `INTEGRATION_OAUTH_ALLOWED_CALLBACK_ORIGINS`. Locally use the actual API callback origin; on Render both refer to the public web origin despite the legacy variable name.
- Campaign OAuth client pairs are `INTEGRATION_META_OAUTH_CLIENT_ID` / `INTEGRATION_META_OAUTH_CLIENT_SECRET`, `INTEGRATION_LINKEDIN_OAUTH_CLIENT_ID` / `INTEGRATION_LINKEDIN_OAUTH_CLIENT_SECRET`, `INTEGRATION_GOOGLE_OAUTH_CLIENT_ID` / `INTEGRATION_GOOGLE_OAUTH_CLIENT_SECRET`, and `INTEGRATION_ZOHO_OAUTH_CLIENT_ID` / `INTEGRATION_ZOHO_OAUTH_CLIENT_SECRET`.
- Provider-family callbacks are `/api/v1/integrations/oauth/{meta|linkedin|google|zoho}/callback`. These variables do not substitute for Accounts client variables. See [API](API.md#external-integrations).

### Recovery email and tests

`SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_SECURE` (`true` for implicit TLS), `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` configure Nodemailer in non-development delivery environments. Configure sender/auth according to your SMTP provider. In `development`, recovery links appear in the API terminal and SMTP is not used. Treat those links as secrets. In `test`, delivery is captured silently. Render Free blocks normal SMTP ports; see [DEPLOYMENT](DEPLOYMENT.md).

`TEST_DATABASE_URL` is a test-runner control. Do not set it on deployed services; it disables provider workers. Keep generated `.test-database` and `.e2e-credentials` ignored and private.

## Create the database, install and seed

For a **fresh local installation**, create a new empty database. This command prompts for the PostgreSQL login password; it does not place it in the command:

```powershell
createdb -h localhost -U postgres -W marketwise
```

Expected: success with no error. If `marketwise` exists, inspect it and use a reviewed restore/existing-installation path; do not drop or reset it. Set the API `DATABASE_URL` to this intended database. Preserve existing data and encryption keys when moving an installation.

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @smd/api exec prisma migrate status
pnpm --filter @smd/api exec prisma migrate deploy
pnpm --filter @smd/api exec prisma migrate status
pnpm db:seed
```

Expected: Prisma client generated in `apps/api/src/generated/prisma`, committed migrations applied, final status up to date, fixed catalogue/roles/metrics seeded and first admin created when the private pair is configured. Review the displayed non-secret database target before applying migrations. Prisma config supplies `social_media_dashboard` if omitted and rejects an explicit conflicting schema. It does not relocate existing `public` data. Do not edit historical migration SQL/checksums.

`pnpm db:migrate` runs `prisma migrate dev`, intended for authoring reviewed schema changes with a shadow database. It is not the production install command. If it requests a reset, stop and inspect drift; never accept a reset for a database containing user data.

## Start and use development

```powershell
pnpm dev
```

Leave this terminal open. The API uses `tsx watch`; Next.js serves the web app. Open `http://localhost:4000/api/v1/health` and expect JSON with `status: "ok"`. Open `http://localhost:3000` and sign in with your privately seeded admin. Health alone does not read the database; sign-in and a protected campaign read provide that check. Stop servers with Ctrl+C.

After an active Admin/Marketing Officer exists, optional **local/demo-only** data can be prepared with `pnpm --filter @smd/api demo:prepare`. It refreshes a reserved demonstration campaign and September 2026 data. Do not run it against production or user data merely to obtain screenshots.

## Isolated test database and commands

Unit tests do not require production providers. Database-backed tests must use the runner's dedicated loopback `smd_test_<random>` database. [Developer guide](../docs/guides/developer-guide.md#isolated-tests) explains the isolation guards.

1. Use PostgreSQL 18 locally and an administrative connection to **`/postgres`** with `CREATEDB`, solely to create the separate test database. The preparation script refuses remote hosts or another admin database. It creates a random database and schema and retains its private URL in ignored `apps/api/.test-database`.
2. If the normal API `.env` points to `/marketwise`, supply the local `/postgres` administrative URL only for the preparation process. From the root, this PowerShell sequence masks input and restores the previous shell setting even if preparation fails:

```powershell
$previousDatabaseUrl = $env:DATABASE_URL
$testAdminInput = Read-Host 'Local PostgreSQL admin URL ending in /postgres' -AsSecureString
try {
    $env:DATABASE_URL = [System.Net.NetworkCredential]::new('', $testAdminInput).Password
    pnpm test:db:prepare
} finally {
    $env:DATABASE_URL = $previousDatabaseUrl
    $testAdminInput.Dispose()
    Remove-Variable testAdminInput, previousDatabaseUrl
}
```

Enter a local URL such as `postgresql://<admin-user>:<encoded-password>@localhost:5432/postgres` at the masked prompt. Do not print it or copy it into a tracked script. This step only authorises creation of the separate test target; it is not an instruction to migrate, seed or reset the administrative database.

3. After preparation succeeds, run from the root:

```powershell
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

If metadata already exists, preparation validates and reuses it; it does not clean/reset it. Integration runner loads that verified target, deploys migrations and seed there. E2E requires ports **4201** and **3101** free, prepares random test users, builds a separate web output, starts temporary API/web processes, and stops those processes afterward. Never bypass target guards to use a production or development database.

Other checks, from root:

| Command                               | Purpose / prerequisites                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm lint`                           | Prettier-based formatting checks for application source                            |
| `pnpm typecheck`                      | Workspace TypeScript checks                                                        |
| `pnpm test`                           | Alias for API unit tests, not integration/E2E                                      |
| `pnpm build`                          | Recursive shared/API/web build; do not run into a live dev `.next` directory       |
| `pnpm format:docs`                    | Maintained documentation formatting, including this folder                         |
| `pnpm --filter @smd/api test:restore` | Isolated PostgreSQL 18 backup/restore verification; matching client tools required |
| `pnpm --filter @smd/api test:load`    | Isolated k6 workload; k6 and test database prerequisites required                  |

For a build while dev remains running, set `$env:SMD_NEXT_DIST_DIR='.next-check'`, run `pnpm build`, then `Remove-Item Env:SMD_NEXT_DIST_DIR`. Do not add the output directory to Git. A production web build needs `SMD_API_ORIGIN` and the deployed browser URL setting; use the isolated E2E runner for local HTTP production-proxy testing. This documentation-only change requires formatting/link/diagram checks, not unrelated application suites.

## PowerShell and Linux/macOS differences

PowerShell uses `Set-Location`, `Copy-Item`, `$env:NAME='value'`, and `Remove-Item Env:NAME`; Bash uses `cd`, `cp`, `export NAME='value'`, and `unset NAME`. Single-command `NAME=value pnpm ...` is Bash syntax, not PowerShell. Render command fields run on Linux, so their documented `&&` and `$PORT` syntax belongs there. Avoid pasting credential URLs into shell history on either platform. A Prisma URL's `?schema=` parameter is not a libpq/`pg_dump` parameter; use the backup procedure in [DEPLOYMENT](DEPLOYMENT.md#backup-and-restore).

## Troubleshooting

| Symptom                          | Check / safe next step                                                                                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unsupported engine or wrong Node | Run `node --version` in this terminal and select Node 24 before installing/building.                                                                                                                                    |
| Prisma cannot connect            | Verify PostgreSQL running, host/port/database and encoded credentials privately; confirm API package `.env`, not just root `.env`.                                                                                      |
| Migration P3018 / schema 3F000   | Inspect the migration and target schema. Use [fresh Render recovery](../docs/evidence/render-fresh-migration-recovery.md) only for its exact failed-first-installation case. Never reset or blindly resolve migrations. |
| Migration drift/reset prompt     | Cancel. Compare committed SQL and migration journal; plan a non-destructive repair.                                                                                                                                     |
| Login fails                      | Verify admin seed pair and active account; public registration requires approval. Production seed does not reset an existing admin.                                                                                     |
| Write returns 403                | Check exact `APP_ORIGIN`, browser Origin, fresh CSRF cookie/header and role; do not disable guards.                                                                                                                     |
| Meta job stays queued            | Set scheduler true, remove accidental test URL setting, keep API awake, and confirm job tables migrated.                                                                                                                |
| Blank provider report            | Inspect selected dates, account/organisation, coverage, provider errors and API history; for Zoho inspect campaign send dates.                                                                                          |
| PDF glyphs missing               | Provision a readable font covering required characters and set `REPORT_FONT_PATH`.                                                                                                                                      |
| Test preparation refuses URL     | Use the required local administrative source for preparation; runners alone choose the isolated test database. Do not weaken the checks.                                                                                |

Detailed local maintenance and cleanup procedures remain in [local operations](../docs/guides/local-operations.md).

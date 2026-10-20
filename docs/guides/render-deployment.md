# Deploy Marketwise to Render

Updated 20 October 2026. This guide prepares the current monorepo for two Render Node Web Services and one PostgreSQL 18 database. It does not mean that a Render service has been created or deployed.

## 1. What you will create

| Render resource | Name            | Region    | Plan | Purpose                                      |
| --------------- | --------------- | --------- | ---- | -------------------------------------------- |
| PostgreSQL      | `smmd-postgres` | Frankfurt | Free | Application data in `social_media_dashboard` |
| Web Service     | `smmd-api`      | Frankfurt | Free | NestJS API and committed Prisma migrations   |
| Web Service     | `smmd-web`      | Frankfurt | Free | Next.js website and same-origin API proxy    |

All three resources must use the same region. The browser will call the web origin for `/api/v1/...`; the Next.js server forwards those requests to the API origin. This keeps session cookies on the website's origin while retaining the existing CSRF, Origin, CORS, `HttpOnly`, `SameSite=Lax`, and production `Secure` protections. Do not change the browser API URL to the API service hostname.

Render terminates public TLS and supplies the API's `PORT`. The API binds to `0.0.0.0`. `PORT` takes priority; `API_PORT=4000` remains the local fallback. Production Next.js builds require `SMD_API_ORIGIN`, which must be the API's HTTPS origin without `/api/v1`.

## 2. Before opening Render

1. Confirm you can access the GitHub repository `tolukusan/social-media-dashboard`.
2. Use the `staging` branch. This task leaves `main` unchanged.
3. Decide whether this is a **fresh database** or a **restore of an existing database**. Follow only that database path in section 5.
4. For an existing installation, make and verify a PostgreSQL backup first. Keep the database and both OAuth encryption keys together. Do not change `INTEGRATION_TOKEN_ENCRYPTION_KEY` or `INTEGRATION_OAUTH_ENCRYPTION_KEY` when moving saved encrypted tokens.
5. Keep all passwords, database URLs, OAuth client secrets, SMTP credentials, and encryption keys in Render's private Environment settings. Never put them in this repository, a `NEXT_PUBLIC_` variable, or a screenshot.
6. The commands below were checked with Node 24.20.0 and pnpm 11.8.0. Render's current Node 24 patch can move; set `NODE_VERSION=24.21.0` or another Node 24 patch currently offered by Render. The root `packageManager` field pins pnpm 11.8.0.

## 3. Create the PostgreSQL database

1. Sign in to Render and open the dashboard.
2. Select **New +** → **PostgreSQL**.
3. Enter:
   - **Name:** `smmd-postgres`
   - **Database:** use Render's generated value or `marketwise`
   - **User:** use Render's generated value
   - **Region:** `Frankfurt`
   - **PostgreSQL Version:** `18`, if the selector is shown
   - **Instance Type:** `Free`
4. Create the database and wait until its status is **Available**.
5. Open the database's **Info** page. Copy its **Internal Database URL** privately. Do not paste it into chat, Git, or a public service.
6. The API connection must select the application schema. Use the Render internal URL with the Prisma schema parameter:

   ```text
   postgresql://<render-user>:<render-password>@<internal-host>:5432/<database>?schema=social_media_dashboard
   ```

   Preserve any query parameters already present: add `&schema=social_media_dashboard` if the URL already has a query string. URL-encode special characters in usernames/passwords if constructing the URL yourself. Do not use the external URL in the API service.

### Free database limitation

Render's Free PostgreSQL instance expires after 30 days and does not include managed backups. Treat it as a temporary demo database. Keep a separate encrypted backup and test that it restores. For long-term data, choose a supported paid database before the free instance expires; this guide does not upgrade anything automatically.

## 4. Create and configure `smmd-api`

Create the API only after the existing-database restore is complete, if you are migrating data. The API start command applies migrations before the server starts.

1. Select **New +** → **Web Service** and connect `tolukusan/social-media-dashboard`.
2. Enter the service fields:
   - **Name:** `smmd-api`
   - **Language/Runtime:** `Node`
   - **Branch:** `staging`
   - **Root Directory:** leave blank
   - **Region:** `Frankfurt`
   - **Instance Type:** `Free`
   - **Health Check Path:** `/api/v1/health`
   - **Build Command:**

     ```sh
     pnpm install --frozen-lockfile && pnpm --filter @smd/api prisma:generate && pnpm --filter @smd/api build
     ```

   - **Normal Start Command:**

     ```sh
     pnpm --filter @smd/api exec prisma migrate deploy && pnpm --filter @smd/api start:prod
     ```

   - **Auto-Deploy:** keep disabled during first setup; enable it after the smoke checks pass if you want staging pushes to deploy automatically.
3. Add these Environment variables. Replace angle-bracket placeholders with the actual values from your Render dashboard; do not include the angle brackets.

   | Key                                | Value                                                                                                           |
   | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
   | `NODE_ENV`                         | `production`                                                                                                    |
   | `NODE_VERSION`                     | `24.21.0` (or the current supported Node 24 patch)                                                              |
   | `DATABASE_URL`                     | Internal Render database URL plus `schema=social_media_dashboard`                                               |
   | `APP_ORIGIN`                       | `https://<actual-smmd-web-host>`; exact origin only, no trailing path                                           |
   | `REPORTING_TIMEZONE`               | `Africa/Lagos`                                                                                                  |
   | `SESSION_COOKIE_NAME`              | `smd_session`                                                                                                   |
   | `INTEGRATIONS_SCHEDULER_ENABLED`   | `false` for the initial Free-tier demo                                                                          |
   | `INTEGRATION_TOKEN_ENCRYPTION_KEY` | Existing key when restoring; otherwise a new private 32-byte base64 key if Accounts OAuth will be used          |
   | `INTEGRATION_OAUTH_ENCRYPTION_KEY` | Existing key when restoring; otherwise a separate new private 32-byte base64 key if campaign OAuth will be used |

   Generate a new key only for a fresh database that has no encrypted credentials. From a trusted local terminal, generate each key independently with `openssl rand -base64 32`; enter the output directly in Render and do not save it in a tracked file. Never replace an existing database's key.

4. Render supplies `PORT`; do not set a fixed production port. `API_PORT` is optional and is only the local fallback.
5. Configure OAuth variables only for providers you will use. The callback URLs are listed in section 7.
6. Configure SMTP only if password-recovery email will be enabled:
   - `SMTP_HOST`
   - `SMTP_PORT` (usually `587`)
   - `SMTP_SECURE` (`true` only when the SMTP provider requires implicit TLS; otherwise `false` for STARTTLS on 587)
   - `SMTP_USER`
   - `SMTP_PASSWORD`
   - `SMTP_FROM`

   Render Free Web Services block outbound traffic on ports 25, 465, and 587. The common SMTP configuration above therefore will not send mail from a Free service. Use a paid service plan that permits your mail provider's connection, or add an HTTPS email-provider integration before enabling password-recovery email. Do not mark recovery email as working until an actual inbox delivery is verified.

7. Save the environment and create the service. Wait for the build/deploy to finish.
8. Open `https://<actual-smmd-api-host>/api/v1/health`. It should return HTTP 200. This endpoint confirms the API process is serving; the authenticated smoke checks later confirm database-backed access.

### Build output and startup behavior

The API build emits `apps/api/dist/src/main.js`. Start it with the package's `start:prod` script, which uses the production-installed `tsx` runtime to resolve the extensionless ESM imports emitted by TypeScript and Prisma. Do not set `SMD_E2E_ALLOW_HTTP_API_ORIGIN` on Render; only the isolated local browser-test runner sets that flag, so production builds require HTTPS. The start command chains migration and server start with `&&`, so a migration error prevents the API from starting. It uses `prisma migrate deploy`; never substitute `prisma migrate dev` or `prisma migrate reset` on Render.

## 5. Initialize a fresh database or restore existing data

Do exactly one of these procedures. Do not restore over a database after the API has started and applied migrations.

### A. Fresh database: create the first Administrator

1. In `smmd-api` → **Environment**, add:
   - `SEED_ADMIN_EMAIL` = the first Administrator's email address
   - `SEED_ADMIN_PASSWORD` = a long, unique password supplied privately
2. Temporarily change the API **Start Command** to:

   ```sh
   pnpm --filter @smd/api exec prisma migrate deploy && pnpm --filter @smd/api prisma:seed && pnpm --filter @smd/api start:prod
   ```

3. Save and deploy. The seed applies the fixed application catalogue and creates the first Administrator only when no Administrator exists. It does not add demonstration campaigns, users, analytics, or imported files.
4. Check the API health URL, open the frontend after it is deployed, and sign in using the credentials you entered.
5. In Render, remove both `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from the API Environment.
6. Restore the normal Start Command from section 4 and redeploy.

The production seed now skips an existing Administrator; rerunning it cannot reset an existing Administrator password. In local development, the existing configured seed upsert behavior remains. Do not run a demo-data seed in production.

### B. Existing database: restore before first API start

1. Keep the API service uncreated or undeployed until the restore finishes. Do not let its start command run against an empty target first.
2. Create the Render PostgreSQL database and confirm its name, region, and status. Verify the restore target is empty and is the intended database.
3. From a trusted machine with compatible PostgreSQL client tools, use the repository's [backup and restore procedure](../evidence/backup-restore-verification.md). Restore only the `social_media_dashboard` application schema into the Render database. Use Render's external database URL only from that trusted restore machine; use the internal URL for the API service.
4. Restore with owner/ACL options appropriate for the Render-managed database role. Preserve `_prisma_migrations`, users, campaigns, imports, reports, OAuth records, audit history, and all application tables. Do not rerun Administrator seeding or demo preparation.
5. Verify the restore completed successfully and that the Render target contains the expected tables and rows before proceeding.
6. Create `smmd-api` using the normal start command. It applies only migrations not yet recorded in the restored `_prisma_migrations` table, then starts the API.
7. Keep both existing OAuth encryption keys unchanged. Changing either key makes the corresponding saved encrypted credentials unreadable.

Never run a restore against a non-empty target without first identifying its contents and planning a non-destructive merge. When uncertain, stop before the first API deployment and verify the backup/restore target.

## 6. Create and configure `smmd-web`

Create the frontend after the API is reachable so you can use the actual API hostname.

1. Select **New +** → **Web Service** and connect the same GitHub repository.
2. Enter:
   - **Name:** `smmd-web`
   - **Language/Runtime:** `Node`
   - **Branch:** `staging`
   - **Root Directory:** leave blank
   - **Region:** `Frankfurt`
   - **Instance Type:** `Free`
   - **Build Command:**

     ```sh
     pnpm install --frozen-lockfile && pnpm --filter @smd/web build
     ```

   - **Start Command:**

     ```sh
     pnpm --filter @smd/web exec next start -H 0.0.0.0 -p $PORT
     ```

3. Add these Environment variables:

   | Key                   | Value                                                       |
   | --------------------- | ----------------------------------------------------------- |
   | `NODE_ENV`            | `production`                                                |
   | `NODE_VERSION`        | Same supported Node 24 patch used by the API                |
   | `NEXT_PUBLIC_API_URL` | `/api/v1`                                                   |
   | `SMD_API_ORIGIN`      | `https://<actual-smmd-api-host>`; origin only, no `/api/v1` |

4. Save and deploy. `SMD_API_ORIGIN` must be present when the frontend is built; Next.js records the rewrite destination in the production build. If the API hostname changes, update this value and rebuild/redeploy the web service.
5. Open `https://<actual-smmd-web-host>`. In browser developer tools, API requests should go to the web origin at `/api/v1/...`, not directly to the API hostname.

The API origin is server-only configuration. Do not rename it to `NEXT_PUBLIC_SMD_API_ORIGIN` or otherwise expose it in client code.

## 7. Register OAuth callback URLs

Use the **web service's HTTPS hostname** for all provider callbacks. The browser/provider returns to the web service; Render's Next.js rewrite forwards the callback path to the API. Do not register the API host for this same-origin deployment.

Let `WEB_ORIGIN` mean exactly `https://<actual-smmd-web-host>` with no trailing slash. Add these URLs to the matching provider app's authorized redirect/callback URI list:

| Flow                                              | Exact callback pattern                                      |
| ------------------------------------------------- | ----------------------------------------------------------- |
| Connected accounts (Meta, LinkedIn, Google, Zoho) | `${WEB_ORIGIN}/api/v1/accounts/oauth/callback`              |
| Campaign connector — Meta                         | `${WEB_ORIGIN}/api/v1/integrations/oauth/meta/callback`     |
| Campaign connector — LinkedIn                     | `${WEB_ORIGIN}/api/v1/integrations/oauth/linkedin/callback` |
| Campaign connector — Google                       | `${WEB_ORIGIN}/api/v1/integrations/oauth/google/callback`   |
| Campaign connector — Zoho                         | `${WEB_ORIGIN}/api/v1/integrations/oauth/zoho/callback`     |

Enter the matching URLs in each provider console's redirect URI field. Scheme, hostname, path, and trailing slash must match exactly. Do not add a trailing slash. These callbacks do not grant API product approval or provider scopes by themselves.

For **Accounts → Connect**, set these API variables to the exact same web origin/callback:

```text
INTEGRATION_OAUTH_REDIRECT_URI=https://<actual-smmd-web-host>/api/v1/accounts/oauth/callback
```

For the older campaign-level OAuth connectors, set:

```text
INTEGRATION_OAUTH_API_ORIGIN=https://<actual-smmd-web-host>
INTEGRATION_OAUTH_ALLOWED_CALLBACK_ORIGINS=https://<actual-smmd-web-host>
```

The variable name `INTEGRATION_OAUTH_API_ORIGIN` is retained for compatibility; its value is the public web origin in this proxy deployment. Keep each provider's existing client ID/secret server-side. For a restored database, preserve the existing encryption keys. If changing any environment variable used by a provider console, update both sides before testing consent.

Provider configuration names are listed in [`apps/api/.env.example`](../../apps/api/.env.example). The [provider setup guide](provider-setup-and-migration.md) documents the existing developer applications and known approval limitations.

## 8. Verify the deployed application

Run these checks manually after both services are healthy:

1. Open the API health URL and confirm HTTP 200.
2. Open the web URL and confirm the sign-in page loads over HTTPS.
3. Sign in. Confirm `/api/v1/auth/csrf`, `/api/v1/auth/login`, and `/api/v1/auth/me` requests go through the web origin.
4. In browser storage, confirm `smd_session` is `HttpOnly`, `Secure`, and `SameSite=Lax`; `csrf_token` is `Secure`, readable by the browser, and `SameSite=Lax`.
5. Reload the page and confirm the session remains active. Log out and confirm protected data becomes unavailable.
6. Confirm an unsafe request succeeds with a valid CSRF token and is rejected without one. Do not weaken CSRF or CORS to make a failing request pass.
7. Open the Campaigns and Data screens. Confirm existing campaigns/imports are present for a restored database, and upload a test file only if you intend to create new user data.
8. Open Reports and download a PDF.
9. Connect a provider only after its callback URL, product approval, scopes, and server-side credentials are correct. Test one account and verify the callback returns to the web application.
10. Check Render logs for startup, migration, proxy, or provider errors. Never copy secrets or access tokens into retained logs/evidence.

The API health route does not perform a database read. The successful sign-in and protected dashboard read provide the database-backed check.

## 9. Free-tier behavior and operations

- Free Web Services can spin down after 15 minutes without traffic. The first request after sleeping may wait for the service to wake.
- Free PostgreSQL expires after 30 days and has no managed backups. Make and test separate backups before using it for real records.
- The free web/API instances have limited memory (512 MB); monitor build and runtime restarts.
- Do not rely on hourly/daily integration synchronization while the API service can sleep. Keep `INTEGRATIONS_SCHEDULER_ENABLED=false` for the initial Free-tier demo and use **Sync this period** manually. Enable scheduled work only on an always-on service and after monitoring.
- Keep the API, web, and database in Frankfurt. Render's free services use their public service URLs; the web proxy calls the API URL server-side. Use the internal database URL for API-to-database traffic.
- Recheck backups and provider consent before moving from a temporary demo to ongoing use.

## 10. What is not done by this guide

No Render service, database, deployment, provider console setting, credential, or production record was changed by preparing this guide. Deploying remains an action you perform in your Render and provider dashboards. `main` is not used or modified by these instructions.

### Official references

- [Render Web Services](https://render.com/docs/web-services)
- [Render PostgreSQL connections](https://render.com/docs/postgresql-creating-connecting)
- [Render free services](https://render.com/docs/free)
- [Render compute plans](https://render.com/docs/compute-plans)
- [Render Node versions](https://render.com/docs/node-version)
- [Next.js 15 rewrites](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/rewrites)

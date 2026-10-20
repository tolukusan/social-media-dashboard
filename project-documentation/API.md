# API reference

[Documentation home](README.md) · [Architecture](ARCHITECTURE.md) · [Setup](SETUP.md) · [Status](STATUS.md)

Reviewed against controller decorators, guards, DTOs and services at `20a364f`. All routes below have the prefix **`/api/v1`**. Local base: `http://localhost:4000/api/v1`; deployed browser base: `https://smmd-web.onrender.com/api/v1`. Direct API health is `https://smmd-api.onrender.com/api/v1/health`.

The approved original stack mentions Swagger, but this snapshot has no Swagger bootstrap, dependency or generated OpenAPI reference. This inventory covers all actual controller routes. It does not promise a uniform response envelope: many services return arrays or selected Prisma objects; PDF/CSV endpoints return bytes. Linked source DTOs/services are the detailed contract.

## Authentication and request security

There is no bearer/JWT login API. `POST /auth/login` accepts email/password, checks an active user and Argon2id hash, stores the hash of a random session token, sets an opaque session cookie and returns the user with `passwordHash` omitted. `GET /auth/me` reads the authenticated safe user, including its role. Sessions last seven days in current code. Cookies use `HttpOnly`, `SameSite=Lax`, path `/`, and `Secure` in production. See [auth service](../apps/api/src/auth/auth.service.ts).

Global guards run session → role → CSRF → Origin checks:

- Session-exempt routes: health; CSRF issuance; login, register, accept-invitation, forgot-password, reset-password and logout; and the exact GET OAuth callbacks. Session exemption does **not** exempt a write from the other guards.
- Every unsafe request needs an `Origin` exactly matching configured `APP_ORIGIN`. Production configuration must be HTTPS. CORS permits the configured origin and credentials.
- All unsafe requests **except login** need a `csrf_token` cookie and matching `x-csrf-token` header. Obtain both by `GET /auth/csrf`, which returns `{ "csrfToken": "<generated-token>" }`. Registration, invitation acceptance, recovery and logout also need this pair. Browser clients send `credentials: 'include'`.
- Role codes are `ADMIN`, `MARKETING_OFFICER` and `MANAGEMENT`. Table notation: **A** = Admin; **W** = Admin or Marketing Officer; **R** = any authenticated role; **P** = session-exempt. No role parameter on public registration grants privileges.
- OAuth callbacks validate their one-time stored state rather than expecting an authenticated callback session. Accounts callback redirects 302; campaign callback redirects 303. Never retain callback query strings or authorization URLs in evidence.

Sources: [session guard](../apps/api/src/auth/session.guard.ts), [CSRF guard](../apps/api/src/auth/csrf.guard.ts), [Origin guard](../apps/api/src/auth/recovery-origin.guard.ts), [roles guard](../apps/api/src/common/roles.guard.ts), [bootstrap](../apps/api/src/main.ts).

## Validation, pagination and errors

Nest's global `ValidationPipe` transforms DTO input, allows declared properties and rejects undeclared properties. UUID/date/enum/length checks depend on each controller/DTO; not every older path parameter uses `ParseUUIDPipe`. Services additionally validate date ranges, parent activity, metric applicability, source ownership, conflicts and current permissions.

| Area                       | Pagination/filter contract                                                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dataset rows/exports       | `page=1`, `pageSize=50` (maximum 200), `search`, `dateColumnId`, `from`, `to`, `expectedRevision`, `chartColumnId`; export services apply their own bounded full-result behavior rather than exporting just a displayed page. |
| Historical dataset rows    | `page=1`, `pageSize=50`, maximum 200                                                                                                                                                                                          |
| Archive lists              | `page=1`, `pageSize=25`, maximum 100, optional `search`                                                                                                                                                                       |
| Campaign analytics/reports | Optional `from`, `to`, `campaignId`, `channelId`, `platformId`, `metricCode`, `targetPeriod`, `includeUnavailableMetrics` (`"true"`/`"false"`); comparison fields below                                                       |
| Account reports/sync       | Required calendar `from`, `to`; Meta report range maximum 365 inclusive dates                                                                                                                                                 |
| Connection analytics       | Required `from`, `to`; optional `scope=ACCOUNT` (maximum 366 inclusive dates) or `CONTENT` (maximum 31 inclusive dates). These limits differ from the Accounts Meta maximum of 365.                                           |
| Other lists                | No universal `page`/`limit` contract. For example, performance UI paginates loaded records in groups of 50; that is not server-side pagination.                                                                               |

Analytics comparison accepts `dimension=CAMPAIGN|CHANNEL`, `dimensionIds` as a string interpreted by the service, `comparisonMode=PERIOD|LIFETIME`, and `comparisonPeriod=CUSTOM|MONTH|QUARTER|YEAR`. Target periods are `DAILY`, `WEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY`, `CAMPAIGN`. See [dashboard DTO](../apps/api/src/analytics/dto/dashboard-query.dto.ts), [dataset DTO](../apps/api/src/datasets/dataset.dto.ts), [archive DTO](../apps/api/src/archive/archive-query.dto.ts).

Read HTTP status and the actual error body. Domain exceptions often return `{ "code": "...", "message": "..." }`; validation errors can use Nest's `statusCode`/`message` array/`error` form. There is no global custom error-envelope mapper. Typical cases are 400 validation/domain errors, 401 unauthenticated or invalid credentials, 403 role/Origin/CSRF denial, 404 unavailable resource, 409 conflict/stale revision/busy sync, and 429 public recovery/access throttling. Login's own `LOGIN_RATE_LIMITED` currently uses 401. Upload middleware can reject oversized files. Provider failures may also appear as saved job/run error codes rather than an HTTP failure of the enqueue request.

For example, a protected request without a session raises 401 with:

```json
{ "code": "UNAUTHENTICATED", "message": "Authentication required" }
```

Never display raw provider responses, credentials or cookie values in diagnostics. Preserve safe error codes and timestamps. A 202 enqueue response says work was accepted, not completed.

## Route inventory

### Health, authentication and access

Sources: [health](../apps/api/src/health/health.controller.ts), [auth](../apps/api/src/auth/auth.controller.ts), [access](../apps/api/src/access/access.controller.ts), [access DTOs](../apps/api/src/access/access.dto.ts).

| Method | Path after `/api/v1`             | Access | Purpose                                                               |
| ------ | -------------------------------- | ------ | --------------------------------------------------------------------- |
| GET    | `/health`                        | P      | Process health; does not query PostgreSQL                             |
| GET    | `/auth/csrf`                     | P      | Issue CSRF cookie and token JSON                                      |
| POST   | `/auth/login`                    | P      | Authenticate and set session cookie                                   |
| POST   | `/auth/logout`                   | P      | Revoke supplied session and clear cookie; still CSRF/Origin protected |
| GET    | `/auth/me`                       | R      | Safe current user                                                     |
| PATCH  | `/auth/me`                       | R      | Update own display name                                               |
| PATCH  | `/auth/password`                 | R      | Current/new password; revoke sessions after change                    |
| POST   | `/auth/forgot-password`          | P      | Generic acknowledgement, 202, for recovery request                    |
| POST   | `/auth/reset-password`           | P      | Consume valid recovery token, set password, return 200                |
| POST   | `/auth/register`                 | P      | Submit approval request; 202, no session/automatic role               |
| POST   | `/auth/accept-invitation`        | P      | Consume invitation using matching invited email                       |
| GET    | `/access/requests`               | A      | List access requests                                                  |
| POST   | `/access/requests/:id/review`    | A      | Approve with explicit role or reject                                  |
| GET    | `/access/invitations`            | A      | List invitation metadata                                              |
| POST   | `/access/invitations`            | A      | Create one-time seven-day invitation; returns private invitation URL  |
| POST   | `/access/invitations/:id/revoke` | A      | Revoke unused invitation                                              |

### Users, catalogue and reporting settings

Sources: [users](../apps/api/src/users/users.controller.ts), [catalogues](../apps/api/src/channels/channels.controller.ts), [settings](../apps/api/src/settings/reporting-settings.controller.ts).

| Method | Path                    | Access | Purpose                                              |
| ------ | ----------------------- | ------ | ---------------------------------------------------- |
| GET    | `/users/roles`          | A      | Existing role choices                                |
| GET    | `/users`                | A      | User administration list                             |
| POST   | `/users`                | A      | Create user with role                                |
| PATCH  | `/users/:id`            | A      | Update user/role                                     |
| DELETE | `/users/:id`            | A      | Deactivate, retaining references                     |
| PATCH  | `/users/:id/password`   | A      | Administrative password reset                        |
| PATCH  | `/users/:id/reactivate` | A      | Reactivate user                                      |
| GET    | `/channels`             | R      | Channel catalogue                                    |
| GET    | `/channels/:id/metrics` | R      | Channel's applicable metrics                         |
| POST   | `/channels`             | A      | Create channel                                       |
| PATCH  | `/channels/:id`         | A      | Update/reactivate catalogue entry                    |
| DELETE | `/channels/:id`         | A      | Soft-deactivate channel                              |
| GET    | `/platforms`            | R      | Platforms; optional `channelId` filter               |
| POST   | `/platforms`            | A      | Create platform in channel                           |
| PATCH  | `/platforms/:id`        | A      | Update/reactivate platform                           |
| DELETE | `/platforms/:id`        | A      | Soft-deactivate platform                             |
| GET    | `/settings/reporting`   | R      | Reporting settings/currency options                  |
| PATCH  | `/settings/reporting`   | A      | Set approved `reportingCurrency` code; no conversion |

### Campaigns, performance, targets, analytics and reports

Sources: [campaigns](../apps/api/src/campaigns/campaigns.controller.ts), [performance](../apps/api/src/performance/performance.controller.ts), [targets](../apps/api/src/targets/targets.controller.ts), [analytics](../apps/api/src/analytics/analytics.controller.ts), [reports](../apps/api/src/reports/reports.controller.ts).

| Method | Path                              | Access | Purpose                                               |
| ------ | --------------------------------- | ------ | ----------------------------------------------------- |
| GET    | `/campaigns`                      | R      | Active/unarchived campaign list                       |
| GET    | `/campaigns/:id`                  | R      | Campaign detail and associations                      |
| POST   | `/campaigns`                      | W      | Create campaign, optional channel/platform selections |
| PATCH  | `/campaigns/:id`                  | W      | Edit writable campaign                                |
| DELETE | `/campaigns/:id`                  | A      | Archive campaign                                      |
| GET    | `/performance-records`            | R      | Eligible daily records                                |
| POST   | `/performance-records`            | W      | Create raw daily metric values                        |
| PATCH  | `/performance-records/:id`        | W      | Correct daily values under ownership rules            |
| DELETE | `/performance-records/:id`        | A      | Archive daily record                                  |
| GET    | `/targets`                        | R      | KPI targets                                           |
| GET    | `/targets/definitions`            | R      | Targetable KPI definitions                            |
| POST   | `/targets`                        | A      | Create scoped target with overlap checks              |
| PATCH  | `/targets/:id`                    | A      | Update target                                         |
| GET    | `/analytics/default-period`       | R      | Backend-selected eligible initial period              |
| GET    | `/analytics/dashboard`            | R      | Filtered campaign KPI dashboard                       |
| GET    | `/analytics/trends`               | R      | Backend trend values                                  |
| GET    | `/analytics/comparison`           | R      | Period comparison                                     |
| GET    | `/analytics/dimension-comparison` | R      | Campaign/channel comparison                           |
| GET    | `/reports/preview`                | R      | Campaign report view model                            |
| GET    | `/reports/dashboard.pdf`          | R      | Download filtered PDFKit report                       |

### File-first datasets and structured KPI imports

Sources: [datasets controller](../apps/api/src/datasets/datasets.controller.ts), [dataset service](../apps/api/src/datasets/datasets.service.ts), [imports controller](../apps/api/src/imports/imports.controller.ts), [map DTO](../apps/api/src/imports/dto/map-import.dto.ts). Both preview upload endpoints expect multipart field **`file`**, maximum **10 MiB**. Dataset preview additionally expects `campaignId`, optionally `datasetId` for replacement.

| Method | Path                                               | Access | Purpose                                                         |
| ------ | -------------------------------------------------- | ------ | --------------------------------------------------------------- |
| POST   | `/datasets/imports/preview`                        | W      | Stage file as campaign dataset and preview worksheets           |
| POST   | `/datasets/imports/:attemptId/sheet`               | W      | Select `selectedSheet`                                          |
| POST   | `/datasets/imports/:attemptId/replace`             | W      | Set `targetDatasetId`, `expectedVersion`                        |
| POST   | `/datasets/imports/:attemptId/confirm`             | W      | Commit staged dataset/revision                                  |
| POST   | `/datasets/imports/:attemptId/template`            | W      | Apply `templateId` to staged column labels                      |
| GET    | `/datasets/templates`                              | R      | Current user's saved templates                                  |
| POST   | `/datasets/templates`                              | W      | Save named header-fingerprint/rules template                    |
| GET    | `/datasets/campaigns/:campaignId`                  | R      | Campaign datasets and protected historical imports              |
| GET    | `/datasets/campaigns/:campaignId/history/:batchId` | R      | Paginated historical-import detail                              |
| GET    | `/datasets/:id`                                    | R      | Dataset metadata/current columns and capabilities               |
| GET    | `/datasets/:id/rows`                               | R      | Filtered, revision-checked rows                                 |
| PATCH  | `/datasets/:id/columns`                            | W      | Save column label, meaning and unit metadata                    |
| DELETE | `/datasets/:id`                                    | A      | Delete manageable dataset with replay fence/provenance handling |
| GET    | `/datasets/:id/export.csv`                         | R      | CSV export of selected dataset scope                            |
| GET    | `/datasets/:id/export.pdf`                         | R      | Dataset PDF, optional selected chart                            |
| POST   | `/datasets/compare/compatibility`                  | R      | Existing server comparison contract for two selected columns    |
| POST   | `/datasets/compare/export.pdf`                     | R      | PDF of that comparison; still CSRF/Origin protected             |
| POST   | `/imports/preview`                                 | W      | Stage structured KPI file                                       |
| POST   | `/imports/:id/map`                                 | W      | Set context/mappings and validate daily normalization           |
| POST   | `/imports/:id/confirm`                             | W      | Commit accepted canonical campaign metrics                      |
| GET    | `/imports`                                         | R      | Import history                                                  |
| GET    | `/imports/:id`                                     | R      | Batch preview/details                                           |
| GET    | `/imports/:id/rows`                                | R      | Staged/source rows                                              |
| DELETE | `/imports/:id`                                     | A      | Remove eligible uncommitted staging only                        |

The visible joined-by-date table and its CSV/Print actions are implemented in the browser. There is **no join endpoint**. The older comparison endpoints remain implemented although their duplicate UI panel was removed. Management can use the read/comparison/export contracts but cannot save metadata/import data. Service capabilities may further restrict historical datasets.

### Connected accounts and asynchronous history

Source: [connected accounts controller](../apps/api/src/accounts/connected-accounts.controller.ts) and [service](../apps/api/src/accounts/connected-accounts.service.ts).

| Method | Path                             | Access | Purpose                                                                         |
| ------ | -------------------------------- | ------ | ------------------------------------------------------------------------------- |
| GET    | `/accounts/options`              | R      | Providers, required configuration/scopes and readiness                          |
| GET    | `/accounts`                      | R      | Safe account cards, sync/retention metadata                                     |
| POST   | `/accounts/oauth/start`          | W      | Start selected provider OAuth; returns transient authorization destination      |
| GET    | `/accounts/oauth/callback`       | P      | Shared one-time-state callback; redirects to web                                |
| POST   | `/accounts/:id/sync`             | W      | Sync `from`/`to`; Meta queues and responds 202; other providers use direct sync |
| POST   | `/accounts/:id/sync-jobs`        | W      | Explicit Meta-only enqueue, 202                                                 |
| GET    | `/accounts/:id/sync-jobs/active` | R      | Latest queued/running job summary or `null`                                     |
| GET    | `/accounts/:id/sync-jobs/:jobId` | R      | Specific account-bound job summary                                              |
| GET    | `/accounts/:id/analytics`        | R      | Social account report for `from`/`to`                                           |
| GET    | `/accounts/:id/email-report`     | R      | Zoho cumulative campaign report selected by send date                           |
| GET    | `/accounts/:id/report.pdf`       | R      | Social account report PDF                                                       |
| GET    | `/accounts/:id/email-report.pdf` | R      | Email account report PDF                                                        |
| DELETE | `/accounts/:id`                  | A      | Disconnect; retained permitted analytics remain                                 |
| DELETE | `/accounts/:id/data`             | A      | Explicit retained-data deletion after disconnect                                |

### Campaign integrations and archive

Sources: [integrations](../apps/api/src/integrations/integrations.controller.ts), [integration DTOs](../apps/api/src/integrations/integration.dto.ts), [connection analytics](../apps/api/src/account-analytics/account-analytics.controller.ts), [archive](../apps/api/src/archive/archive.controller.ts).

| Method | Path                                    | Access | Purpose                                                                                   |
| ------ | --------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| GET    | `/integrations/options`                 | R      | Connector types/configuration hints                                                       |
| GET    | `/integrations`                         | R      | Safe connections and mappings                                                             |
| GET    | `/integrations/:id/runs`                | R      | Recent run outcomes/counts/errors                                                         |
| POST   | `/integrations`                         | A      | Create provider connection referencing server credentials                                 |
| PATCH  | `/integrations/:id`                     | A      | Update connection settings/`autoSync`                                                     |
| POST   | `/integrations/:id/mappings`            | A      | Map external campaign to local campaign-platform                                          |
| DELETE | `/integrations/:id/mappings/:mappingId` | A      | Remove mapping when safe; preserve history                                                |
| POST   | `/integrations/:id/oauth/start`         | A      | Start campaign credential OAuth                                                           |
| GET    | `/integrations/oauth/:family/callback`  | P      | `meta`, `linkedin`, `google`, `zoho` callback family                                      |
| POST   | `/integrations/:id/sync`                | W      | Bounded connection sync with run result                                                   |
| POST   | `/integrations/:id/disconnect`          | A      | Disconnect campaign credentials/connection                                                |
| GET    | `/integrations/:id/analytics`           | R      | Canonical connection account/content observations                                         |
| GET    | `/archive/campaigns`                    | A      | Search/page archived campaigns                                                            |
| GET    | `/archive/records`                      | A      | Search/page archived daily records                                                        |
| POST   | `/archive/campaigns/:id/restore`        | A      | Restore campaign                                                                          |
| POST   | `/archive/records/:id/restore`          | A      | Restore record with valid parent                                                          |
| POST   | `/archive/:kind/:id/deletion-preview`   | A      | Current dependency checks and actor-bound five-minute confirmation                        |
| DELETE | `/archive/:kind/:id/permanent`          | A      | Confirm with `confirmationReference` and exact `typedText`; kind `campaigns` or `records` |

Do not use deletion endpoints merely to test documentation. Archive is reversible; permanent deletion and account-data deletion are separate intentional workflows.

## Important request/response examples

These are **illustrative code-derived contracts**, not captured production payloads. Replace example UUIDs with IDs returned by the API. Never put real tokens/passwords into tracked examples.

### Read health safely

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health
```

Response shape from `HealthController`:

```json
{
  "status": "ok",
  "service": "social-media-dashboard-api",
  "timestamp": "2026-10-20T11:11:19.468Z"
}
```

Health does not prove database connectivity, authenticated access or provider health.

### Session and user actions

The existing web [API client](../apps/web/lib/api-client.ts) implements cookie/CSRF handling. Equivalent client sequence: fetch CSRF with cookies enabled, login with the exact web Origin, preserve cookies, then send the returned CSRF token in unsafe requests. For example, login request JSON is:

```json
{ "email": "operator@example.invalid", "password": "<private-password>" }
```

`PATCH /auth/me` takes `{ "name": "Marketing Operator" }`. Own-password change takes `currentPassword` and `newPassword`. Recovery reset takes `token` and **`password`**, not `newPassword`. Public registration takes `name`, `email`, `password` (10–128 characters); review takes `decision: "APPROVED"` with `roleId`, or `decision: "REJECTED"`. See [auth DTOs](../apps/api/src/auth/dto) and [access DTOs](../apps/api/src/access/access.dto.ts).

### Create campaign and record performance

`POST /campaigns` body, derived from [CreateCampaignDto](../apps/api/src/campaigns/dto/create-campaign.dto.ts):

```json
{
  "name": "Autumn awareness",
  "startDate": "2026-10-01",
  "endDate": "2026-10-31",
  "responsibleUserId": "11111111-1111-4111-8111-111111111111",
  "channels": []
}
```

An empty `channels` array is valid for file-only organisation. For daily performance, include `{ "channelId": "<channel-uuid>", "platformIds": ["<platform-uuid>"] }` entries and use the returned campaign-platform ID. Optional fields are `description`, `objective`, `targetAudience`, `notes`, non-negative `budget`, and status `PLANNED|ACTIVE|COMPLETED|SUSPENDED|CANCELLED`. End date must not precede start date. Creation returns the campaign with nested `campaignChannels`/`campaignPlatforms`, rather than a `{data: ...}` envelope.

`POST /performance-records` uses the [performance DTO](../apps/api/src/performance/dto/create-performance.dto.ts):

```json
{
  "campaignPlatformId": "22222222-2222-4222-8222-222222222222",
  "recordDate": "2026-10-20",
  "values": { "IMPRESSIONS": 1000, "CLICKS": 25 },
  "notes": "Daily source totals"
}
```

Metric codes must be active raw metrics applicable to the selected channel; obtain them from `/channels/:id/metrics`. Do not send derived CTR or arbitrary source column names as canonical values. Archived keys and integration ownership can block writes.

### Save dataset column details

`PATCH /datasets/:id/columns`:

```json
{
  "columns": [
    {
      "id": "c1",
      "label": "Report date",
      "meaning": "Source calendar day",
      "unit": "date"
    },
    {
      "id": "c2",
      "label": "Views",
      "meaning": "Provider-exported views",
      "unit": "count"
    }
  ]
}
```

Use the dataset's actual column IDs. `label`/`meaning` are limited to 120 characters, unit to 40, ID to 32. The service returns updated dataset detail after saving; this edits metadata, not raw cells or KPI formulas. Replacement uses a staged preview and `expectedVersion` check. Row reads/exports can include `expectedRevision` so a stale view fails instead of silently reading a different revision.

### Queue and poll Meta history

`POST /accounts/:id/sync-jobs`, with session, CSRF and Origin:

```json
{ "from": "2026-10-19", "to": "2026-10-20" }
```

Example newly queued Instagram result (the `syncJobSummary` fields plus enqueue `queued`):

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "source": "MANUAL",
  "status": "QUEUED",
  "requestedPeriod": { "from": "2026-10-19", "to": "2026-10-20" },
  "fetchablePeriod": { "from": "2026-10-19", "to": "2026-10-20" },
  "completedChunks": 0,
  "totalChunks": 2,
  "successfulChunks": 0,
  "failedChunks": 0,
  "observationCount": 0,
  "errors": [],
  "finalErrorCode": null,
  "createdAt": "2026-10-20T11:00:00.000Z",
  "startedAt": null,
  "updatedAt": "2026-10-20T11:00:00.000Z",
  "completedAt": null,
  "alreadyRunning": false,
  "queued": true
}
```

Poll `GET /accounts/:id/sync-jobs/:jobId`; poll results omit enqueue-only `queued` and `alreadyRunning`. The latter is true when enqueue returns an existing active job. Alternatively, `/sync-jobs/active` returns the latest queued/running summary or `null`. Status values are `QUEUED`, `RUNNING`, `SUCCEEDED`, `PARTIAL`, `FAILED`, `CANCELLED`. `completedChunks` counts terminal work including terminal failures; it is not the success count or report coverage percentage. `errors` entries have `code`, `from`, `to`, `attempts`. A retryable failed chunk can appear in `failedChunks` while retries remain.

Requested/fetchable periods can differ; `fetchablePeriod` can be null. A duplicate/active request may return existing queued work rather than create an independent job. Instagram uses one-day chunks clipped to 90 days; Facebook uses up to 30-day chunks. Jobs require scheduler-enabled API uptime, even when manually requested. See [architecture scheduling](ARCHITECTURE.md#scheduling-leases-retries-and-retention).

## External integrations

| Accounts provider | Exact requested scopes                                                                                      | Prerequisites / limits                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `FACEBOOK`        | `pages_show_list`, `pages_read_engagement`, `read_insights`                                                 | Eligible Page and role, Meta app permissions/access level. Personal profile alone is insufficient.                                                                                   |
| `INSTAGRAM`       | Facebook scopes plus `instagram_basic`, `instagram_manage_insights`                                         | Business/Creator account linked to a Facebook Page; implemented flow uses Facebook login.                                                                                            |
| `LINKEDIN`        | `openid`, `profile`, `rw_organization_admin`, `r_organization_social`                                       | OpenID and Community Management access, organisation administrator and supported API version. This app uses read endpoints despite the provider's `rw_` scope name.                  |
| `YOUTUBE`         | `https://www.googleapis.com/auth/youtube.readonly`, `https://www.googleapis.com/auth/yt-analytics.readonly` | Data API v3 and Analytics API, eligible channel owner, consent/test-user or approved public app. Account watch time is supported; video watch time is not in the approved catalogue. |
| `ZOHO_CAMPAIGNS`  | `ZohoCampaigns.campaign.READ`                                                                               | Correct regional OAuth app/organisation and sent campaigns. Cumulative snapshots are selected by send date.                                                                          |

Exact source: [provider configuration](../apps/api/src/accounts/account-crypto.ts), [provider client](../apps/api/src/accounts/account-provider-client.ts). Runtime version strings must be supported by the provider, not just match the app's syntax check. App credentials present in options only establish configuration readiness. Public use can require provider review, business verification, consent publication, privacy/data-deletion information and eligible asset roles.

Campaign integration creation accepts the four providers in [integration-contract](../apps/api/src/integrations/integration-contract.ts): `FACEBOOK_ADS`, `INSTAGRAM_ADS`, `LINKEDIN_ADS`, `ZOHO_CAMPAIGNS`. Do not expose every Prisma enum as a creatable connector. Campaign OAuth family code contains Google configuration/callback support, but that alone is not a separate creatable Google campaign adapter. The campaign OAuth flow requests `ads_read` for paid Meta and `r_ads_reporting` for LinkedIn Ads, separately from the organic Accounts scopes. Exact family scopes are in [OAuth credential service](../apps/api/src/integrations/oauth-credential.service.ts).

Provider setup instructions and official links are maintained in [account provider setup](../docs/integrations/account-provider-setup.md) and [provider setup/migration](../docs/guides/provider-setup-and-migration.md). See [deployment callback registration](DEPLOYMENT.md#oauth-callback-registration) for the same-origin Render URLs. Token lifetime, quotas, provider history and review status can change; [STATUS](STATUS.md) records what remains unverified rather than assuming access from code presence.

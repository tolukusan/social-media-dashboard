# Marketwise / Social Media Dashboard

Marketwise is a digital marketing analytics application for **one organisation per deployment**. It helps marketing staff organise campaigns and source files, maintain daily campaign performance, inspect connected social accounts, and produce reports without treating missing data as zero. The repository is named `social-media-dashboard`; the public interface is branded Marketwise. This is a general-purpose marketing product, not an education-specific system.

This documentation describes source at **`20a364f` (20 October 2026)** and the separately identified evidence below. It is a handover guide, not a declaration that every provider or production workflow has passed live acceptance.

## Read by audience

| Reader                             | Start here                      | Then read                                                                                                                 |
| ---------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Developer taking over              | [Architecture](ARCHITECTURE.md) | [Setup](SETUP.md), [API](API.md), [status and maintenance checklist](STATUS.md)                                           |
| Installing/deploying administrator | [Setup](SETUP.md)               | [Deployment](DEPLOYMENT.md), [provider configuration](../docs/guides/provider-setup-and-migration.md)                     |
| End user                           | [User guide](USER_GUIDE.md)     | Relevant campaign, import, account, or report workflow                                                                    |
| Project assessor                   | This overview                   | [Status/evidence](STATUS.md), [architecture](ARCHITECTURE.md), [academic evidence](../docs/evidence/academic-evidence.md) |

The [existing documentation index](../docs/README.md) remains the entry point to approved specifications, decisions, detailed guides and historical evidence. This folder brings those sources together without replacing their approval history.

## Capabilities and terminology

| Term                | Meaning and implemented capability                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign            | Local marketing activity with dates, responsible user, optional channels/platforms, and imported datasets                                          |
| Channel / platform  | Marketing classification, such as Social Media and a particular service; a platform belongs to one channel                                         |
| Imported dataset    | A campaign's preserved CSV/JSON/XLSX table with revisions, typed cells, editable column details, filtering and exports                             |
| Performance record  | One canonical campaign-platform/calendar-date record containing approved raw metrics; manual entry and the structured KPI importer feed this model |
| Connected account   | An OAuth-authorised Page, professional account, organisation, channel or Zoho account; account reporting does not require a local campaign         |
| Campaign connection | An `IntegrationConnection` with provider configuration and optional external-to-local campaign mappings; separate from Accounts OAuth              |
| KPI / target        | Backend-calculated result and an Administrator-managed benchmark, governed by the approved metric catalogue                                        |
| Report coverage     | Dates with actual saved observations within a requested period; successful synchronization does not imply complete coverage                        |

Implemented source includes registration approval and invitations, session login/recovery, three roles, campaigns, catalogues, archive/restore and controlled deletion, manual performance, both import paths, date joins, analytics/targets, PDFs, provider adapters and PostgreSQL-backed Meta history jobs. See [STATUS](STATUS.md) for source/test references and limits.

Public web, API health and proxied health were reachable on 20 October 2026. Recorded repair evidence confirms Instagram progress after enabling the scheduler. The task-supplied history reports successful YouTube verification after its metric repair; the committed repair note itself records the fix and regression test, not a later live YouTube result. Facebook post-reconnection sync and current LinkedIn approval remain unverified. Zoho reports use **campaign send date**, with cumulative values. Provider credentials, API access and available history determine live results.

## Developer quick start

From a new clone, with Git, Node.js **24 LTS**, pnpm **11.8.0**, and PostgreSQL **18** installed:

```powershell
git clone https://github.com/tolukusan/social-media-dashboard.git
Set-Location social-media-dashboard
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Privately configure the API database, local origins and first-admin seed variables as described in [SETUP](SETUP.md). Use a new empty application database or a reviewed restore, never a reset of existing data. Then, from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @smd/api exec prisma migrate deploy
pnpm db:seed
pnpm dev
```

Expected: web at `http://localhost:3000`, API health at `http://localhost:4000/api/v1/health`. `db:migrate` is the development **migration-authoring** script (`prisma migrate dev`); applying existing committed migrations with `migrate deploy` avoids an unnecessary shadow-database workflow for installation. Stop if a migration fails; use the [troubleshooting instructions](SETUP.md#troubleshooting).

## Evidence and authority

Use the current approved task, [approved amendments](../docs/governance/design-amendments-v1.1.md), applicable accepted [architecture decisions](../docs/decisions/ADR-001-modular-monolith.md), and approved specifications in the order recorded by [AGENTS.md](../AGENTS.md). Later integration and access decisions extend the original manual-first MVP. Historical statements that imports/integrations are future work do not describe all current source. The original import promotion provenance is still unresolved; preserve the implementation without inferring approval for more formats.

Source, migration and test presence establish implementation, not successful execution in every environment. Dated test results remain historical unless rerun. [STATUS](STATUS.md) distinguishes this documentation pass, earlier test/deployment evidence, task-supplied observations, and live verification still needed.

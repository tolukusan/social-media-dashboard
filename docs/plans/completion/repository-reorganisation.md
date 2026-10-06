# Repository reorganisation implementation plan

## Documentation layout update - 2026-10-06

Retention update: the stakeholder explicitly chose removal of temporary .reorganisation-backup/ snapshots on 2026-10-06. They have been removed. Earlier recovery steps below describe the original execution, not available restore sources or instructions to recreate retained root backups.

The stakeholder authorised grouping current documents by topic. The [documentation index](../../README.md) defines current locations. Earlier flat directory diagrams, original-path inventories, and instructions to keep root specification paths stable describe the previous layout. They are preserved as history and are superseded for document placement only; all substantive requirements and approval statuses remain unchanged.

Status: proposed. Date: 2026-10-05. Read [the handoff](README.md) first.

## Objective

Make the repository understandable to a developer or a smaller-context model without changing business behaviour, replacing the approved architecture, or losing historical source material.

The main issues observed are duplicated source-document bundles, the accidental `docs/docs/` directory, mixed guides/reference/evidence in `docs/`, no root README, stale execution instructions, and most frontend behaviour concentrated in `apps/web/app/page.tsx`. The backend already has useful feature modules; preserve them.

The planning inspection found no `.git` repository (`git status` failed). Do not assume Git can recover a move or overwrite. No files are moved by this planning task.

## Target structure

```text
repository/
  README.md                         # quick start and project map
  AGENTS.md                         # active agent rules
  TODO.md                           # short execution entrypoint/status links
  BLOCKERS.md                       # concise unresolved blockers only
  .ai/                              # operating protocol, context map, skills
  apps/
    web/
      app/                          # Next route entrypoints/layout/global styles
      components/                   # genuinely shared presentation components
      features/                     # auth, users, catalogue, campaigns,
                                    # performance, dashboard, analytics,
                                    # reports, targets, imports
      lib/                          # typed HTTP client, providers, formatting
    api/
      src/                          # retain current Nest feature modules
      prisma/                       # schema, immutable applied migrations, seed
      test-fixtures/                # retained deterministic source fixtures
  packages/shared/src/              # public API transport types/constants only
  e2e/                              # browser journeys and their local fixtures
  performance/                      # load-test source/configuration
  docs/
    README.md                       # document navigation and authority summary
    DOCUMENT_MANIFEST.md             # authoritative source locations/status
    IMPLEMENTATION_PROGRESS.md      # concise current implementation evidence
    requirements.md, scope.md, ...   # keep approved canonical specs at stable paths
    initial-project-brief.md         # preserve original wording/source history
    design-amendments-v1.1.md        # approved amendment, stable location
    decisions/                      # accepted ADRs
    plans/                          # original M00-M12 plus completion plans
    guides/                         # current user/developer/local operations/imports
    reference/                      # benchmark material and Stitch reference
    evidence/                       # curated acceptance/screenshots/load summaries
    archive/                        # historical downloaded bundles, not current rules
```

Keep approved root spec paths stable in this pass. Most clutter reduction comes from relocating historical bundles and operational material, not moving every authoritative file and scattering compatibility stubs. Do not rename the workspace or package names as part of product generalisation.

Do not create empty feature folders or a generic `utils`/`services` dumping ground. Create directories only when moving or adding a concrete owner.

## R00 - Inventory and recovery boundary

Dependencies: none. No application behaviour changes.

Read: root AGENTS, `.gitignore`, package/workspace scripts, `docs/governance/DOCUMENT_MANIFEST.md`, `docs/architecture/repo-structure.md`, relevant read-only engineering-playbook repository guidance.

Steps:

1. Inventory authored files, generated directories, historic bundles, and current tool entrypoints. Exclude `node_modules`, generated Prisma output, `.next`, `dist`, test output, and environment-file contents from printed inventory.
2. Recheck Git status. If a repository exists, record the current revision and dirty paths without reverting user changes. If absent, do not initialise, stage, or publish everything automatically.
3. Before moving files, create a verified recovery copy of the exact authored files to be changed in a workspace-local `.reorganisation-backup/<timestamp>/` directory. Ignore that directory before copying; exclude `.env*`, credentials, runtime output, and dependencies. Copy only known source/doc paths, not the whole workspace.
4. Inspect `TODO.md` privately for credential-bearing instructions before copying it. The planning review already observed a password in this file. Do not echo it, copy it to an archive, or put it in an inventory. Produce only a redacted historical copy; preserve its non-sensitive instructions. Do not rotate credentials in this task.
5. Create `docs/plans/completion/reorganisation-inventory.md`: original path, intended path, authority category, pre-move hash for non-sensitive source documents, and reference owners. Use this as a checklist, not a second document manifest.
6. Hash-verify recoverable copies. Resolve every move source/destination to an absolute path inside this workspace. Refuse existing destination collisions; never use a force overwrite or recursive deletion as cleanup.

Acceptance: every planned move has a recoverable source and known destination; no secrets enter backups or logs; generated files are distinguished from authored files. If recovery cannot be established, block moves and continue read-only/product planning.

Rollback: restore only affected known files after checking for subsequent edits; preserve conflicting/newer versions for review. Never restore an entire directory over unrelated work.

## R01 - Clarify active instructions and product positioning

Dependencies: R00, F00. Documentation-only.

Expected changes: new root README, new `docs/README.md`, root TODO, narrow additions to AGENTS/manifest/context map/handoff, progress document.

Steps:

1. Add a root README with general-purpose product description, approved runtime/stack, verified package commands, app/module map, local-environment placeholders, and links to current plans/guides. Do not claim unimplemented features or reproduce credentials.
2. Add `docs/README.md` grouping current specifications, task plans, guides, evidence, reference, and historical material. Explicitly state that archived bundles are not implementation authority.
3. Link the confirmed general-purpose decision in `docs/plans/completion/README.md` from AGENTS and DOCUMENT_MANIFEST. Update current descriptive wording narrowly; preserve historical document text and approved formulas/permissions/scope.
4. Replace root TODO's long autonomous bootstrap script with a concise launcher linking current progress, blockers, and completion task order. Preserve unique non-sensitive operating restrictions in AGENTS or an explicitly linked current guide. Use only the redacted original from R00 if historical retention is needed.
5. Update `.ai/IMPLEMENTATION_HANDOFF.md` so new agents inspect the current execution ledger instead of blindly restarting M00. Retain the original milestone dependency rules and safe-work constraints.
6. Make approval status clear: this is a proposed task sequence until instructed to execute; the stakeholder's general-purpose positioning is already decided. Do not label import expansion or unrelated proposals as approved.

Acceptance: a fresh agent can find the next task and authoritative rule without reading historical duplicates; active documents contain no development password; historical source text is preserved. Verify Markdown formatting and relative links. No migrations/tests required beyond documentation checks.

## R02 - Organise documents and visual references

Dependencies: R01. Moves and link updates only; no rewriting of substantive requirements.

### Exact move map (historical original paths; R02 executed 2026-10-05)

| Current path                               | Proposed destination                                              |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `docs/docs/`                               | `docs/archive/source-bundles/step1-nested-docs/`                  |
| `docs/step2_approved_v1/`                  | `docs/archive/source-bundles/step2_approved_v1/`                  |
| `docs/step3_approved_v1/`                  | `docs/archive/source-bundles/step3_approved_v1/`                  |
| `docs/step4_approved_v1/`                  | `docs/archive/source-bundles/step4_approved_v1/`                  |
| `docs/step5_approved_v1/`                  | `docs/archive/source-bundles/step5_approved_v1/`                  |
| `docs/step6_approved_v1/`                  | `docs/archive/source-bundles/step6_approved_v1/`                  |
| `docs/step6_5_benchmark_audit_draft/`      | `docs/archive/source-bundles/step6_5_benchmark_audit_draft/`      |
| `docs/step7_approved_v1/`                  | `docs/archive/source-bundles/step7_approved_v1/`                  |
| `docs/step8_implementation_roadmap_draft/` | `docs/archive/source-bundles/step8_implementation_roadmap_draft/` |
| `docs/user-guide.md`                       | `docs/guides/user-guide.md`                                       |
| `docs/developer-guide.md`                  | `docs/guides/developer-guide.md`                                  |
| `docs/local-operations.md`                 | `docs/guides/local-operations.md`                                 |
| `docs/imports.md`                          | `docs/guides/imports.md`                                          |
| `docs/academic-evidence.md`                | `docs/evidence/academic-evidence.md`                              |
| `docs/benchmark-audit.md`                  | `docs/reference/benchmark/benchmark-audit.md`                     |
| `docs/benchmark-traceability.md`           | `docs/reference/benchmark/benchmark-traceability.md`              |
| `docs/amendment-register.md`               | `docs/reference/benchmark/amendment-register.md`                  |
| `docs/stitch_marketing_analytics_saas_ui/` | `docs/reference/stitch_marketing_analytics_saas_ui/`              |
| `performance/k6-health-summary.json`       | `docs/evidence/performance/k6-health-summary.json`                |

Do not move any of these if absent or already reorganised; record the actual state and avoid a duplicate nested destination. Do not delete downloaded source folders. These are preservation moves, including all attachments.

Steps:

1. Compare canonical documents with archived candidates by hash and, where different, a content diff. Preserve divergent versions and record their status; never choose a winner solely by filename/date. DOCUMENT_MANIFEST's Step 8 approval note still applies.
2. Move one category at a time using native PowerShell literal paths, after R00 checks. Keep whole Stitch bundles together so HTML/image-relative paths survive. Do not bulk-run shell-generated deletion commands.
3. Add an archive README with provenance, original locations, and a statement that nested historical AGENTS/skills are source artifacts, not instructions for editing the active application.
4. Search references in active docs, `.ai`, AGENTS, source, scripts, and configuration; update relative Markdown links and literal path instructions to each new location. Preserve historical bundle bytes; document broken historical links in the archive index rather than rewriting all snapshots.
5. Update DOCUMENT_MANIFEST and CONTEXT_MAP with current locations and unchanged authority ordering. Update references in these completion plans too, including their read lists.
6. Keep root canonical `docs/product/requirements.md`, `docs/product/scope.md`, domain/metric/security/reporting/deployment specs, amendments, initial brief, milestone index/roadmap, and original milestone plans in place.
7. Store only curated, non-sensitive evidence. Future transient load summaries belong under ignored runtime output unless explicitly selected as evidence. Keep their generation command and date alongside retained summaries.

Acceptance: preserved document hashes match; active links resolve; no active instruction points to old moved paths except the labelled historical move map; visual reference assets open; source snapshots remain recoverable. No database/code change. Run document checks; runtime build only if a moved asset/config proves to be an application dependency.

## R03 - Extract frontend features without changing behaviour

Dependencies: R02 and recovery baseline. Perform small extractions, not a one-shot rewrite. Do this before adding the missing product flows.

Read: approved repo structure, web page/layout/imports source, current CSS, shared package, browser smoke tests. Follow applicable frontend skills when editing components.

### Ownership map

| Current owner                            | Proposed owner                                               |
| ---------------------------------------- | ------------------------------------------------------------ |
| `HomePage` orchestration                 | `app/page.tsx` thin entry + `components/workspace-shell.tsx` |
| `AuthLoading`, `Login`, session UI       | `features/auth/`                                             |
| `Users`                                  | `features/users/`                                            |
| `CatalogueManagement`                    | `features/catalogue/`                                        |
| `Campaigns`, form, table, details        | `features/campaigns/`                                        |
| `Performance`                            | `features/performance/`                                      |
| `Overview`, dashboard KPI composition    | `features/dashboard/`                                        |
| Future distinct Analytics view           | `features/analytics/` when F08 implements it                 |
| `Reports`                                | `features/reports/`                                          |
| Future target administration             | `features/targets/` when F08 implements it                   |
| Imports page workflow components         | `features/imports/` with `app/imports/page.tsx` retained     |
| Shared empty/loading/presentation pieces | `components/` only if multiple features use them             |
| HTTP/session request helpers             | `lib/api-client.ts` or dedicated named modules               |
| Presentation number/date formatting      | `lib/format.ts`, with no KPI calculations                    |
| Shared API response/filter types         | `packages/shared/src/` only where API and web both need them |

Steps:

1. Record current route/navigation/login behaviour and smoke results. Capture representative screens locally without secrets.
2. Extract leaf components first: campaign table/detail, performance list, KPI card/shared empty state. Preserve props, DOM labels, styles, and event behaviour.
3. Extract forms and feature composition next, one feature per slice. Keep state ownership explicit and avoid circular feature imports. Update only necessary imports/types.
4. Extract the shell and auth boundary last. Keep current URLs, authentication gating, navigation mechanism, and `/imports` behaviour. Introducing new routes is not required to organise components.
5. Extract large import UI pieces only after its preview/map/validate/confirm behaviour is captured by meaningful tests. Keep API/source adapters and normalisation in the backend.
6. Keep `app/globals.css` imported from root layout. Split feature styles only when ownership is clear; no redesign, naming-system rewrite, or Tailwind migration in this extraction task.
7. Use `packages/shared` for serialisable contracts, not Prisma models, backend DTO decorators, session secrets, formulas, or shared runtime authorisation logic. Retain Nest module locations and Prisma output/migration paths.

Acceptance/tests: same route/role/navigation and import behaviour; forms still send the same valid requests; no protected request before authentication; no server code in client bundles; no circular dependency. Run updated formatting coverage, typecheck, tests, build, and relevant browser smoke after each coherent extraction. A full feature implementation cannot be hidden inside a refactor.

Migration impact: none. Rollback is per extraction using the verified recovery copy; never overwrite newer unrelated work.

## R04 - Align tooling and generated-artifact boundaries

Dependencies: R03. Small script/config changes only.

Expected changes: `.gitignore`, formatter ignore/config, package scripts, test discovery configuration, developer guide.

Steps:

1. Expand web formatting checks beyond `app/` to the extracted `features`, `components`, and `lib` sources. Ensure TypeScript and test discovery cover all new locations. Keep one package manager and lockfile.
2. Add a documented Markdown format-check command using existing Prettier. Exclude preserved historical bundles and generated outputs from automatic formatting; do not reformat every approved source document as collateral.
3. Confirm ignored boundaries for `.next`, `dist`, coverage, test-results, playwright-report, `*.tsbuildinfo`, generated Prisma output, private backups, local environment files, and transient load output. Keep authored fixtures, migrations, `.env.example`, and curated evidence visible.
4. Do not delete existing ignored/generated directories to make the tree look clean. Optional editor explorer exclusions may hide them if configured locally; runtime/build cleanup is a separate concern.
5. Keep migration directory names, schema paths, package names, runtime ports, API prefix, and build outputs stable. Do not rename backend modules merely to mirror an illustrative folder diagram.
6. Document any still-unresolved runner discrepancy for F01. This task updates discovery paths; F01 owns runner changes.

Acceptance/tests: formatting catches an intentionally checked new feature file without requiring a committed failure; typecheck/test/build see extracted source; generated files are excluded appropriately; scripts work on Windows using project-local tools. No migration.

## R05 - Final consistency and handoff

Dependencies: R04, completed product tasks or accurate recorded blockers.

Steps:

1. Re-run active Markdown link/path checks and search for stale paths. Exclude historical snapshots and explicitly labelled original-path inventory entries.
2. Verify one current source of truth per topic, one concise progress record, and concise genuine blockers. Do not duplicate implementation status across many files.
3. Confirm README quick start, guide paths, package commands, seed/migration instructions, and plan references against the actual tree. Ensure current copy stays general-purpose.
4. Review the recovery inventory and final file map. Leave private recovery copies ignored until the user chooses to remove them; do not automatically delete them.
5. If Git remains absent, report that fact and provide local version-control setup as a next action; do not publish or stage credential-bearing files. If Git exists, inspect status/diff without force-resetting user work.
6. Run final product verification as specified in F12; do not repeat unchanged successful runtime checks solely because a navigation document was edited.

Acceptance: a fresh implementing model can locate the next task, relevant authoritative specs, feature code, and actual verification evidence quickly; no data/source loss, stale active links, or unexplained architecture change occurred.

## Reorganisation non-goals

- No application rewrite, framework upgrade, microservice split, or database redesign.
- No deletion of original brief, approved source bundles, visual references, or unknown user files.
- No opportunistic renaming of backend features or applied migrations.
- No global replacement of educational-publishing text inside historical evidence.
- No production deployment, dependency-wide cleanup, or permanent second documentation authority.

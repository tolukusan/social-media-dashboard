# Simple guided UX proposal

Date: 2026-10-08. Status: local execution authorised by the stakeholder's “proceed with the plan” instruction on 2026-10-08. Verification is tracked in [execution evidence](../../evidence/simple-ux-verification.md).

## Goal and review basis

Help a marketing user get from a supported file to useful results and a PDF with mostly Next clicks. Keep the current general-purpose product, backend permissions, metric rules, supported formats, and data integrity controls.

This proposal follows the user's request to simplify the experience. It is based on source inspection of the workspace shell, import screen, dashboard, analytics, reports, import guide, current completion handoff, and improvement brief. It is not a live authenticated browser usability test. No application code or user data was changed.

The improvement brief describes many internal preparation operations. Those operations should not become fourteen user-facing steps. Several requested capabilities already exist and should be reused.

## Observed friction

| Current implementation                                                                                                 | Effect on the user                                                                 | Proposed change                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Import step links scroll to sections; upload, preview, mapping, validation, and history share one page.                | The user must find the next action among previous steps and unrelated information. | Render one active step with Back and one primary action.                                                   |
| Campaign, platform, dataset action, mapping selects, and display-name inputs are presented together.                   | Routine imports look like configuration work.                                      | Show a short suggested summary; put editing behind Change details.                                         |
| A previous mapping requires a separate Apply action.                                                                   | Repeat imports repeat preparation work.                                            | Preselect a compatible suggestion visibly, retaining review and server validation.                         |
| Campaign creation inside import exists, but its start date begins empty.                                               | Creating missing context interrupts progress.                                      | Suggest the earliest valid source date for a new campaign, label it as a suggestion, and allow correction. |
| Import success is a message on the import screen.                                                                      | The user must work out where to go and how to find the imported data.              | Show View results with the relevant campaign/platform/date context.                                        |
| Workspace date filters begin empty; trends require dates. Analytics defaults to social CTR.                            | First results can require configuration or show an irrelevant/unavailable metric.  | Open imported data with its committed date range and an available compatible metric.                       |
| Main navigation exposes operational and administrative destinations at the same level; Imports uses a separate layout. | The interface lists modules instead of suggesting a journey.                       | Group navigation by task and retain the same shell during import.                                          |

Evidence owners: `apps/web/features/imports/imports.tsx`, `apps/web/components/workspace-shell.tsx`, `apps/web/features/dashboard/overview.tsx`, `apps/web/features/analytics/analytics.tsx`, and `apps/web/features/reports/reports.tsx`.

## Recommended journey

```text
Home: Add your first data
           |
1. Upload file
           |
2. Confirm details
           |
3. Review and import
           |
4. View results ---- Download report
           |
      Add more data
```

### Home

For an authorised writer with no data, show one primary action: Add your first data. Offer Enter manually as a secondary action. Do not require visiting Campaigns or Settings before starting. If required catalogue entries are missing, explain the dependency and direct an Administrator to the relevant setting; do not give other roles administrative controls.

With data present, show results and Add data. Management opens the read-only results experience and receives no import onboarding. Targets are optional and never block viewing results or downloading a report.

### Step 1: Upload file

Show the file chooser and concise supported-format/size help. Selecting a file makes Next available; Next stages and inspects it using the existing preview endpoint. Keep the original file and raw provenance intact.

Show a worksheet question only when multiple usable sheets require a choice. Any changed sheet must refresh the relevant preview and suggestions before continuing. Do not silently rely on a preview from a different sheet.

### Step 2: Confirm details

Display a compact summary such as:

```text
Campaign       Summer promotion       Change
Platform       Facebook               Change
Dates          1-31 July 2026          From file
Data           Follows, Views         Review fields
Action         Add new dates          Change

                         Back   Next
```

Use the filename as the default import name; renaming is optional. Reuse explicit campaign context when starting from a campaign. Suggest an exact, unique source campaign match; ambiguous names remain a question. For a new campaign, open the existing inline creation form with safe proposed values and retain the upload state.

Use explicit source/platform evidence to suggest an active compatible platform. A generic Meta export must not be guessed as Facebook or Instagram. Generic Email must not be assigned to a named provider without evidence. Show unresolved questions clearly above Next.

For multiple source campaigns, show a compact mapping summary with exact matches prefilled and unresolved rows expanded. Require deliberate confirmation of mappings; never collapse similar names into one campaign automatically.

Show recognised analytics fields as read-only labels by default. Review fields opens the current mapping controls and optional display names. Keep source-only fields collapsed with their count and explanation. Required date/metric ambiguity is a visible blocker; ordinary metadata does not require repeated Ignore choices. Never substitute reach for views or treat source rates as canonical calculated KPIs.

Next runs backend validation and opens the review step. The user should not need to understand a separate Validate operation.

### Step 3: Review and import

Lead with what will happen: campaign/platform, dates, metrics, accepted daily records, unchanged records, and excluded/conflicting rows. Distinguish source-row counts from canonical daily-record counts because aggregation can combine rows.

For a clean import, show a short summary and Import data. Keep raw preview and technical details expandable. For issues, group them by actionable cause, provide Fix details, and disclose precisely what will be skipped before allowing any existing supported partial-import path. Never silently import only part of the file.

Translate the existing actions into plain language:

- Start data for this campaign/platform (`CREATE`).
- Add new dates (`APPEND`).
- Add missing metrics to matching dates (`MERGE`).

Retain existing backend semantics. A suggestion based on actual overlap is reviewable, never an automatic conflict resolution. If the service cannot yet provide overlap evidence, keep a short explicit action choice until that evidence exists. Never infer action from filename alone. Different existing values remain conflicts; equal values remain unchanged; archived keys remain protected.

Back preserves the current draft. Editing relevant details invalidates the previous validation. Import data requires current validation and explicit confirmation. Duplicate completed files remain blocked.

### Step 4: Results

After confirmation succeeds, show Import complete, a concise write summary, and View results as the primary action. Offer Add another file as a secondary action with the same campaign/platform context visibly prefilled and a Change option. Reset file-specific mapping and validation when starting another file.

View results carries the committed campaign/platform scope and committed record-date range to the dashboard. Label this scope visibly. These are results for that scope, which may include pre-existing data; do not label them as totals attributable only to the uploaded file. For a multi-campaign import, preserve the exact campaign set through an approved filter contract, or present campaign result choices rather than silently opening unrelated campaigns.

Select an available compatible metric from backend metadata and data availability. Show useful raw metrics when a derived KPI lacks inputs. Keep missing values unavailable and explain which inputs are absent. Do not hide data gaps or manufacture a rate.

Expose only Campaign and Date range initially; place channel, platform, metric, and target-period controls under More filters with active-filter indicators. Preserve access to all existing filters. Download report uses the same visible context and existing backend report calculations; optional comparison settings remain secondary.

## Navigation and recovery

- Keep Overview as the home destination. Group Imports and Performance data under Data, retaining distinct pages and manual entry.
- Keep Campaigns and Reports easy to reach; present Analytics as the deeper analysis destination and group Targets nearby. Put profile in the user menu and administrative controls under Administration.
- Retain the approved blue-accent visual style and common shell. No unrelated visual redesign.
- Keep Back/Next in a consistent location, with progress, clear loading states, keyboard focus on step headings/errors, and mobile-friendly controls. Avoid a sticky footer obscuring content.
- Put import history outside the active wizard. Existing deletion permissions and provenance remain unchanged.
- Guarantee in-wizard Back and inline campaign creation preserve the draft. Refresh/resume is a separate dependency: inspect existing staged-batch read/configuration APIs before promising durable resume. Do not place raw uploaded rows or credentials in browser storage. If resume is unavailable in the first slice, warn before leaving an unfinished import.

## Bounded implementation sequence

| Slice | Work and main files                                                                                                                                                                                             | Completion condition                                                                                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-01 | Extract the import screen into focused step components under `apps/web/features/imports/`; retain existing preview/map/confirm APIs, mapping controls, and history.                                             | One active step, preserved Back state, automatic validation on Next, explicit final commit, and clear success action. No schema change expected.                                                   |
| UX-02 | Add deterministic suggestion summaries and exception-only editing, reusing existing source adapters and previous mappings. Inspect `apps/api/src/imports/` contracts before adding any narrow preview metadata. | A recognised file with campaign context needs no manual field mapping; ambiguity is surfaced. Existing metrics and merge semantics are unchanged.                                                  |
| UX-03 | Carry committed context into `workspace-shell.tsx`, dashboard, analytics, and reports; add suitable date/metric defaults and report action.                                                                     | The user can see relevant results and export the same scope without reselecting dates or campaign. Any needed committed-summary/multi-campaign filter API extension is explicit and backend-owned. |
| UX-04 | Add home empty states, navigation grouping, shared import shell, filter disclosure, and accessible/mobile polish.                                                                                               | New users see one clear starting action; returning users reach results directly; role restrictions remain enforced.                                                                                |

Implement and verify one slice at a time. UX-01 and UX-03 offer the most immediate relief; do not delay them for a new preparation engine. Reuse campaign creation, raw storage, templates/suggestions, validation, merge/append, and report rendering. No new formats, arbitrary transformations, AI, integrations, formulas, or database architecture changes are proposed. If persistence proves necessary, define an additive plan under the database-change skill before implementing it. Apply analytics/security skills when a slice touches those contracts.

## Acceptance and verification

Primary usability target: with an existing campaign context and a recognised single-sheet file, reach results in four primary-action clicks after file selection: Next, Next, Import data, View results. No column edits or dataset-name edits should be required. File picking, genuine ambiguity, and new campaign creation are explicitly additional interactions. This is a target to test, not a measured result.

Verify these journeys with representative supported files in an isolated test environment:

1. First import with a new campaign, followed by results and PDF.
2. Repeat recognised import with prefilled context and reviewable mapping.
3. Add new dates; add missing metrics to existing dates; same-value no-op; differing-value conflict.
4. Multi-campaign Email with independent mapping; ambiguous Meta platform/metric; multi-sheet source.
5. Blank versus zero, duplicate file, archived-key collision, all-rejected file, and clearly disclosed partial import.
6. Back/edit/revalidate, failed network request/retry, double-click commit protection, and state retention during campaign creation.
7. Management read-only journey, Administrator/Marketing Officer import journeys, keyboard and narrow-screen operation.
8. Dashboard and report have identical visible scope; historical imported dates show useful results; missing KPI inputs remain unavailable.

Run repository lint, typecheck, relevant unit and isolated integration tests, build, and critical Playwright journeys. Use the repository's existing scripts. Have the stakeholder perform upload-to-PDF without coaching and record where they hesitate; the click target alone is insufficient evidence of usability.

## Deliverable status

UX-01–UX-04 are implemented and verified locally under the stakeholder's execution instruction. Backend review/confirmation summaries provide committed result scope; multiple campaigns receive separate result links. Dataset actions remain explicit, with missing-metric merge offered when existing-date conflicts are detected during validation. No schema change or durable draft-resume feature is required for this sequence. Historical import approval provenance remains unresolved; existing formats and functionality are preserved. See execution evidence for the final verification and limitations.

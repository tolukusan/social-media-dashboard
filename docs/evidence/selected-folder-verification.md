# Selected folder testing and usability follow-up

Date: 2026-10-08. Stakeholder requested testing the four selected Downloads folders, fixing findings, and improving navigation and ease of use.

## Scope and results

Tested `DEBO_s PROJECT DATA`, `DEBO_s PROJECT DATA QA TEMP`, `DEBO_s PROJECT DATA QA TEMP V2`, and `DEBO_s PROJECT DATA QA TEMP V3`. Original files were read only. Imports and fixture campaigns were written exclusively to the existing isolated local test database; current application records were preserved.

| Check                                                       | Result                                               |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| Data files discovered                                       | 27: 25 CSV, one XLSX, one legacy XLS                 |
| Supported files previewed, validated, and confirmed         | 26/26                                                |
| Independent source totals matched filtered analytics totals | 26/26                                                |
| Exact-file duplicate warnings detected after confirmation   | 26/26                                                |
| Legacy LinkedIn XLS                                         | HTTP 400, `IMPORT_FILE_TYPE_UNSUPPORTED`             |
| Real browser upload of QA V3 Views CSV                      | Preview and duplicate notice visible; no page errors |

See [per-file results](selected-folder-test-results.json) and [browser preview](selected-folder-preview.png). Source totals were independently summed from CSV numeric columns and mapped workbook raw count columns, then compared with campaign-filtered analytics responses. Missing unrelated metrics remained null. The email workbook's six rows were deliberately mapped to one isolated fixture campaign, producing four calendar-date records; this checks same-day aggregation, not preservation of separate business campaigns. Each other file used its own fixture campaign, so this run does not establish cross-file merge or append correctness. The brief text file was not treated as import data.

The browser used the running development frontend with requests directed to the isolated API. An initial harness used the wrong heading, and its subsequent request interception corrupted a binary multipart upload. The corrected harness changed only the request URL through a browser fetch wrapper, preserving native multipart bytes; the final upload passed. Those harness failures are not application parser regressions. Temporary testing scripts and API processes were removed after verification.

## Bounded usability changes

Followed the existing domain model, metric catalogue, permissions, and local operating restrictions. Used the stakeholder's improvement brief as context for this bounded follow-up; no new import formats or transformation architecture were introduced.

- Workspace navigation: visible Menu on mobile, expandable role-appropriate navigation, active-page accessibility state, keyboard skip link, and descriptive profile/target titles. URL fragments retain the selected screen across refresh and support browser Back/Forward.
- Import workflow: step links to upload, preview, mapping, and validation; labeled file selection; 10 MB guidance; actionable legacy-XLS conversion instructions; clarification of distinct social metrics and campaign/platform context.
- Import integrity: confirmation requires validation of the current configuration. Editing mappings, names, worksheet, campaign/platform context, or dataset action requires revalidation. Failed validation also invalidates prior confirmation readiness.
- Campaign empty state now directs authorized users to the existing creation action.
- Performance records render 50 rows at a time with Previous/Next controls and a visible record count. Search and date filters operate across all loaded records and return to the first page. A deterministic 105-record browser case covers page boundaries and a match on the last page.

Files changed: workspace shell, import UI, campaign UI, performance UI, global styles, browser regression coverage, user/import guides, and this evidence. No schema migration, dependency upgrade, backend authorization, or KPI formula changes.

## Verification

- `pnpm --filter @smd/web lint` and `pnpm --filter @smd/web typecheck` passed after the UI changes.
- Browser regressions cover mobile screen switching, Back/Forward, refresh retention, legacy-XLS guidance, and confirmation invalidation after editing the import configuration, in addition to the existing critical journeys.
- The first usability E2E run passed six journeys and exposed two outdated assertions: an ambiguous profile heading selector and an expectation that refresh resets Settings to Overview. These assertions were updated to the intended behavior before the final rerun.
- The next run passed seven journeys; the full authenticated journey timed out at the performance context selector after the isolated database received the real exports. Pagination was added to bound table rendering, with a dedicated regression. The API still loads the full record list; this is frontend pagination, not server pagination.
- The pagination rerun passed eight of nine journeys and completed the formerly slow record workflow. Its remaining failure was an ambiguous alert selector matching both the legacy-XLS notice and Next.js's route announcer. The assertion now selects the relevant notice by its text.
- Final production build, browser suite, documentation formatting, and whitespace results are recorded in the implementation progress entry.
- Final rerun: `pnpm --filter @smd/api test:e2e` passed the production Next.js build and all nine browser journeys (1.1 minutes). Web lint/typecheck, documentation formatting, and `git diff --check` also passed. No backend unit suite was rerun for these frontend-only changes; the real-file API checks and browser suite provide integration coverage for the affected flows.

## Limitations

Legacy XLS remains unsupported. Convert it with Excel or LibreOffice to CSV/XLSX, retaining the original; changing its extension alone is not conversion. No LinkedIn metric mapping or analytics claims are made for the rejected file. This follow-up does not claim the entire improvement brief has been implemented. The stakeholder subsequently authorised committing the completed local changes; no remote push is claimed.

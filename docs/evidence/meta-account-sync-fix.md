# Facebook and Instagram account sync repair

Date: 2026-10-19

## Observed failures

- Both existing Meta accounts were discovered and connected, but had no successful analytics update.
- Instagram Graph v26 returned error 100: views and total_interactions require metric_type=total_value.
- Facebook provider reads succeeded, but account ingestion rejected content observations without available metrics. The provider adapters intentionally preserve such posts with missing measurements.
- The application database contained no FACEBOOK_ORGANIC or INSTAGRAM_ORGANIC metric definitions, causing the subsequent unsupported-provider-metric validation error.
- Live Facebook insights returned is_from_ads directly on each value as strings 0 and 1, with start_time and end_time. The parser previously only recognized nested breakdown forms.

## Changes

- Instagram requests one calendar-day interval at a time with metric_type=total_value, storing only returned totals for that day. Missing values remain unavailable.
- Connected-account ingestion accepts metadata-only content observations for Facebook and Instagram. Account metric observations and other providers retain their existing validation requirements.
- Facebook explicitly recognizes top-level paid/organic indicators, includes the final selected day in its request window, and uses supplied start_time labels when available.
- Updated the existing Instagram golden payload to match the live total_value response format.
- Inserted the 11 missing Meta definitions from the repository's existing canonical seed catalogue into the local application database, transactionally and with conflict-do-nothing semantics. No existing definitions, user records, imported files, credentials, or schema were replaced.

## Verification

- Live read-only diagnostic requests confirmed the Instagram request correction and Facebook response shapes without logging tokens.
- API typecheck and changed-file formatting passed.
- Instagram was synced through the authenticated application for September 20 through October 19, 2026: update current, 91 metric observations including its audience snapshot, 14 content items, 172 followers, 546 views, 181 accounts reached and 19 interactions. Its chart and content table populated.
- Automated suites were not run for this repair. No migration or credential rotation was required.

- Final Facebook application sync also completed: update current, 60 metric observations including its audience snapshot, 14 content items, 662 followers, 4,377 organic content views and 176 Page visits. The organic chart and ranked content table populated.

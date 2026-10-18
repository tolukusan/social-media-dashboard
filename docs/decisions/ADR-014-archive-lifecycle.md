# ADR-014: Administrator archive lifecycle

Status: approved by stakeholder task, 2026-10-18.

Campaigns and daily performance records support Archive → Restore → permanent Delete. This supersedes archive-only policy solely for these entities. Legacy DELETE endpoints still archive. There is no purge schedule or waiting period.

Normal analytics require an active record and an unarchived parent campaign. Parent archive does not mutate child status. Record restoration requires a restored parent. Unknown historical archive dates remain unknown; only audit-backed dates are backfilled.

Permanent deletion requires an archived entity, current Administrator authority, a five-minute actor-bound hash-only confirmation, exact typed identity, and an unchanged dependency fingerprint. All campaign writers acquire the deployment-wide campaign-lifecycle transaction advisory lock before context locks. This deliberately serializes writes for correctness in the single-organization deployment. Transactions delete metric values, records, campaign targets, platform links, channel links, then the campaign. Restrictive foreign keys remain.

Import batches, rows, duplicate-file history, and audit entries are retained. A deleted daily-key tombstone prevents automatic ingestion/import from recreating deleted data; deliberate manual entry is a separate action. Existing integration mappings block deletion. Administrators can explicitly remove a mapping only when its connection is not running a sync. Removal retains records and audits detachment. Ingestion rechecks mapping, parent state, and tombstones under the same lock, so captured stale sync state cannot write after removal.

Confirmation records and tombstones intentionally have no entity foreign keys because they must survive deletion. Token references never enter audit metadata. Database rollback protects every failed confirmation or dependency check.

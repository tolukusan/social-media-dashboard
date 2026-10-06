# Benchmark Delta and Amendment Register

**Version:** 0.1  
**Status:** Draft  
**Phase:** Step 6.5

## 1. Amendment Policy

Do not regenerate approved Steps 1–6.

Apply amendments only when:

1. benchmark evidence exposes a genuine design risk
2. the amendment preserves approved MVP scope
3. the change is small and traceable
4. affected files can be patched directly
5. the amendment is approved before Step 7 freezes AI instructions

Each amendment receives an ID and lists exactly which approved documents would change.

---

# 2. Proposed Amendments

## A-001 — Metric Aggregation Metadata

**Priority:** Medium  
**Type:** Structural metadata, no new feature  
**Benchmark basis:** Mature systems explicitly configure aggregation semantics.

### Proposed Change

Extend logical MetricDefinition with:

```text
aggregationStrategy
```

Initial supported metadata:

```text
SUM
WEIGHTED_AVERAGE
FIRST
LAST
DERIVED
```

For weighted metrics, the KPI catalogue still defines the weight metric.

### Affected Documents

- Step 2 `docs/architecture/domain-model.md`
- Step 2 `docs/architecture/erd.md`
- Step 4 `docs/analytics/kpi-catalog.md`

### Does it change user scope?

No.

### Does it require new UI?

No.

### Recommendation

**ACCEPT.**

---

## A-002 — Future DataSource / IntegrationConnection Boundary

**Priority:** High for future extensibility, zero MVP runtime impact  
**Type:** Future architecture seam

### Proposed Change

Add a deferred/future entity concept:

```text
Platform
  1 ── * DataSource
```

Possible future fields:

```text
id
platformId
displayName
externalAccountId
timezone
status
credentialReference
lastSyncAt
```

Credentials themselves must not be stored casually in plaintext database fields.

### Affected Documents

- Step 2 `docs/architecture/domain-model.md` under deferred/future entities
- Step 5 `docs/architecture/architecture.md` future integration boundary

### Does it change MVP schema?

No.

### Recommendation

**ACCEPT as documentation-only future seam.**

---

## A-003 — Structured CSV/Spreadsheet Import as Future Enhancement

**Priority:** Medium  
**Type:** Future feature

### Proposed Change

Add:

- CSV import
- spreadsheet import

to optional/future data-ingestion scope.

### Affected Documents

- Step 1 `docs/product/scope.md`
- Step 5 `docs/architecture/architecture.md` future ingestion notes
- Step 8 roadmap, later

### Does it change MVP?

No.

### Recommendation

**ACCEPT as future scope only.**

---

## A-004 — Per-Data-Source Timezone for Future Integrations

**Priority:** Medium  
**Type:** Future data-integration semantics

### Proposed Change

When DataSource is eventually implemented, allow it to carry source timezone metadata.

The MVP continues to use one deployment reporting timezone.

### Affected Documents

- Step 5 `docs/architecture/architecture.md`
- future integration ADR only when implementation begins

### Recommendation

**ACCEPT as future rule.**

---

# 3. Benchmark Ideas Explicitly Rejected for the MVP

The following mature-system features are useful but should **not** be pulled into the project merely because competitors have them:

## R-001 — User-Defined Formula Builder

Rejected for MVP.

Reason:

- introduces formula parsing/validation complexity
- changes academic scope
- increases test surface

## R-002 — User-Configurable Dashboard Builder

Rejected for MVP.

Reason:

- not required
- fixed dashboard satisfies project objectives
- substantial drag/drop/configuration work

## R-003 — Report Designer / Template Builder

Rejected for MVP.

Reason:

- one polished report design is sufficient
- document editor functionality is out of scope

## R-004 — Scheduled/Automated Email Reports

Rejected for MVP.

Already identified as future enhancement in original brief.

## R-005 — Multi-Tenant Client Accounts

Rejected for MVP.

One organisation per deployment remains intentional.

## R-006 — Live Integration Accounts

Rejected for MVP implementation.

Only the architectural seam should be preserved.

## R-007 — Alerts / Notifications

Rejected for MVP unless the academic requirements change.

## R-008 — AI-Generated Analysis

Rejected for MVP.

Already future scope.

---

# 4. Existing Decisions Validated by Benchmark

No change required for:

- first-class MetricDefinition
- channel/platform separation
- KPI targets
- favorable direction
- target scopes
- date filtering
- period comparison
- reusable dashboard visualisation components
- PDF reports
- read-only management role
- central analytics calculation layer
- raw metric source of truth
- API-ready manual-first ingestion
- single-organisation MVP

---

# 5. Patch Workflow

If Step 6.5 is approved:

1. create one patch version of each affected document only
2. increment affected files from `v1.0` to `v1.1`
3. add a short `Change Log` section
4. leave unaffected files untouched
5. produce one consolidated `steps1-6_baseline_v1.1.zip`
6. begin Step 7 using the patched baseline

There is **no reason to regenerate the entire documentation set**.

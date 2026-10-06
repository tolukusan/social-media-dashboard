# Implementation Review Template

**Task / Milestone:**  
**Reviewer Mode:** Requirements + Architecture + Security + Tests

## 1. Verdict

Choose one:

```text
APPROVE
APPROVE WITH MINOR FIXES
CHANGES REQUIRED
BLOCKED BY DESIGN QUESTION
```

## 2. Requirement Compliance

Check against task acceptance criteria and referenced requirement IDs.

## 3. Architecture Compliance

Check:

- correct module ownership
- no frontend database access
- no duplicated analytics/business logic
- no unapproved dependencies/infrastructure
- no unrelated refactor

## 4. Data Integrity

Check:

- schema constraints
- migrations
- referential integrity
- archive/history rules
- uniqueness rules
- transactional writes

## 5. Authorization / Security

Check:

- correct roles
- backend enforcement
- validation
- sensitive data
- session/security implications
- CSRF/CORS implications where applicable

## 6. Analytics Correctness

When relevant:

- formula
- aggregation
- zero denominator
- missing data
- filters
- archived-record exclusion
- target resolution

## 7. Tests

Check:

- positive case
- negative case
- validation case
- authorization case
- integration case
- golden calculation case where relevant

## 8. Findings

### Blockers

### High

### Medium

### Low

## 9. Verified Good Behaviour

List what is demonstrably correct.

## 10. Required Follow-Up

Only list changes actually needed for approval.

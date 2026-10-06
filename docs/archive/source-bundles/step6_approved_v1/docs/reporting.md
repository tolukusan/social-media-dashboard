# Reporting Specification

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Reporting Specification  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 6

## 1. MVP Reporting Goal

Users shall generate a filtered performance report and export it as PDF.

Reports are generated on demand and are not required to persist as first-class Report database records.

---

# 2. Report Inputs

Supported report filters:

- date / reporting period
- campaign
- channel
- platform
- KPI where applicable

Filters shall use the same semantics as dashboard/analytics filters.

---

# 3. Report Content

A PDF report should include:

1. report title
2. generation date/time
3. reporting period
4. active filter summary
5. relevant KPI summary
6. relevant target status where applicable
7. summary statistics
8. period/channel/campaign comparisons where applicable
9. selected charts
10. concise data notes when metrics have known aggregation caveats

---

# 4. Calculation Source

The report service shall call the same Analytics/KPI services used by the dashboard.

Forbidden pattern:

```text
Dashboard formula implementation
Report formula implementation
```

Approved pattern:

```text
                 AnalyticsService
                /                \
         Dashboard              Report
```

---

# 5. PDF Generation

The PDF generation library shall be selected based on:

- reliable deployment in the chosen host
- ability to render charts/tables
- maintainable templates
- reasonable binary/runtime overhead
- testability

Two acceptable approaches:

- HTML template + headless browser PDF rendering
- server-side PDF document library

The final choice will be made during implementation planning after the actual deployment platform is known.

---

# 6. Report Security

- authenticated access only
- role-based report scope
- no anonymous permanent links
- sanitised filename
- no arbitrary filesystem path input
- clean up temporary files
- do not include hidden/internal fields

---

# 7. Report Filename

Recommended pattern:

```text
marketing-performance-report_YYYY-MM-DD_to_YYYY-MM-DD.pdf
```

Optional campaign/channel label may be included after sanitisation.

---

# 8. CSV

CSV is optional and must not delay the required PDF implementation.

If added later:

- use tabular raw/aggregated values
- maintain the same filter semantics
- do not attempt to embed charts

---

# 9. Reporting Tests

Must verify:

- filter accuracy
- KPI accuracy
- report period
- generation date
- authorization
- PDF content type
- safe filename
- no formula divergence from AnalyticsService


# 10. Step 6 Reporting Approval Status

**Approved v1.0.**

PDF is the required MVP export format. PDF rendering technology remains an implementation-level choice constrained by the approved deployment environment and must reuse the shared Analytics/KPI calculation services.

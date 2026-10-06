# Historical health-load evidence

The retained k6-health-summary.json is the pre-existing 25-VU, 10-second health-only summary, moved unchanged on 2026-10-05. Original run date was not retained; the move date is not a new test run. It does not establish authenticated application performance acceptance.

Original command: `k6 run performance/k6-health.js --summary-export performance/k6-health-summary.json`. Future transient output must use an ignored runtime location; F11 owns the realistic application workload.

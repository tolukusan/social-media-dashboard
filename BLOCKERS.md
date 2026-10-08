# Current blockers

- **F06a deployment currency:** The application formats configured report currency correctly, but the deploying organisation must supply the approved `REPORTING_CURRENCY` value. Do not infer one.
- **Password-recovery delivery:** The recovery flow and SMTP adapter are implemented, but real inbox delivery requires an authorised SMTP provider/sender and credentials outside the repository.
- **F11 participant evidence:** The usability tasks are prepared, but actual participant feedback requires real participants and must not be fabricated.
- **F09 visual evidence:** PDFKit rendering, pagination/wrapping, vector trend chart, and extended-character font support are implemented; a human visual review of a deliberately long PDF in the target environment remains evidence work.
- **F00 import provenance:** Original import scope-promotion approval was not found in active plans/ADRs. Preserve the existing import feature and formats; do not expand scope from this uncertainty.
- **M12 external deployment:** No authorised external deployment environment has been supplied. The deployment runbook is prepared, but no deployment is claimed.
  Resolved during TODO completion: package installation/lockfile updates for Tailwind, Recharts, and PDFKit; own-password policy; strict Origin enforcement for unsafe methods; and deterministic `NO_DATA` precedence.

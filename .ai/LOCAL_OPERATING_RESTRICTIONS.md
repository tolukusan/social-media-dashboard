# Local operating restrictions

Preserved non-sensitive restrictions from the original bootstrap instructions; project documentation wins over process guidance.

- Inspect relevant guidance in `C:/Users/user/Documents/engineering-playbook` read-only. Never modify the playbook or unrelated workspace files.
- Preserve source bundles and unknown user files. Do not use `git reset --hard`, `git clean -fdx`, force push or rewrite history.
- Preserve local PostgreSQL data. Never reset/drop the `postgres` database, unrelated schemas, run `prisma migrate reset` or force-reset operations. Migrations require approved, non-destructive plans. Application objects use the explicit application schema; integration tests require a genuinely isolated target.
- Keep environment values local and ignored. Use placeholders in `.env.example`; never print, archive or commit credentials. Do not rotate credentials as a repository reorganisation action.
- Redis/Memurai availability does not authorise use. Do not change Windows services, registry, execution policy, firewall or global database/server settings.
- Install dependencies project-locally with pnpm; retain one lockfile. No random global installs or major upgrades without task authorisation.
- Preserve the approved blue-accent SaaS visual direction: white/off-white surfaces, restrained borders/shadows, sidebar, compact utility bar, clear KPI hierarchy, readable tables/charts; green/red/amber indicate success/error/warning. Campaigns are table-oriented, performance entry is workflow-oriented, analytics/reports are data-oriented.
- No external deployment, paid services, purchases or email/messages without explicit authorisation.
- Continue safe, justified independent tasks without routine approval. Record concise genuine blockers; never fake prerequisites or invent metric/security/domain policy. Verify meaningful coherent slices and update evidence honestly.

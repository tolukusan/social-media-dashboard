-- Only recover timestamps backed by audit evidence. Unknown dates remain null.
UPDATE social_media_dashboard."PerformanceRecord" r SET "archivedAt" = a.at
FROM (SELECT "entityId", max("createdAt") AS at FROM social_media_dashboard."AuditLog"
WHERE "entityType" = 'PerformanceRecord' AND action = 'ARCHIVE' GROUP BY "entityId") a
WHERE r.id::text = a."entityId" AND r.status = 'ARCHIVED' AND r."archivedAt" IS NULL;

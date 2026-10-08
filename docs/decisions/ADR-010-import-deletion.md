# ADR-010: Delete uncommitted import staging

Date: 2026-10-08. Status: implemented for the stakeholder's request to delete an import.

## Decision

Administrators may permanently delete uncommitted import batches and their staged rows through `DELETE /api/v1/imports/:id`. Marketing Officers and Management may not delete imports. Existing cookie session, Origin, and CSRF enforcement applies.

Completed imports are retained as provenance, including completed merges that may have added metrics to records owned by a different import batch. Processing imports and batches referenced by any active or archived performance record are also protected. The endpoint returns HTTP 409 for protected imports and HTTP 404 for missing imports.

Deletion locks the batch row, checks protection, deletes only that batch's staging rows and batch, and records `IMPORT_DELETED` for the acting Administrator within one transaction. Audit failure rolls back the deletion. No performance records or metric values are deleted. No schema migration is needed.

## User workflow

Import history exposes **Delete import** for eligible batches. A keyboard-accessible in-app dialog offers Cancel and explicit permanent deletion. Upload refreshes history; deleting the current preview clears it. Completed and processing rows show retention/processing text.

## Consequences

Deleting unfinished staging allows the same file to be staged again. Completed-file duplicate detection remains intact. This is a bounded cleanup feature, not a normal hard-delete workflow for analytical data. The earlier stakeholder-authorized database cleanup was a separate local maintenance action.

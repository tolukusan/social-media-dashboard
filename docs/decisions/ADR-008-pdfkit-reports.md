# ADR-008: Server-side PDFKit reports

Date: 2026-10-07. Status: accepted implementation choice under F09; stakeholder authorised the review follow-up.

## Context

F09 requires filtered, authenticated PDF reports with shared backend KPI values, wrapped labels, pagination, charts and non-ASCII text. The remote continuation introduced PDFKit but did not record the renderer tradeoffs or test the rendered output. The application remains a NestJS modular monolith.

## Decision

Retain PDFKit in the API. ReportsService assembles AnalyticsService results; the renderer only formats values and lays out text and vector chart paths. Generate an in-memory buffer per request without persistent reports or public links.

Use an operator-configured `REPORT_FONT_PATH` when supplied, otherwise a locally available DejaVu Sans or Windows Arial font. This path is deployment configuration, never API input. Hosts must provision and license a font covering their required characters; a font being present does not imply coverage of every writing system. The built-in font fallback carries an explicit extended-character configuration note.

Use Mozilla PDF.js as a development-only parser for regression tests: extracted values, Unicode, page count, text bounds and vector drawing. It does not enter the production build or replace human visual inspection.

## Consequences

- Avoid a production Chromium installation and its operational overhead.
- Keep chart gaps and values sourced from backend results; no alternative KPI formulas.
- Maintain explicit page/text cursor handling and tests for content following charts and long rows.
- Memory use scales with report size; approved bounded API inputs and the separate PDF load scenario remain relevant.
- Test font coverage and inspect a long report in the authorised deployment environment before claiming final visual acceptance.

No schema or business-policy change is introduced.

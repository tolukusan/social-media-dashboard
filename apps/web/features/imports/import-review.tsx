'use client';
import type { Result } from './import-types';

export function ImportReview({ result }: { result: Result }) {
  const issues = new Map<string, number>();
  for (const row of result.rows)
    for (const issue of row.errors) {
      issues.set(issue.message, (issues.get(issue.message) ?? 0) + 1);
    }
  return (
    <>
      <div className="import-summary" aria-label="Import summary">
        <span>File rows: {result.totalRows}</span>
        <span>Accepted: {result.acceptedRows}</span>
        <span>Daily records: {result.summary.dailyRecords}</span>
        <span>Unchanged records: {result.summary.unchangedRecords}</span>
        <span>Excluded/conflicting rows: {result.rejectedRows}</span>
      </div>
      <p>
        File rows for the same campaign, platform, and date may combine into one
        daily record. Existing equal metric values remain unchanged.
      </p>
      {issues.size > 0 && (
        <div className="notice error">
          <strong>These rows will be excluded:</strong>
          <ul>
            {[...issues].map(([message, count]) => (
              <li key={message}>
                {message} ({count} rows)
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.warningCount > 0 && (
        <p>
          {result.warningCount} warnings. Review row details below before
          importing.
        </p>
      )}
      {result.status !== 'READY' && (
        <p role="status">No rows are ready. Go back to fix the details.</p>
      )}
      <details className="import-disclosure">
        <summary>Review row details</summary>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Validation results</caption>
            <thead>
              <tr>
                <th>Row</th>
                <th>Status</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.sourceRowNumber}>
                  <th>{row.sourceRowNumber ?? '—'}</th>
                  <td>{row.status}</td>
                  <td>
                    {[...row.errors, ...row.warnings]
                      .map((issue) => issue.message)
                      .join(' ') || 'Ready'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

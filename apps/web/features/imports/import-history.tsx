'use client';
import type { HistoryItem } from './import-types';
export function ImportHistory({
  history,
  canDelete,
  busy,
  onDelete,
}: {
  history: HistoryItem[];
  canDelete: boolean;
  busy: boolean;
  onDelete: (item: HistoryItem, trigger: HTMLButtonElement) => void;
}) {
  return (
    <section className="panel page-panel">
      <div className="panel-heading">
        <div>
          <h2 id="import-history-title" tabIndex={-1}>
            Import history
          </h2>
          <p>
            Staged and completed files remain traceable by checksum and user.
          </p>
          {canDelete && (
            <p>
              You can delete staged, rejected, or failed imports. Completed
              imports are retained for provenance.
            </p>
          )}
        </div>
      </div>
      {history.length ? (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Import history</caption>
            <thead>
              <tr>
                <th>File</th>
                <th>Source</th>
                <th>Imported by</th>
                <th>Rows</th>
                <th>Status</th>
                <th>Date</th>
                {canDelete && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <th>
                    {item.displayName || item.originalFilename}
                    <small className="table-secondary">
                      {item.originalFilename}
                    </small>
                  </th>
                  <td>{item.sourcePlatform || 'Generic'}</td>
                  <td>{item.importedByUser?.name || '—'}</td>
                  <td>
                    {item.acceptedRows}/{item.totalRows} accepted
                  </td>
                  <td>
                    <span
                      className={`status ${item.status === 'FAILED' || item.status === 'REJECTED' ? 'inactive' : ''}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td>{item.createdAt.slice(0, 10)}</td>
                  {canDelete && (
                    <td>
                      {['COMPLETED', 'IMPORTING'].includes(item.status) ? (
                        <span>
                          {item.status === 'COMPLETED'
                            ? 'Retained for provenance'
                            : 'Processing'}
                        </span>
                      ) : (
                        <button
                          className="secondary danger"
                          disabled={busy}
                          onClick={(event) => {
                            onDelete(item, event.currentTarget);
                          }}
                        >
                          Delete import
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-table">No imports yet.</div>
      )}
    </section>
  );
}

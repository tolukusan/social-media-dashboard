'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, invalidateWorkspace } from '../../lib/api-client';
type Item = {
  id: string;
  name?: string;
  status?: string;
  archivedAt: string | null;
  recordDate?: string;
  campaignPlatform?: {
    platform: { name: string };
    campaignChannel: { campaign: { name: string; archivedAt: string | null } };
  };
};
type Preview = {
  identity: { id: string; name: string };
  counts: Record<string, number>;
  blockers: Array<{
    mappingId: string;
    connectionName: string;
    message: string;
  }>;
  retainedImportIds: string[];
  typedText: string;
  confirmationReference: string | null;
  expiresAt: string;
};
export function Archive() {
  const [kind, setKind] = useState<'campaigns' | 'records'>('campaigns');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['archive', kind],
    queryFn: () => apiRequest<Item[]>(`/archive/${kind}`),
  });
  useEffect(() => {
    if (preview) dialog.current?.showModal();
  }, [preview]);
  async function act(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    try {
      await task();
      setMessage(success);
      await queryClient.invalidateQueries({ queryKey: ['archive'] });
      await invalidateWorkspace(queryClient);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The action could not complete.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel page-panel">
      <h2>Archive</h2>
      <p>
        Archived data is excluded from campaign analytics. Restore it, or review
        its dependencies before permanent deletion. Import provenance and audit
        history are retained.
      </p>
      <div className="account-actions" role="group" aria-label="Archive type">
        {(['campaigns', 'records'] as const).map((value) => (
          <button
            key={value}
            className={kind === value ? 'primary' : 'secondary'}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              setSearch('');
            }}
          >
            {value === 'campaigns' ? 'Campaigns' : 'Performance records'}
          </button>
        ))}
      </div>
      <label>
        Search Archive
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {error && !preview && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {query.isPending && <p role="status">Loading Archive…</p>}
      {query.error && (
        <p role="alert">
          Could not load Archive.{' '}
          <button onClick={() => void query.refetch()}>Try again</button>
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Archive state</th>
              <th>Archived</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? [])
              .filter((item) =>
                JSON.stringify([item.name, item.id, item.campaignPlatform])
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((item) => {
                const parent = item.campaignPlatform?.campaignChannel.campaign;
                const individuallyArchived =
                  kind === 'campaigns' || item.status === 'ARCHIVED';
                return (
                  <tr key={item.id}>
                    <th scope="row">
                      {item.name ??
                        `${parent?.name} · ${item.recordDate?.slice(0, 10)} · ${item.campaignPlatform?.platform.name}`}
                      <small className="archive-id">{item.id}</small>
                    </th>
                    <td>
                      {individuallyArchived
                        ? 'Individually archived'
                        : 'Hidden by archived campaign'}
                      {parent?.archivedAt && (
                        <small>Restore the campaign first.</small>
                      )}
                    </td>
                    <td>
                      {item.archivedAt
                        ? new Date(item.archivedAt).toLocaleString()
                        : 'Archive date unavailable'}
                    </td>
                    <td>
                      <div className="account-actions">
                        <button
                          className="secondary"
                          disabled={
                            busy ||
                            !individuallyArchived ||
                            Boolean(parent?.archivedAt)
                          }
                          onClick={() =>
                            void act(
                              () =>
                                apiRequest(
                                  `/archive/${kind}/${item.id}/restore`,
                                  { method: 'POST' },
                                ),
                              'Item restored.',
                            )
                          }
                        >
                          Restore
                        </button>
                        <button
                          className="secondary"
                          disabled={busy || !individuallyArchived}
                          onClick={() =>
                            void act(async () => {
                              const result = await apiRequest<Preview>(
                                `/archive/${kind}/${item.id}/deletion-preview`,
                                { method: 'POST' },
                              );
                              setTyped('');
                              setPreview(result);
                            }, 'Deletion preview prepared.')
                          }
                        >
                          Review deletion
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {query.data?.length === 0 && (
        <p>
          No archived{' '}
          {kind === 'campaigns' ? 'campaigns' : 'performance records'}.
        </p>
      )}
      {preview && (
        <dialog
          ref={dialog}
          className="archive-dialog"
          onCancel={() => setPreview(null)}
          aria-labelledby="deletion-title"
        >
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <h2 id="deletion-title">Review permanent deletion</h2>
          <p>{preview.identity.name}</p>
          <ul>
            {Object.entries(preview.counts).map(([key, value]) => (
              <li key={key}>
                {(
                  {
                    performanceRecords: 'Performance records',
                    metricValues: 'Metric values',
                    campaignTargets: 'Campaign targets',
                    campaignChannels: 'Campaign channels',
                    campaignPlatforms: 'Campaign platforms',
                  } as Record<string, string>
                )[key] ?? key}
                : {value}
              </li>
            ))}
          </ul>
          <p>
            Import batches, source rows, and audit history will remain. This
            action cannot be undone.
          </p>
          {preview.blockers.map((blocker) => (
            <p className="notice error" key={blocker.mappingId}>
              {blocker.connectionName}: {blocker.message}{' '}
              <a href="/#integrations">Open Connections</a>
            </p>
          ))}
          <p>
            Preview expires: {new Date(preview.expiresAt).toLocaleTimeString()}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void act(async () => {
                await apiRequest(
                  `/archive/${kind}/${preview.identity.id}/permanent`,
                  {
                    method: 'DELETE',
                    body: {
                      confirmationReference: preview.confirmationReference,
                      typedText: typed,
                    },
                  },
                );
                setPreview(null);
              }, 'Item permanently deleted. Import provenance and audit retained.');
            }}
          >
            <label>
              Type {preview.typedText} to confirm
              <input
                autoFocus
                value={typed}
                autoComplete="off"
                onChange={(event) => setTyped(event.target.value)}
              />
            </label>
            <div className="account-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setPreview(null)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  !preview.confirmationReference ||
                  typed !== preview.typedText
                }
              >
                Permanently delete
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}

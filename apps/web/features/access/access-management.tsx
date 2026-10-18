'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { UserRole } from '../../lib/workspace-types';
type Request = { id: string; name: string; email: string; status: string };
type Invitation = {
  id: string;
  email: string;
  roleId: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};
export function AccessManagement({ onChanged }: { onChanged: () => void }) {
  const client = useQueryClient();
  const [roleId, setRoleId] = useState('');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['access-management'],
    queryFn: async () => {
      const [requests, invitations, roles] = await Promise.all([
        apiRequest<Request[]>('/access/requests'),
        apiRequest<Invitation[]>('/access/invitations'),
        apiRequest<UserRole[]>('/users/roles'),
      ]);
      return { requests, invitations, roles };
    },
  });
  const chosenRole =
    roleId ||
    query.data?.roles.find((role) => role.code === 'MANAGEMENT')?.id ||
    query.data?.roles[0]?.id ||
    '';
  async function act(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    try {
      await task();
      onChanged();
      setMessage(success);
      await client.invalidateQueries({ queryKey: ['access-management'] });
      await client.invalidateQueries({ queryKey: ['users'] });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not complete action.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel page-panel">
      <h2>Access requests and invitations</h2>
      <p>
        Review public applications and invite people into this organization.
        Invitations expire in seven days. Deliver the link manually to the
        intended recipient.
      </p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {query.isPending && <p role="status">Loading access management…</p>}
      {query.error && (
        <p role="alert">
          Could not load requests.{' '}
          <button onClick={() => void query.refetch()}>Try again</button>
        </p>
      )}
      <label>
        Role for approval or invitation
        <select
          value={chosenRole}
          onChange={(event) => setRoleId(event.target.value)}
        >
          {query.data?.roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <div className="table-scroll">
        <table>
          <caption>Registration requests</caption>
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Status</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.requests.map((request) => (
              <tr key={request.id}>
                <th scope="row">
                  {request.name}
                  <small className="archive-id">{request.email}</small>
                </th>
                <td>{request.status}</td>
                <td>
                  {request.status === 'PENDING' && (
                    <div className="account-actions">
                      <button
                        className="secondary"
                        disabled={busy || !chosenRole}
                        onClick={() =>
                          void act(
                            () =>
                              apiRequest(
                                `/access/requests/${request.id}/review`,
                                {
                                  method: 'POST',
                                  body: {
                                    decision: 'APPROVED',
                                    roleId: chosenRole,
                                  },
                                },
                              ),
                            'Applicant approved. They can now sign in.',
                          )
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              apiRequest(
                                `/access/requests/${request.id}/review`,
                                {
                                  method: 'POST',
                                  body: { decision: 'REJECTED' },
                                },
                              ),
                            'Application rejected.',
                          )
                        }
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setLink('');
          void act(async () => {
            const result = await apiRequest<{ invitationUrl: string }>(
              '/access/invitations',
              { method: 'POST', body: { email, roleId: chosenRole } },
            );
            setLink(result.invitationUrl);
            setEmail('');
          }, 'Invitation created. Copy the link for manual delivery.');
        }}
      >
        <label>
          Invitation email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button className="primary" disabled={busy || !chosenRole}>
          Create invitation
        </button>
      </form>
      {link && (
        <div className="notice">
          <label>
            Invitation link
            <input readOnly value={link} />
          </label>
          <button
            className="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(
                () => setMessage('Invitation link copied.'),
                () => setError('Select and copy the invitation link manually.'),
              );
            }}
          >
            Copy link
          </button>
          <button className="secondary" onClick={() => setLink('')}>
            Hide link
          </button>
        </div>
      )}
      <ul>
        {query.data?.invitations.map((invitation) => (
          <li key={invitation.id}>
            {invitation.email} ·{' '}
            {invitation.usedAt
              ? 'Accepted'
              : invitation.revokedAt
                ? 'Revoked'
                : new Date(invitation.expiresAt) <= new Date()
                  ? 'Expired'
                  : 'Pending'}{' '}
            · expires {new Date(invitation.expiresAt).toLocaleDateString()}{' '}
            {!invitation.usedAt && !invitation.revokedAt && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      apiRequest(
                        `/access/invitations/${invitation.id}/revoke`,
                        { method: 'POST' },
                      ),
                    'Invitation revoked.',
                  )
                }
              >
                Revoke invitation
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

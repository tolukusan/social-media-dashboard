'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, invalidateWorkspace } from '../../lib/api-client';
import type { CurrentUser } from '../../lib/workspace-types';
import type { Campaign, Channel } from './import-types';

export function CreateImportCampaign({
  initialName,
  suggestedStartDate,
  currentUser,
  channels,
  preferredPlatformId,
  onClose,
  onCreated,
}: {
  initialName: string;
  suggestedStartDate: string;
  currentUser: CurrentUser | null;
  channels: Channel[];
  preferredPlatformId: string;
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}) {
  const queryClient = useQueryClient();
  const preferredChannel = channels.find((channel) =>
    channel.platforms.some((platform) => platform.id === preferredPlatformId),
  );
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState(suggestedStartDate);
  const [endDate, setEndDate] = useState('');
  const [channelId, setChannelId] = useState(preferredChannel?.id ?? '');
  const [platformId, setPlatformId] = useState(preferredPlatformId);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const operation = useRef(false);
  const selectedChannel = channels.find((channel) => channel.id === channelId);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (operation.current) return;
    operation.current = true;
    setSaving(true);
    setError('');
    try {
      const data = await apiRequest<Campaign>('/campaigns', {
        method: 'POST',
        body: {
          name,
          startDate,
          endDate: endDate || undefined,
          responsibleUserId: currentUser?.id,
          channels: [{ channelId, platformIds: [platformId] }],
        },
      });
      await invalidateWorkspace(queryClient);
      onCreated(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Campaign could not be created.',
      );
    } finally {
      operation.current = false;
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !saving) {
          event.preventDefault();
          onClose();
        }
        if (event.key === 'Tab') {
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <section
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-import-campaign"
      >
        <div className="panel-heading">
          <h2 id="create-import-campaign">Create campaign for this import</h2>
          <button
            className="secondary"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <form className="form-grid" onSubmit={submit}>
          <label>
            Campaign name
            <input
              autoFocus
              required
              minLength={2}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Start date
            <input
              required
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            {suggestedStartDate && (
              <span className="field-help">
                Suggested from the earliest date in this worksheet. Change if
                needed.
              </span>
            )}
          </label>
          <label>
            End date
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label>
            Channel
            <select
              required
              value={channelId}
              onChange={(event) => {
                setChannelId(event.target.value);
                setPlatformId('');
              }}
            >
              <option value="">Select channel</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Platform
            <select
              required
              value={platformId}
              onChange={(event) => setPlatformId(event.target.value)}
            >
              <option value="">Select platform</option>
              {selectedChannel?.platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create and return to import'}
          </button>
        </form>
      </section>
    </div>
  );
}

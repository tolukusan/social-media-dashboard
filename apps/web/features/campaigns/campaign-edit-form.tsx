'use client';

import { useState, type FormEvent } from 'react';
import type { Campaign } from '../../lib/workspace-types';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, invalidateWorkspace } from '../../lib/api-client';

export function CampaignEditForm({
  campaign,
  onSaved,
  onCancel,
}: {
  campaign: Campaign;
  onSaved: (campaign: Campaign) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const budget = String(form.get('budget') ?? '').trim();
    setBusy(true);
    setError('');
    try {
      const updated = await apiRequest<Campaign>(`/campaigns/${campaign.id}`, {
        method: 'PATCH',
        body: {
          name: form.get('name'),
          description: form.get('description') || null,
          objective: form.get('objective') || null,
          targetAudience: form.get('targetAudience') || null,
          startDate: form.get('startDate'),
          endDate: form.get('endDate') || null,
          status: form.get('status'),
          budget: budget ? Number(budget) : null,
          notes: form.get('notes') || null,
        },
      });
      await invalidateWorkspace(queryClient);
      onSaved(updated);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Campaign could not be updated.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="form-grid nested-form" onSubmit={submit}>
      <h3>Edit campaign</h3>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <label>
        Campaign name
        <input
          name="name"
          required
          minLength={2}
          maxLength={180}
          defaultValue={campaign.name}
        />
      </label>
      <label>
        Objective
        <input name="objective" defaultValue={campaign.objective ?? ''} />
      </label>
      <label>
        Target audience
        <input
          name="targetAudience"
          defaultValue={campaign.targetAudience ?? ''}
        />
      </label>
      <label>
        Description
        <textarea
          name="description"
          defaultValue={campaign.description ?? ''}
        />
      </label>
      <label>
        Start date
        <input
          name="startDate"
          type="date"
          required
          defaultValue={campaign.startDate.slice(0, 10)}
        />
      </label>
      <label>
        End date
        <input
          name="endDate"
          type="date"
          defaultValue={campaign.endDate?.slice(0, 10) ?? ''}
        />
      </label>
      <label>
        Status
        <select name="status" defaultValue={campaign.status}>
          <option value="PLANNED">Planned</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </label>
      <label>
        Budget
        <input
          name="budget"
          type="number"
          min="0"
          step="0.01"
          defaultValue={campaign.budget ?? ''}
        />
      </label>
      <label>
        Notes
        <textarea name="notes" defaultValue={campaign.notes ?? ''} />
      </label>
      <p className="field-help">
        Responsible user:{' '}
        {campaign.responsibleUser?.name ?? 'Current assignment'}. Channel and
        platform links stay intact while editing campaign details.
      </p>
      <span>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save campaign'}
        </button>{' '}
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </span>
    </form>
  );
}

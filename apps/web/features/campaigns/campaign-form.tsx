'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Campaign, Channel, CurrentUser } from '../../lib/workspace-types';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, invalidateWorkspace } from '../../lib/api-client';

export function CampaignForm({
  channels,
  currentUser,
  onCreated,
}: {
  channels: Channel[];
  currentUser: CurrentUser | null;
  onCreated: (campaign: Campaign) => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{
    name: string;
    startDate: string;
    endDate: string;
  }>({ defaultValues: { name: '', startDate: '', endDate: '' } });
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const toggleChannel = (channelId: string) => {
    setSelections((current) => {
      if (current[channelId]) {
        const next = { ...current };
        delete next[channelId];
        return next;
      }
      return { ...current, [channelId]: [] };
    });
  };
  const togglePlatform = (channelId: string, platformId: string) => {
    setSelections((current) => {
      const selected = current[channelId] ?? [];
      return {
        ...current,
        [channelId]: selected.includes(platformId)
          ? selected.filter((id) => id !== platformId)
          : [...selected, platformId],
      };
    });
  };
  const submit = handleSubmit(async (values) => {
    setError('');
    try {
      const data = await apiRequest<Campaign>('/campaigns', {
        method: 'POST',
        body: {
          name: values.name,
          startDate: values.startDate,
          endDate: values.endDate || undefined,
          responsibleUserId: currentUser?.id,
          channels: Object.entries(selections).map(
            ([channelId, platformIds]) => ({
              channelId,
              platformIds,
            }),
          ),
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
    }
  });
  return (
    <form className="panel nested-form" onSubmit={submit}>
      <h3>Create campaign</h3>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="form-grid">
        <label>
          Campaign name
          <input
            {...register('name', {
              required: 'Enter a campaign name.',
              minLength: 2,
            })}
          />
        </label>
        <label>
          Start date
          <input
            type="date"
            {...register('startDate', { required: 'Choose a start date.' })}
          />
        </label>
        <label>
          End date
          <input type="date" {...register('endDate')} />
        </label>
      </div>
      <fieldset className="channel-selection">
        <legend>Channels and platforms (optional)</legend>
        <p className="field-help">
          These associations are optional. You can use a campaign only to
          organize imported datasets.
        </p>
        {channels
          .filter((channel) => channel.active !== false)
          .map((channel) => (
            <div key={channel.id} className="channel-option">
              <label>
                <input
                  type="checkbox"
                  checked={channel.id in selections}
                  onChange={() => toggleChannel(channel.id)}
                />{' '}
                {channel.name}
              </label>
              {channel.id in selections && (
                <div className="platform-options">
                  {channel.platforms
                    .filter((platform) => platform.active !== false)
                    .map((platform) => (
                      <label key={platform.id}>
                        <input
                          type="checkbox"
                          checked={
                            selections[channel.id]?.includes(platform.id) ??
                            false
                          }
                          onChange={() =>
                            togglePlatform(channel.id, platform.id)
                          }
                        />{' '}
                        {platform.name}
                      </label>
                    ))}
                </div>
              )}
            </div>
          ))}
      </fieldset>
      <button className="primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating…' : 'Create campaign'}
      </button>
    </form>
  );
}

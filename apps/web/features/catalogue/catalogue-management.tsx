'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Channel } from '../../lib/workspace-types';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, invalidateWorkspace } from '../../lib/api-client';
import { useForm } from 'react-hook-form';

type PlatformForm = { name: string; code: string; channelId: string };
type CatalogueForm = { name: string; code: string; description: string };

export function CatalogueManagement({
  channels,
  onChanged,
}: {
  channels: Channel[];
  onChanged: (channels: Channel[]) => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<PlatformForm>({
    defaultValues: { name: '', code: '', channelId: '' },
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const activeChannels = channels.filter((channel) => channel.active !== false);

  const refresh = async () => {
    const refreshed = await apiRequest<Channel[]>('/channels');
    onChanged(refreshed);
    // The saved catalogue is ready; analytics refresh should not block editing.
    void invalidateWorkspace(queryClient);
  };
  const send = async (path: string, method: 'POST' | 'PATCH', body: object) => {
    setError('');
    setBusy(true);
    try {
      await apiRequest(path, { method, body });
      await refresh();
      setEditingChannel(null);
      setEditingPlatform(null);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Catalogue could not be updated.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const submitPlatform = handleSubmit(async (values) => {
    if (await send('/platforms', 'POST', values)) reset();
  });
  const submitChannel = (event: FormEvent<HTMLFormElement>, id?: string) => {
    event.preventDefault();
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    void send(
      id ? `/channels/${id}` : '/channels',
      id ? 'PATCH' : 'POST',
      values,
    );
  };
  const toggle = async (
    kind: 'channels' | 'platforms',
    id: string,
    active: boolean,
  ) => {
    await send(`/${kind}/${id}`, 'PATCH', { active });
  };

  return (
    <section className="panel page-panel catalogue-screen">
      <div className="panel-heading">
        <div>
          <h2>Channels &amp; Platforms</h2>
          <p>
            Maintain the active marketing catalogue used by campaigns and
            imports.
          </p>
        </div>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <h3>Add channel</h3>
      <form
        className="form-grid catalogue-form"
        onSubmit={(event) => submitChannel(event)}
      >
        <label>
          Channel name
          <input name="name" required minLength={2} maxLength={120} />
        </label>
        <label>
          Channel code
          <input name="code" required minLength={2} maxLength={50} />
        </label>
        <label>
          Description
          <input name="description" maxLength={500} />
        </label>
        <button className="primary" disabled={busy}>
          Add channel
        </button>
      </form>
      <h3>Add platform</h3>
      <form className="form-grid catalogue-form" onSubmit={submitPlatform}>
        <label>
          Platform name
          <input
            {...register('name', { required: true, minLength: 2 })}
            placeholder="LinkedIn"
          />
        </label>
        <label>
          Platform code
          <input
            {...register('code', { required: true, minLength: 2 })}
            placeholder="LINKEDIN"
          />
        </label>
        <label>
          Channel
          <select {...register('channelId', { required: true })}>
            <option value="">Select channel</option>
            {activeChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" disabled={busy || isSubmitting}>
          Add platform
        </button>
      </form>
      <div className="catalogue-list">
        {channels.map((channel) => (
          <article className="catalogue-channel" key={channel.id}>
            <div className="panel-heading">
              <div>
                {editingChannel === channel.id ? (
                  <form
                    className="form-grid"
                    onSubmit={(event) => submitChannel(event, channel.id)}
                  >
                    <label>
                      Channel name
                      <input
                        name="name"
                        defaultValue={channel.name}
                        required
                        minLength={2}
                        maxLength={120}
                      />
                    </label>
                    <label>
                      Channel code
                      <input
                        name="code"
                        defaultValue={channel.code ?? ''}
                        required
                        minLength={2}
                        maxLength={50}
                      />
                    </label>
                    <label>
                      Description
                      <input
                        name="description"
                        defaultValue={channel.description ?? ''}
                        maxLength={500}
                      />
                    </label>
                    <button className="primary" disabled={busy}>
                      Save channel
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setEditingChannel(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <h3>{channel.name}</h3>
                    <small>{channel.code}</small>
                  </>
                )}
                <span
                  className={`status ${channel.active === false ? 'inactive' : ''}`}
                >
                  {channel.active === false ? 'Inactive' : 'Active'}
                </span>
              </div>
              <span>
                <button
                  className="secondary"
                  onClick={() =>
                    setEditingChannel(
                      editingChannel === channel.id ? null : channel.id,
                    )
                  }
                >
                  Edit
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void toggle(
                      'channels',
                      channel.id,
                      channel.active === false,
                    )
                  }
                >
                  {channel.active === false ? 'Reactivate' : 'Deactivate'}
                </button>
              </span>
            </div>
            <div className="catalogue-platforms">
              {channel.platforms.map((platform) => (
                <div className="catalogue-platform" key={platform.id}>
                  {editingPlatform === platform.id ? (
                    <form
                      className="form-grid"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        void send(`/platforms/${platform.id}`, 'PATCH', {
                          name: form.get('name'),
                          code: form.get('code'),
                          description: form.get('description'),
                        });
                      }}
                    >
                      <label>
                        Platform name
                        <input
                          name="name"
                          defaultValue={platform.name}
                          required
                          minLength={2}
                          maxLength={120}
                        />
                      </label>
                      <label>
                        Platform code
                        <input
                          name="code"
                          defaultValue={platform.code ?? ''}
                          required
                          minLength={2}
                          maxLength={50}
                        />
                      </label>
                      <label>
                        Description
                        <input
                          name="description"
                          defaultValue={platform.description ?? ''}
                          maxLength={500}
                        />
                      </label>
                      <button className="primary" disabled={busy}>
                        Save platform
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setEditingPlatform(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <span>
                      {platform.name}
                      <small>{platform.code}</small>
                    </span>
                  )}
                  <span>
                    <span
                      className={`status ${platform.active === false ? 'inactive' : ''}`}
                    >
                      {platform.active === false ? 'Inactive' : 'Active'}
                    </span>
                    <button
                      className="secondary"
                      onClick={() =>
                        setEditingPlatform(
                          editingPlatform === platform.id ? null : platform.id,
                        )
                      }
                    >
                      Edit
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void toggle(
                          'platforms',
                          platform.id,
                          platform.active === false,
                        )
                      }
                    >
                      {platform.active === false ? 'Reactivate' : 'Deactivate'}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { CurrentUser } from '../../lib/workspace-types';
import { apiRequest, queryKeys } from '../../lib/api-client';

type ProfileForm = { name: string };

export function Profile({ currentUser }: { currentUser: CurrentUser }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProfileForm>({ defaultValues: { name: currentUser.name } });

  const save = handleSubmit(async ({ name }) => {
    setMessage('');
    setError('');
    try {
      const updated = await apiRequest<CurrentUser>('/auth/me', {
        method: 'PATCH',
        body: { name },
      });
      queryClient.setQueryData(queryKeys.session, updated);
      setMessage('Your display name was updated.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Profile could not be updated.',
      );
    }
  });

  return (
    <section className="panel page-panel">
      <div className="panel-heading">
        <div>
          <h2>My profile</h2>
          <p>Manage your workspace display name.</p>
        </div>
      </div>
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <form className="form-grid" onSubmit={save}>
        <label>
          Display name
          <input
            {...register('name', {
              required: 'Enter your name.',
              minLength: 2,
            })}
          />
        </label>
        <label>
          Email address
          <input value={currentUser.email} readOnly />
        </label>
        <label>
          Role
          <input value={currentUser.role.name} readOnly />
        </label>
        <button className="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </section>
  );
}

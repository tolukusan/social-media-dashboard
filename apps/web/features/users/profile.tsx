'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { CurrentUser } from '../../lib/workspace-types';
import { apiRequest, queryKeys } from '../../lib/api-client';

type ProfileForm = { name: string };
type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
};

export function Profile({ currentUser }: { currentUser: CurrentUser }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProfileForm>({ defaultValues: { name: currentUser.name } });
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    watch: watchPassword,
    formState: { errors: passwordErrors, isSubmitting: isChangingPassword },
  } = useForm<PasswordForm>();

  const changePassword = handlePasswordSubmit(
    async ({ currentPassword, newPassword }) => {
      setMessage('');
      setError('');
      try {
        await apiRequest('/auth/password', {
          method: 'PATCH',
          body: { currentPassword, newPassword },
        });
        queryClient.clear();
        window.location.assign('/');
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Password could not be updated.',
        );
      }
    },
  );

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
      <div className="panel-heading">
        <div>
          <h3>Change password</h3>
          <p>
            Enter your current password. Changing it signs out all active
            sessions, including this one.
          </p>
        </div>
      </div>
      <form className="form-grid" onSubmit={changePassword} noValidate>
        <label>
          Current password
          <input
            type="password"
            autoComplete="current-password"
            maxLength={128}
            {...registerPassword('currentPassword', {
              required: 'Enter your current password.',
              minLength: {
                value: 10,
                message: 'Use at least 10 characters.',
              },
            })}
          />
          {passwordErrors.currentPassword && (
            <span className="field-error" role="alert">
              {passwordErrors.currentPassword.message}
            </span>
          )}
        </label>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            maxLength={128}
            {...registerPassword('newPassword', {
              required: 'Enter a new password.',
              minLength: {
                value: 10,
                message: 'Use at least 10 characters.',
              },
              maxLength: {
                value: 128,
                message: 'Use no more than 128 characters.',
              },
            })}
          />
          {passwordErrors.newPassword && (
            <span className="field-error" role="alert">
              {passwordErrors.newPassword.message}
            </span>
          )}
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            maxLength={128}
            {...registerPassword('confirmation', {
              required: 'Confirm your new password.',
              validate: (value) =>
                value === watchPassword('newPassword') ||
                'Passwords do not match.',
            })}
          />
          {passwordErrors.confirmation && (
            <span className="field-error" role="alert">
              {passwordErrors.confirmation.message}
            </span>
          )}
        </label>
        <button className="primary" type="submit" disabled={isChangingPassword}>
          {isChangingPassword ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </section>
  );
}

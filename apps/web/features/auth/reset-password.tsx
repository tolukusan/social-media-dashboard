'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';

type Form = { password: string; confirmation: string };

export function ResetPassword() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Form>();
  useEffect(() => {
    const value =
      new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    setToken(value);
  }, []);
  const submit = handleSubmit(async ({ password }) => {
    setError('');
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: { token, password },
      });
      queryClient.clear();
      setToken('');
      reset();
      setComplete(true);
    } catch (cause) {
      setToken('');
      setError(
        cause instanceof Error
          ? cause.message
          : 'This reset link is invalid or has expired.',
      );
    }
  });
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">M</span>
          <span>Marketwise</span>
        </div>
        <p className="eyebrow">Account access</p>
        {complete ? (
          <>
            <h1>Password updated</h1>
            <p role="status">
              Your password has been changed. Sign in with your new password.
            </p>
            <a className="text-link" href="/">
              Return to sign in
            </a>
          </>
        ) : (
          <>
            <h1>Set a new password</h1>
            {error && (
              <div className="notice error" role="alert">
                {error}{' '}
                <a className="text-link" href="/forgot-password">
                  Request another link
                </a>
              </div>
            )}
            {!token && !error ? (
              <p role="status">
                This page no longer has a reset token. Reopen the link from your
                email or{' '}
                <a className="text-link" href="/forgot-password">
                  request another link
                </a>
                .
              </p>
            ) : null}
            {token && (
              <form onSubmit={submit} noValidate>
                <p className="auth-copy">
                  Use at least 10 characters. Passphrases are allowed.
                </p>
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  {...register('password', {
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
                {errors.password && (
                  <span className="field-error" role="alert">
                    {errors.password.message}
                  </span>
                )}
                <label htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  {...register('confirmation', {
                    required: 'Confirm your new password.',
                    validate: (value) =>
                      value === watch('password') || 'Passwords do not match.',
                  })}
                />
                {errors.confirmation && (
                  <span className="field-error" role="alert">
                    {errors.confirmation.message}
                  </span>
                )}
                <button
                  className="primary auth-submit"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Updating…' : 'Update password'}
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}

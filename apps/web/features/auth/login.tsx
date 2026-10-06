'use client';

import { useForm } from 'react-hook-form';
import { apiRequest } from '../../lib/api-client';

type Credentials = { email: string; password: string };

export function Login({
  error,
  onSuccess,
  onError,
}: {
  error: string;
  onSuccess: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Credentials>();
  const submit = handleSubmit(async (credentials) => {
    onError('');
    try {
      await apiRequest('/auth/login', { method: 'POST', body: credentials });
      await onSuccess();
    } catch (cause) {
      onError(
        cause instanceof Error
          ? cause.message
          : 'Unable to sign in. Please try again.',
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
        <p className="eyebrow">Digital marketing performance</p>
        <h1>Sign in to your workspace</h1>
        <p className="auth-copy">
          Use your account to access campaigns, performance data, analytics, and
          reports.
        </p>
        <form onSubmit={submit} noValidate>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            {...register('email', { required: 'Enter your email address.' })}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            {...register('password', { required: 'Enter your password.' })}
          />
          <button
            className="primary auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}

export function AuthLoading() {
  return (
    <main className="auth-page">
      <section className="auth-card" role="status">
        <span className="brand-mark">M</span>
        <h1>Checking your session</h1>
        <p>Loading your secure workspace…</p>
      </section>
    </main>
  );
}

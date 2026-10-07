'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiRequest } from '../../lib/api-client';

type Form = { email: string };

export function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>();
  const submit = handleSubmit(async ({ email }) => {
    setError('');
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email },
      });
      setSubmitted(true);
    } catch {
      setError(
        'We could not process that request. Please wait a moment and try again.',
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
        <h1>Forgot your password?</h1>
        {submitted ? (
          <>
            <p role="status">
              If an active account uses this email, we will send a password
              reset link. Delivery may take a moment.
            </p>
            <a className="text-link" href="/">
              Return to sign in
            </a>
          </>
        ) : (
          <>
            <p className="auth-copy">
              Enter your account email address and we will send a reset link if
              the account is active.
            </p>
            <form onSubmit={submit} noValidate>
              {error && (
                <div className="notice error" role="alert">
                  {error}
                </div>
              )}
              <label htmlFor="recovery-email">Email address</label>
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                maxLength={320}
                {...register('email', {
                  required: 'Enter your email address.',
                  maxLength: { value: 320, message: 'Email is too long.' },
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address.',
                  },
                })}
              />
              {errors.email && (
                <span className="field-error" role="alert">
                  {errors.email.message || 'Enter a valid email address.'}
                </span>
              )}
              <button
                className="primary auth-submit"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <p>
              <a className="text-link" href="/">
                Return to sign in
              </a>
            </p>
          </>
        )}
      </section>
    </main>
  );
}

'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../../lib/api-client';
export function PublicAccess({ invitation = false }: { invitation?: boolean }) {
  const [token, setToken] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (invitation) {
      const value =
        new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
      window.history.replaceState(null, '', window.location.pathname);
      setToken(value);
      if (!value)
        setError(
          'Open the complete invitation link supplied by your Administrator.',
        );
    }
  }, [invitation]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ message: string }>(
        invitation ? '/auth/accept-invitation' : '/auth/register',
        { method: 'POST', body: { ...form, ...(invitation ? { token } : {}) } },
      );
      setMessage(result.message);
      setForm({ name: '', email: '', password: '' });
      setToken('');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The request could not complete.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Marketwise</p>
        <h1>
          {invitation ? 'Accept your invitation' : 'Request workspace access'}
        </h1>
        <p>
          {invitation
            ? 'Use the email address your Administrator invited. Set your name and password, then sign in.'
            : 'This deployment has one organization. An Administrator must approve your request and assign your role before you can sign in.'}
        </p>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {message ? (
          <p role="status">{message}</p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Full name
              <input
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </label>
            <label>
              Email address
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
              />
            </label>
            <p>Use at least 10 characters.</p>
            <button
              className="primary auth-submit"
              disabled={busy || (invitation && !token)}
            >
              {busy
                ? 'Submitting…'
                : invitation
                  ? 'Accept invitation'
                  : 'Submit access request'}
            </button>
          </form>
        )}
        <p>
          <a href="/">Sign in</a>
        </p>
      </section>
    </main>
  );
}

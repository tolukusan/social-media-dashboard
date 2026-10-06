'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Empty } from '../../components/empty';
import type { ManagedUser, UserRole } from '../../lib/workspace-types';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiRequest,
  invalidateWorkspace,
  queryKeys,
} from '../../lib/api-client';
import { useForm } from 'react-hook-form';

type UserUpdateForm = { name: string; email: string; roleId: string };

export function Users() {
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetUserId, setResetUserId] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { isSubmitting: editingSubmitting },
  } = useForm<UserUpdateForm>({
    defaultValues: { name: '', email: '', roleId: '' },
  });
  const [form, setForm] = useState({
    name: '',
    email: '',
    roleId: '',
    password: '',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [nextUsers, nextRoles] = await Promise.all([
        apiRequest<ManagedUser[]>('/users'),
        apiRequest<UserRole[]>('/users/roles'),
      ]);
      setUsers(nextUsers);
      queryClient.setQueryData(queryKeys.users, nextUsers);
      setRoles(nextRoles);
      queryClient.setQueryData(queryKeys.userRoles, nextRoles);
      setForm((current) => ({
        ...current,
        roleId: current.roleId || nextRoles[0]?.id || '',
      }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Users could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: form,
      });
      await invalidateWorkspace(queryClient);
      setForm({
        name: '',
        email: '',
        roleId: roles[0]?.id || '',
        password: '',
      });
      setMessage('User created successfully.');
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'User could not be created.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateUser = async (
    user: ManagedUser,
    action: 'deactivate' | 'reactivate',
  ) => {
    setError('');
    setMessage('');
    try {
      await apiRequest(
        `/users/${user.id}${action === 'reactivate' ? '/reactivate' : ''}`,
        { method: action === 'reactivate' ? 'PATCH' : 'DELETE' },
      );
      await invalidateWorkspace(queryClient);
      setMessage(`User ${action}d successfully.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'User update failed.');
    }
  };

  const reset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(`/users/${resetUserId}/password`, {
        method: 'PATCH',
        body: { password: resetPassword },
      });
      await invalidateWorkspace(queryClient);
      setResetUserId('');
      setResetPassword('');
      setMessage(
        'Password reset successfully; existing sessions were revoked.',
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Password reset failed.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveUser = handleEditSubmit(async (values) => {
    if (!editingUser) return;
    setError('');
    setMessage('');
    try {
      await apiRequest(`/users/${editingUser.id}`, {
        method: 'PATCH',
        body: values,
      });
      await invalidateWorkspace(queryClient);
      setEditingUser(null);
      setMessage('User details updated successfully.');
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'User could not be updated.',
      );
    }
  });

  return (
    <section className="panel page-panel user-screen">
      <div className="panel-heading">
        <div>
          <h2>Users</h2>
          <p>Administrator-only access management for this workspace.</p>
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
      <form className="user-form" onSubmit={create}>
        <h3>Create user</h3>
        <div className="form-grid">
          <label>
            Name
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>
          <label>
            Role
            <select
              required
              value={form.roleId}
              onChange={(event) =>
                setForm({ ...form, roleId: event.target.value })
              }
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Temporary password
            <input
              required
              minLength={10}
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
          </label>
        </div>
        <button
          className="primary"
          type="submit"
          disabled={submitting || loading}
        >
          Create user
        </button>
      </form>
      {resetUserId && (
        <form className="user-form reset-form" onSubmit={reset}>
          <h3>Reset password</h3>
          <p>Choose a new password of at least 10 characters.</p>
          <div className="form-grid">
            <label>
              New password
              <input
                required
                minLength={10}
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
              />
            </label>
          </div>
          <button className="primary" type="submit" disabled={submitting}>
            Reset password
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setResetUserId('')}
          >
            Cancel
          </button>
        </form>
      )}
      {editingUser && (
        <form className="user-form" onSubmit={saveUser}>
          <h3>Edit user</h3>
          <div className="form-grid">
            <label>
              Name
              <input
                {...registerEdit('name', { required: true, minLength: 2 })}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                {...registerEdit('email', { required: true })}
              />
            </label>
            <label>
              Role
              <select {...registerEdit('roleId', { required: true })}>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="primary"
            type="submit"
            disabled={editingSubmitting}
          >
            {editingSubmitting ? 'Saving…' : 'Save user'}
          </button>
          <button
            className="secondary"
            type="button"
            onClick={() => setEditingUser(null)}
          >
            Cancel
          </button>
        </form>
      )}
      {loading ? (
        <div className="empty-table" role="status">
          Loading users…
        </div>
      ) : users.length === 0 ? (
        <Empty
          title="No users found"
          detail="Create the first workspace user above."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Workspace users</caption>
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <th scope="row">
                    <strong>{user.name}</strong>
                    <br />
                    <span className="muted-text">{user.email}</span>
                  </th>
                  <td>{user.role.name}</td>
                  <td>
                    <span className={`status ${user.active ? '' : 'inactive'}`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="users-actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditingUser(user);
                          resetEdit({
                            name: user.name,
                            email: user.email,
                            roleId: user.role.id,
                          });
                        }}
                      >
                        Edit user
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          setResetUserId(user.id);
                          setResetPassword('');
                        }}
                      >
                        Reset password
                      </button>
                      {user.active ? (
                        <button
                          className="secondary danger"
                          onClick={() => void updateUser(user, 'deactivate')}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          className="secondary"
                          onClick={() => void updateUser(user, 'reactivate')}
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

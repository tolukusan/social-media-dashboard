'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CurrentUser, View } from '../lib/workspace-types';

export function WorkspaceNavigation({
  currentUser,
  view,
  navigationOpen,
  navigate,
  logout,
  canLeave = () => true,
}: {
  currentUser: CurrentUser | null;
  view: View | 'imports';
  navigationOpen: boolean;
  navigate?: (view: View) => void;
  logout: () => Promise<void>;
  canLeave?: () => boolean;
}) {
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const groups: Array<{
    name: string;
    items: Array<[View | 'imports', string]>;
  }> = [
    {
      name: '',
      items: [
        ['overview', 'Overview'],
        ['campaigns', 'Campaigns'],
      ],
    },
    {
      name: 'Data',
      items: [
        ...(currentUser?.role.code !== 'MANAGEMENT'
          ? [['imports', 'Imports'] as [View | 'imports', string]]
          : []),
        ['performance', 'Performance data'],
        ['integrations', 'Integrations'],
      ],
    },
    {
      name: 'Results',
      items: [
        ['analytics', 'Analytics'],
        ['targets', 'KPI targets'],
        ['reports', 'Reports'],
      ],
    },
    ...(currentUser?.role.code === 'ADMIN'
      ? [
          {
            name: 'Administration',
            items: [
              ['settings', 'Settings'],
              ['users', 'Users'],
            ] as Array<[View, string]>,
          },
        ]
      : []),
  ];
  return (
    <aside
      id="workspace-navigation"
      className={`sidebar${navigationOpen ? ' navigation-open' : ''}`}
    >
      <div className="brand">
        <span className="brand-mark">M</span>
        <span>Marketwise</span>
      </div>
      <nav aria-label="Primary navigation">
        {groups.map((group, index) => (
          <div className="nav-group" key={group.name || index}>
            {group.name && <p className="nav-group-label">{group.name}</p>}
            {group.items.map(([id, label]) =>
              id === 'imports' || !navigate ? (
                <Link
                  key={id}
                  href={id === 'imports' ? '/imports' : `/#${id}`}
                  className={view === id ? 'active' : ''}
                  aria-current={view === id ? 'page' : undefined}
                  onClick={(event) => {
                    if (!canLeave()) event.preventDefault();
                  }}
                >
                  {label}
                </Link>
              ) : (
                <button
                  key={id}
                  className={view === id ? 'active' : ''}
                  aria-current={view === id ? 'page' : undefined}
                  onClick={() => {
                    if (canLeave()) navigate(id);
                  }}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="avatar">
          {currentUser?.name
            ?.split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'U'}
        </span>
        <span>
          <strong>{currentUser?.name || 'Workspace user'}</strong>
          <small>{currentUser?.role.name || 'Authenticated user'}</small>
        </span>
        {navigate ? (
          <button className="profile-link" onClick={() => navigate('profile')}>
            My profile
          </button>
        ) : (
          <Link
            className="profile-link"
            href="/#profile"
            onClick={(event) => {
              if (!canLeave()) event.preventDefault();
            }}
          >
            My profile
          </Link>
        )}
        <button
          className="logout"
          disabled={loggingOut}
          onClick={async () => {
            if (!canLeave()) return;
            setLoggingOut(true);
            setError('');
            try {
              await logout();
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : 'Could not log out.',
              );
            } finally {
              setLoggingOut(false);
            }
          }}
        >
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </aside>
  );
}

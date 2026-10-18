'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
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
    { name: 'Overview', items: [['overview', 'Overview']] },
    {
      name: 'Accounts',
      items: [
        ['accounts', 'Accounts'],
        ['account-comparison', 'Compare'],
        ['email-reports', 'Email reports'],
        ['integrations', 'Connections'],
      ],
    },
    {
      name: 'Campaigns',
      items: [
        ['campaigns', 'Campaigns'],
        ['analytics', 'Campaign analytics'],
        ['targets', 'KPI targets'],
      ],
    },
    {
      name: 'Data',
      items: [
        ...(currentUser?.role.code !== 'MANAGEMENT'
          ? [['imports', 'Imports'] as [View | 'imports', string]]
          : []),
        ['performance', 'Performance data'],
      ],
    },
    { name: 'Reports', items: [['reports', 'Reports']] },
    ...(currentUser?.role.code === 'ADMIN'
      ? [
          {
            name: 'Administration',
            items: [
              ['settings', 'Settings'],
              ['users', 'Users'],
              ['archive', 'Archive'],
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
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M5 17V9m7 8V5m7 12v-5" />
          </svg>
        </span>
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
                  className={navIsActive(view, id) ? 'active' : ''}
                  aria-current={navIsActive(view, id) ? 'page' : undefined}
                  onClick={(event) => {
                    if (!canLeave()) event.preventDefault();
                  }}
                >
                  <NavIcon view={id} />
                  {label}
                </Link>
              ) : (
                <button
                  key={id}
                  className={navIsActive(view, id) ? 'active' : ''}
                  aria-current={navIsActive(view, id) ? 'page' : undefined}
                  onClick={() => {
                    if (canLeave()) navigate(id);
                  }}
                >
                  <NavIcon view={id} />
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

function navIsActive(view: View | 'imports', item: View | 'imports') {
  if (item === 'accounts')
    return view === 'accounts' || view === 'account-insights';
  return view === item;
}

function NavIcon({ view }: { view: View | 'imports' }) {
  const paths: Record<View | 'imports', ReactNode> = {
    archive: <path d="M3 4h18v5H3zm2 5v11h14V9m-10 4h6" />,
    accounts: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    'account-insights': (
      <>
        <path d="M4 19V5m0 14h16" />
        <path d="m7 15 4-4 3 2 5-6" />
      </>
    ),
    'account-comparison': (
      <>
        <path d="M5 5v14m7-11v11m7-15v15" />
        <path d="M3 19h18" />
      </>
    ),
    'email-reports': (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    overview: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1" />
        <rect x="13" y="4" width="7" height="7" rx="1" />
        <rect x="4" y="13" width="7" height="7" rx="1" />
        <rect x="13" y="13" width="7" height="7" rx="1" />
      </>
    ),
    campaigns: (
      <>
        <path d="M4 6h16v13H4z" />
        <path d="M8 6V4h8v2M8 11h8m-8 4h5" />
      </>
    ),
    imports: (
      <>
        <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
        <path d="M5 17v3h14v-3" />
      </>
    ),
    performance: (
      <>
        <path d="M4 19V5m0 14h16" />
        <path d="m7 15 3-4 3 2 5-7" />
      </>
    ),
    integrations: (
      <>
        <path d="M8 7a3 3 0 1 0-3 3h3v4m8-7a3 3 0 1 1 3 3h-3v4" />
        <path d="M8 14v1a4 4 0 0 0 8 0v-1" />
      </>
    ),
    analytics: (
      <>
        <path d="M4 19V5m0 14h16" />
        <path d="m7 15 3-3 3 2 5-7" />
      </>
    ),
    targets: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    reports: (
      <>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M14 3v5h5m-9 4h5m-5 4h5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m19 13 2 1-2 4-2-1-2 1v2H9v-2l-2-1-2 1-2-4 2-1v-2l-2-1 2-4 2 1 2-1V4h6v2l2 1 2-1 2 4-2 1z" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-1a6 6 0 0 1 12 0v1m2-12a3 3 0 0 1 0 6m1 2a5 5 0 0 1 3 4" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
  };
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {paths[view]}
    </svg>
  );
}

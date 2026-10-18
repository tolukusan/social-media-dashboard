import type { ReactNode } from 'react';

export type ProviderCode =
  'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'YOUTUBE' | 'ZOHO_CAMPAIGNS';

const providerMarks: Record<ProviderCode, string> = {
  INSTAGRAM: 'ig',
  FACEBOOK: 'f',
  LINKEDIN: 'in',
  YOUTUBE: '▶',
  ZOHO_CAMPAIGNS: 'Z',
};

export function ProviderMark({ provider }: { provider: ProviderCode }) {
  return (
    <span
      className={`provider-icon provider-${provider.toLowerCase()}`}
      aria-hidden="true"
    >
      {providerMarks[provider]}
    </span>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: 'ready' | 'pending' | 'current' | 'error' | 'stale';
  children: ReactNode;
}) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="screen-heading">
      <div className="screen-heading-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="screen-heading-actions">{actions}</div>}
    </div>
  );
}

export function DateRangeControls({
  from,
  to,
  max,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  max: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <fieldset className="date-range-controls">
      <legend className="sr-only">Reporting period</legend>
      <label>
        <span>From</span>
        <input
          type="date"
          value={from}
          max={to || max}
          onChange={(event) => onFromChange(event.target.value)}
        />
      </label>
      <span className="date-range-separator" aria-hidden="true">
        to
      </span>
      <label>
        <span>To</span>
        <input
          type="date"
          value={to}
          min={from}
          max={max}
          onChange={(event) => onToChange(event.target.value)}
        />
      </label>
    </fieldset>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  className = '',
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <article className={`metric-tile ${className}`.trim()}>
      <span className="metric-tile-label">{label}</span>
      <strong className="metric-tile-value">{value}</strong>
      {detail && <span className="metric-tile-detail">{detail}</span>}
    </article>
  );
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="info-banner" role="note">
      <span className="info-banner-mark" aria-hidden="true">
        i
      </span>
      <p>{children}</p>
    </div>
  );
}

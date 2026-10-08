'use client';

export function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <article className="kpi">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>
        {value === '—' ? 'No data in selected period' : 'For the selected data'}
      </small>
    </article>
  );
}

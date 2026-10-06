'use client';

export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-table">
      <span className="table-icon">○</span>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

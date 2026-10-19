function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function printJoinedDataset({
  title,
  headings,
  rows,
  chartSvg,
}: {
  title: string;
  headings: string[];
  rows: string[][];
  chartSvg?: string;
}): boolean {
  const preview = window.open('', '_blank');
  if (!preview) return false;
  preview.opener = null;
  preview.document.open();
  preview.document
    .write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 24px; font: 12px Arial, sans-serif; color: #182e56; }
    h1 { font-size: 22px; margin-bottom: 8px; }
    p { color: #52637a; }
    button { padding: 10px 16px; margin-bottom: 16px; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #94a3b8; padding: 8px; text-align: left; overflow-wrap: anywhere; }
    th { background: #eef2f7; } thead { display: table-header-group; }
    tr { break-inside: avoid; } td:first-child { white-space: nowrap; }
    .chart { break-inside: avoid; margin: 20px 0; }
    svg { width: 100%; height: auto; max-height: 280px; }
    @media print { body { margin: 0; } button { display: none; } }
  </style></head><body><button type="button">Print / Save PDF</button>
  <h1>${escapeHtml(title)}</h1><p>${rows.length.toLocaleString()} joined rows. Missing values remain blank; repeated dates are preserved. No totals or rates are calculated.</p>
  ${chartSvg ? `<div class="chart">${chartSvg}</div>` : ''}
  <table aria-label="Joined campaign data"><thead><tr>${headings.map((heading) => `<th scope="col">${escapeHtml(heading)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
  preview.document.close();
  preview.document
    .querySelector('button')
    ?.addEventListener('click', () => preview.print());
  void preview.document.fonts.ready.then(() => {
    if (!preview.closed) {
      preview.focus();
      preview.print();
    }
  });
  return true;
}

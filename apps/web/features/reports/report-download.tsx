'use client';
import { useState } from 'react';
import { apiBlob } from '../../lib/api-client';
import type { ReportFilters } from './reports';
export function ReportDownload({
  filters,
  comparisonPeriod = 'CUSTOM',
}: {
  filters: ReportFilters;
  comparisonPeriod?: string;
}) {
  const { from, to } = filters;
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const query = new URLSearchParams(
    Object.entries({ ...filters, comparisonPeriod }).filter(([, value]) =>
      Boolean(value),
    ),
  );
  const download = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      const blob = await apiBlob(`/reports/dashboard.pdf?${query}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `marketing-performance-report_${from || 'all'}_to_${to || 'all'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setDownloadError(
        cause instanceof Error
          ? cause.message
          : 'Report could not be downloaded.',
      );
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div>
      <button
        className="primary download"
        type="button"
        disabled={downloading}
        onClick={() => void download()}
      >
        {downloading ? 'Preparing PDF?' : 'Download PDF'}
      </button>
      {downloadError && (
        <p className="notice error" role="alert">
          {downloadError}
        </p>
      )}
    </div>
  );
}

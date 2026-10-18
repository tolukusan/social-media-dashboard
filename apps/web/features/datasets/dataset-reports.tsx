'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBlob, apiRequest } from '../../lib/api-client';
import type {
  Campaign,
  DatasetCampaignResult,
} from '../../lib/workspace-types';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DatasetReports({ campaigns }: { campaigns: Campaign[] }) {
  const queryClient = useQueryClient();
  const [campaignId, setCampaignId] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('campaignId') ?? ''),
  );
  const refreshedDeepLinkCampaign = useRef<string | null>(null);
  const [busyDatasetId, setBusyDatasetId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!campaigns.length) return;
    const urlCampaign = new URLSearchParams(window.location.search).get(
      'campaignId',
    );
    if (
      urlCampaign &&
      !campaigns.some((campaign) => campaign.id === urlCampaign)
    ) {
      if (refreshedDeepLinkCampaign.current !== urlCampaign) {
        refreshedDeepLinkCampaign.current = urlCampaign;
        void queryClient.invalidateQueries({
          queryKey: ['workspace-context'],
        });
      }
      return;
    }
    setCampaignId((current) => {
      if (campaigns.some((campaign) => campaign.id === urlCampaign))
        return urlCampaign!;
      return campaigns.some((campaign) => campaign.id === current)
        ? current
        : campaigns[0]!.id;
    });
  }, [campaigns, queryClient]);
  const dataQuery = useQuery({
    queryKey: ['datasets', 'campaign', campaignId],
    enabled: Boolean(campaignId),
    queryFn: () =>
      apiRequest<DatasetCampaignResult>(`/datasets/campaigns/${campaignId}`),
  });
  const exportDataset = async (
    id: string,
    name: string,
    revision: number,
    format: 'csv' | 'pdf',
  ) => {
    setBusyDatasetId(id);
    setError('');
    try {
      const blob = await apiBlob(
        `/datasets/${id}/export.${format}?expectedRevision=${revision}`,
      );
      const safeName = name.replace(/[^\p{L}\p{N}._-]+/gu, '-');
      download(blob, `${safeName}.${format}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The report could not be exported.',
      );
    } finally {
      setBusyDatasetId('');
    }
  };

  return (
    <section className="panel page-panel dataset-reports">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">File reports</p>
          <h2>Reports by dataset</h2>
          <p>
            Each report preserves one imported dataset. No columns are added
            together across files.
          </p>
        </div>
        {campaigns.length ? (
          <label className="dataset-campaign-picker">
            Campaign
            <select
              value={campaignId}
              onChange={(event) => {
                const nextCampaign = event.target.value;
                setCampaignId(nextCampaign);
                const url = new URL(window.location.href);
                url.searchParams.set('campaignId', nextCampaign);
                window.history.replaceState({}, '', url);
              }}
            >
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      {dataQuery.isPending ? (
        <p role="status">Loading campaign datasets…</p>
      ) : null}
      {dataQuery.error ? (
        <p className="notice error" role="alert">
          {dataQuery.error instanceof Error
            ? dataQuery.error.message
            : 'Campaign datasets could not be loaded.'}
        </p>
      ) : null}
      {!campaigns.length ? (
        <div className="empty-state">
          <h3>No campaigns yet</h3>
          <p>Create a campaign before preparing a dataset report.</p>
        </div>
      ) : null}
      {dataQuery.data ? (
        dataQuery.data.datasets.length ? (
          <div className="dataset-cards">
            {dataQuery.data.datasets.map((dataset) => (
              <article className="dataset-card" key={dataset.id}>
                <div>
                  <h3>{dataset.name}</h3>
                  <p>
                    {dataset.sourceFilename}
                    {dataset.worksheetName ? ` · ${dataset.worksheetName}` : ''}
                  </p>
                  <p className="muted-text">
                    {dataset.rowCount} rows · separate dataset report
                  </p>
                </div>
                <div className="button-row">
                  <Link
                    className="secondary button-link"
                    href={`/?campaignId=${encodeURIComponent(campaignId)}&datasetId=${encodeURIComponent(dataset.id)}#datasets`}
                  >
                    View rows
                  </Link>
                  <button
                    className="secondary"
                    disabled={Boolean(busyDatasetId)}
                    onClick={() =>
                      void exportDataset(
                        dataset.id,
                        dataset.name,
                        dataset.currentRevision,
                        'csv',
                      )
                    }
                  >
                    {busyDatasetId === dataset.id ? 'Exporting…' : 'Export CSV'}
                  </button>
                  <button
                    className="secondary"
                    disabled={Boolean(busyDatasetId)}
                    onClick={() =>
                      void exportDataset(
                        dataset.id,
                        dataset.name,
                        dataset.currentRevision,
                        'pdf',
                      )
                    }
                  >
                    Export PDF
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No datasets in this campaign</h3>
            <p>Import a file from Overview, Data, or the campaign details.</p>
          </div>
        )
      ) : null}
      {dataQuery.data?.historicalImports.length ? (
        <section
          className="dataset-list historical-datasets"
          aria-label="Earlier report data"
        >
          <h3>Earlier imports</h3>
          <p className="muted-text">
            Original file values are unavailable. Current surviving campaign
            records remain separate from dataset reports.
          </p>
          {dataQuery.data.historicalImports.map((item) => (
            <article className="dataset-card" key={item.id}>
              <div>
                <h4>{item.name}</h4>
                <p>{item.availableRecordCount} available records</p>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}

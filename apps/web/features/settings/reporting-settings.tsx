'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiRequest } from '../../lib/api-client';

type Settings = {
  reportingCurrency: string | null;
  availableCurrencies: string[];
};

export function ReportingSettings() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['reporting-settings'],
    queryFn: () => apiRequest<Settings>('/settings/reporting'),
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ reportingCurrency: string }>({
    values: { reportingCurrency: settings.data?.reportingCurrency ?? '' },
  });
  const save = handleSubmit(async (values) => {
    setMessage('');
    setError('');
    try {
      const updated = await apiRequest<Settings>('/settings/reporting', {
        method: 'PATCH',
        body: values,
      });
      queryClient.setQueryData(['reporting-settings'], updated);
      await queryClient.invalidateQueries({
        predicate: (query) =>
          [
            'workspace',
            'report-preview',
            'trends',
            'analytics-comparison',
            'analytics-dimension',
          ].includes(String(query.queryKey[0])),
      });
      setMessage('Reporting currency saved.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save reporting currency.',
      );
    }
  });

  return (
    <section className="panel page-panel">
      <div className="panel-heading">
        <div>
          <h2>Reporting currency</h2>
          <p>
            Choose the currency used for monetary values across this
            organisation. Changing it relabels existing amounts; it does not
            convert them.
          </p>
        </div>
      </div>
      {settings.isPending && <p role="status">Loading reporting settings…</p>}
      {(settings.error || error) && (
        <div className="notice error" role="alert">
          {error || settings.error?.message}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {settings.data && (
        <form className="form-grid" onSubmit={save}>
          <label>
            Reporting currency
            <select
              {...register('reportingCurrency', { required: true })}
              required
            >
              <option value="" disabled>
                Choose a currency
              </option>
              {settings.data.availableCurrencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save reporting currency'}
          </button>
        </form>
      )}
    </section>
  );
}

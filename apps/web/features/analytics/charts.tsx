'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Unit = 'COUNT' | 'PERCENT' | 'CURRENCY' | 'POSITION' | 'DECIMAL' | string;

function axisValue(value: number, unit: Unit, currencyCode?: string | null) {
  if (unit === 'PERCENT') return `${value.toFixed(1)}%`;
  if (unit === 'CURRENCY')
    return `${currencyCode ? `${currencyCode} ` : ''}${value.toFixed(1)}`;
  if (unit === 'POSITION') return value.toFixed(1);
  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 2,
  }).format(value);
}

export function TrendLineChart({
  points,
  label,
  unit,
  currencyCode,
}: {
  points: Array<{ bucket: string; value: number | null }>;
  label: string;
  unit: Unit;
  currencyCode?: string | null;
}) {
  return (
    <div
      className="chart-visual"
      role="img"
      aria-label={`${label} trend chart. Exact values are available in the table below.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bucket" minTickGap={24} />
          <YAxis
            width="auto"
            tickFormatter={(value: number) =>
              axisValue(value, unit, currencyCode)
            }
          />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            connectNulls={false}
            isAnimationActive={false}
            stroke="#2764e7"
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ComparisonBarChart({
  points,
  label,
  unit,
  currencyCode,
}: {
  points: Array<{ label: string; value: number | null }>;
  label: string;
  unit: Unit;
  currencyCode?: string | null;
}) {
  return (
    <div
      className="chart-visual"
      role="img"
      aria-label={`${label} comparison chart. Exact values are available in the table below.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis
            width="auto"
            tickFormatter={(value: number) =>
              axisValue(value, unit, currencyCode)
            }
          />
          <Tooltip />
          <Bar
            dataKey="value"
            name={label}
            fill="#2764e7"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

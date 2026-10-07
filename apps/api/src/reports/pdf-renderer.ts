import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';

export type PdfReportData = {
  title: string;
  generatedAt: string;
  timeZone: string;
  reportingCurrency: string | null;
  period: { from: string | null; to: string | null };
  filters: Record<
    'campaign' | 'channel' | 'platform' | 'metric' | 'targetPeriod',
    string | null
  >;
  summary: {
    recordCount: number;
    campaignCount: number;
    channelCount: number;
    kpis: Array<{
      label: string;
      unit: string;
      value: number | null;
      aggregationNote: string | null;
      target: {
        status: string | null;
        target: { value: number; comparisonRule: string } | null;
      } | null;
    }>;
  };
  comparison: {
    currentPeriod: { from: Date | string; to: Date | string };
    previousPeriod: { from: Date | string; to: Date | string };
    isPartial: boolean;
    metric: string;
    unit: string;
    current: number | null;
    previous: number | null;
    difference: number | null;
    percentageChange: number | null;
  } | null;
  trend: {
    grain: string;
    metric: string;
    unit: string;
    points: Array<{ bucket: string; value: number | null }>;
  } | null;
  caveats: string[];
};

function fmt(value: number | null, unit: string, currency: string | null) {
  if (value === null) return 'Unavailable';
  if (unit === 'PERCENT') return `${value.toFixed(2)}%`;
  if (unit === 'CURRENCY')
    return `${currency ?? 'Currency unset'} ${value.toFixed(2)}`;
  if (unit === 'POSITION') return value.toFixed(2);
  if (unit === 'COUNT') return new Intl.NumberFormat('en').format(value);
  return String(value);
}

function day(value: Date | string) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}

function useFont(doc: PDFKit.PDFDocument) {
  const path = [
    process.env.REPORT_FONT_PATH,
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
  ].find((candidate) => candidate && existsSync(candidate));
  if (!path) return false;
  doc.registerFont('ReportSans', path).font('ReportSans');
  return true;
}

function room(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function section(doc: PDFKit.PDFDocument, title: string) {
  room(doc, 38);
  doc
    .moveDown(0.6)
    .fillColor('#172033')
    .fontSize(14)
    .text(title)
    .moveDown(0.25);
}

function row(doc: PDFKit.PDFDocument, label: string, value: string) {
  room(doc, 30);
  doc.fillColor('#344054').fontSize(9).text(label, { continued: true });
  doc.fillColor('#172033').text(value, { width: 500 });
}

function drawTrend(doc: PDFKit.PDFDocument, report: PdfReportData) {
  const trend = report.trend;
  if (!trend) return;
  const numeric = trend.points.filter(
    (point): point is { bucket: string; value: number } =>
      point.value !== null && Number.isFinite(point.value),
  );
  if (numeric.length < 2) return;

  room(doc, 205);
  doc.fontSize(10).text(`${trend.metric} trend (${trend.grain.toLowerCase()})`);
  const x = doc.page.margins.left + 38;
  const y = doc.y + 12;
  const width =
    doc.page.width - doc.page.margins.left - doc.page.margins.right - 58;
  const height = 138;
  let min = Math.min(...numeric.map((point) => point.value));
  let max = Math.max(...numeric.map((point) => point.value));
  if (min === max) {
    const delta = Math.abs(min) || 1;
    min -= delta * 0.1;
    max += delta * 0.1;
  }
  const px = (index: number) =>
    x + (index / Math.max(1, trend.points.length - 1)) * width;
  const py = (value: number) =>
    y + height - ((value - min) / (max - min)) * height;

  doc
    .save()
    .lineWidth(0.6)
    .strokeColor('#98A2B3')
    .moveTo(x, y)
    .lineTo(x, y + height)
    .lineTo(x + width, y + height)
    .stroke()
    .fontSize(7)
    .fillColor('#667085')
    .text(fmt(max, trend.unit, report.reportingCurrency), x - 37, y - 3, {
      width: 34,
      align: 'right',
    })
    .text(
      fmt(min, trend.unit, report.reportingCurrency),
      x - 37,
      y + height - 3,
      { width: 34, align: 'right' },
    )
    .text(trend.points[0]?.bucket ?? '', x, y + height + 6, {
      width: width / 2,
    })
    .text(trend.points.at(-1)?.bucket ?? '', x + width / 2, y + height + 6, {
      width: width / 2,
      align: 'right',
    });

  doc.lineWidth(1.8).strokeColor('#2764E7');
  let drawing = false;
  trend.points.forEach((point, index) => {
    if (point.value === null || !Number.isFinite(point.value)) {
      if (drawing) doc.stroke();
      drawing = false;
      return;
    }
    if (drawing) doc.lineTo(px(index), py(point.value));
    else {
      doc.moveTo(px(index), py(point.value));
      drawing = true;
    }
  });
  if (drawing) doc.stroke();
  doc.restore().fillColor('#172033');
  doc.y = y + height + 28;
}

export async function renderReportPdf(report: PdfReportData) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, right: 48, bottom: 48, left: 48 },
    info: { Title: report.title, Creator: 'Marketwise' },
  });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const unicode = useFont(doc);

  doc.fillColor('#172033').fontSize(18).text(report.title);
  doc
    .fillColor('#667085')
    .fontSize(9)
    .text(`Generated: ${report.generatedAt} (${report.timeZone})`)
    .text(
      `Period: ${report.period.from ?? 'all'} to ${report.period.to ?? 'all'}`,
    );
  if (!unicode)
    doc.text(
      'Font note: configure REPORT_FONT_PATH for extended Unicode glyph coverage.',
    );

  section(doc, 'Filters');
  row(doc, 'Campaign: ', report.filters.campaign ?? 'All campaigns');
  row(doc, 'Channel: ', report.filters.channel ?? 'All channels');
  row(doc, 'Platform: ', report.filters.platform ?? 'All platforms');
  row(doc, 'Metric: ', report.filters.metric ?? 'All metrics');
  row(doc, 'Target period: ', report.filters.targetPeriod ?? 'Off');
  row(
    doc,
    'Reporting currency: ',
    report.reportingCurrency ?? 'Currency unset',
  );

  section(doc, 'Summary');
  row(doc, 'Records included: ', String(report.summary.recordCount));
  row(doc, 'Campaigns in scope: ', String(report.summary.campaignCount));
  row(doc, 'Active channels in scope: ', String(report.summary.channelCount));

  if (report.comparison) {
    const item = report.comparison;
    section(doc, 'Period comparison');
    row(
      doc,
      'Periods: ',
      `${day(item.currentPeriod.from)} to ${day(item.currentPeriod.to)} vs ${day(item.previousPeriod.from)} to ${day(item.previousPeriod.to)}${item.isPartial ? ' (partial)' : ''}`,
    );
    row(
      doc,
      `${item.metric} current: `,
      fmt(item.current, item.unit, report.reportingCurrency),
    );
    row(
      doc,
      'Previous: ',
      fmt(item.previous, item.unit, report.reportingCurrency),
    );
    row(
      doc,
      'Difference: ',
      fmt(item.difference, item.unit, report.reportingCurrency),
    );
    row(
      doc,
      'Change: ',
      item.percentageChange === null
        ? 'Unavailable'
        : `${item.percentageChange.toFixed(2)}%`,
    );
  }

  if (report.trend?.points.length) {
    section(doc, 'Trend');
    drawTrend(doc, report);
  }

  section(doc, 'KPI values');
  for (const item of report.summary.kpis) {
    row(
      doc,
      `${item.label}: `,
      fmt(item.value, item.unit, report.reportingCurrency),
    );
    if (item.aggregationNote)
      row(doc, 'Aggregation note: ', item.aggregationNote);
    if (item.target) {
      const target = item.target.target
        ? `${fmt(item.target.target.value, item.unit, report.reportingCurrency)} (${item.target.target.comparisonRule})`
        : 'No target';
      row(
        doc,
        'Target: ',
        `${target}; status: ${item.target.status ?? 'Not evaluated'}`,
      );
    }
  }

  if (report.caveats.length) {
    section(doc, 'Data notes');
    for (const note of report.caveats) row(doc, '• ', note);
  }

  doc.end();
  return output;
}

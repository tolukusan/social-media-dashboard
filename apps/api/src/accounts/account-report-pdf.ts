import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';

type AccountReport = {
  account: {
    displayName: string;
    provider: string;
    kind: string;
    lastSyncedAt?: Date | string | null;
  };
  period: { from: string; to: string };
  previousPeriod?: { from: string; to: string } | null;
  metrics: Array<{
    code: string;
    label: string;
    unit: string;
    value: number | null;
    previous: number | null;
    difference: number | null;
    percentageChange: number | null;
  }>;
  series: Array<{ date: string; values: Record<string, number | null> }>;
  topPosts: Array<{
    externalPostId: string;
    title: string | null;
    postType: string | null;
    permalink: string | null;
    publishedAt: Date | string | null;
    dataScope?: string;
    metricCode: string;
    metricValue: number | null;
  }>;
  caveats: string[];
  dataAvailableThrough?: Date | string | null;
  generatedAt: string;
};

function number(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  if (unit === 'MINUTES')
    return `${new Intl.NumberFormat('en').format(value)} min`;
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(
    value,
  );
}

function useFont(doc: PDFKit.PDFDocument) {
  const path = [
    process.env.REPORT_FONT_PATH,
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
  ].find((candidate) => candidate && existsSync(candidate));
  if (path) doc.registerFont('AccountSans', path).font('AccountSans');
}

function ensureRoom(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

export async function renderAccountReportPdf(report: AccountReport) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, right: 48, bottom: 48, left: 48 },
    info: {
      Title: `${report.account.displayName} account report`,
      Creator: 'Marketwise',
    },
  });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  useFont(doc);
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.fillColor('#172033').fontSize(20).text('Account performance report');
  doc
    .moveDown(0.25)
    .fillColor('#667085')
    .fontSize(10)
    .text(
      `${report.account.displayName} · ${report.account.provider.replaceAll('_', ' ')}`,
    )
    .text(`Period: ${report.period.from} to ${report.period.to}`)
    .text(`Generated: ${report.generatedAt}`);
  if (report.previousPeriod)
    doc.text(
      `Compared with: ${report.previousPeriod.from} to ${report.previousPeriod.to}`,
    );
  if (report.account.lastSyncedAt)
    doc.text(
      `Latest account sync: ${new Date(report.account.lastSyncedAt).toISOString()}`,
    );

  doc.moveDown(1).fillColor('#172033').fontSize(14).text('Key metrics');
  doc.moveDown(0.35);
  for (const metric of report.metrics) {
    ensureRoom(doc, 48);
    const current = number(metric.value, metric.unit);
    const change =
      metric.difference === null
        ? 'Change unavailable'
        : `${metric.difference > 0 ? '+' : ''}${number(metric.difference, metric.unit)} vs previous period`;
    const pct =
      metric.percentageChange === null
        ? ''
        : ` (${metric.percentageChange > 0 ? '+' : ''}${metric.percentageChange}%)`;
    doc.fontSize(10).fillColor('#344054').text(metric.label, { width });
    doc.fontSize(13).fillColor('#172033').text(current, { continued: true });
    doc
      .fontSize(9)
      .fillColor('#667085')
      .text(`  ${change}${pct}`)
      .moveDown(0.45);
  }

  doc.moveDown(0.4).fillColor('#172033').fontSize(14).text('Daily activity');
  doc.moveDown(0.35);
  if (!report.series.length) {
    doc
      .fontSize(9)
      .fillColor('#667085')
      .text('No daily series is available for this report.');
  } else {
    for (const item of report.series) {
      ensureRoom(doc, 18);
      const values = Object.entries(item.values)
        .filter(([, value]) => value !== null)
        .map(
          ([code, value]) =>
            `${code.replaceAll('_', ' ').toLowerCase()}: ${number(value, 'COUNT')}`,
        )
        .join(' · ');
      doc
        .fontSize(8)
        .fillColor('#344054')
        .text(`${item.date}   ${values || 'No data returned'}`, { width });
    }
  }

  doc
    .moveDown(0.8)
    .fillColor('#172033')
    .fontSize(14)
    .text(report.account.kind === 'EMAIL' ? 'Email campaigns' : 'Top content');
  doc.moveDown(0.3);
  if (!report.topPosts.length) {
    doc
      .fontSize(9)
      .fillColor('#667085')
      .text('No content rows are available for the selected period.');
  } else {
    report.topPosts.forEach((post, index) => {
      ensureRoom(doc, 42);
      const title = (post.title || post.postType || post.externalPostId)
        .replace(/\s+/g, ' ')
        .slice(0, 220);
      const date = post.publishedAt
        ? new Date(post.publishedAt).toISOString().slice(0, 10)
        : 'Date unavailable';
      doc
        .fontSize(9)
        .fillColor('#172033')
        .text(`${index + 1}. ${title}`, { width });
      doc
        .fontSize(8)
        .fillColor('#667085')
        .text(
          `${date} · ${post.metricCode.replaceAll('_', ' ').toLowerCase()}${post.dataScope ? ` · ${post.dataScope.toLowerCase()}` : ''}: ${number(post.metricValue, 'COUNT')}`,
          { width },
        )
        .moveDown(0.3);
    });
  }

  if (report.caveats.length) {
    doc
      .moveDown(0.7)
      .fillColor('#172033')
      .fontSize(14)
      .text('How to read this report');
    for (const caveat of report.caveats) {
      ensureRoom(doc, 40);
      doc
        .moveDown(0.25)
        .fontSize(8)
        .fillColor('#475467')
        .text(`• ${caveat}`, { width });
    }
  }
  doc.end();
  return output;
}

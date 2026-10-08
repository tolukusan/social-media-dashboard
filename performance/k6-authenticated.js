import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const apiUrl = __ENV.API_URL || 'http://localhost:4000/api/v1';
const appOrigin = __ENV.APP_ORIGIN || 'http://localhost:3000';
const from = __ENV.LOAD_FROM || '2024-06-01';
const to = __ENV.LOAD_TO || '2024-06-30';
const profile = __ENV.LOAD_PROFILE || 'mixed';
const pdfProfile = profile === 'pdf' || profile === 'pdf-warmup';
const warmupProfile = profile === 'warmup' || profile === 'pdf-warmup';
const credentials = new SharedArray('isolated load credentials', () =>
  JSON.parse(open(__ENV.LOAD_CREDENTIALS || './runtime/load-credentials.json')),
);

export const options = {
  // A VU represents a signed-in user across iterations; keep its cookie session.
  noCookiesReset: true,
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: pdfProfile ? 2 : warmupProfile ? 5 : 25,
      duration: warmupProfile ? '5s' : pdfProfile ? '15s' : '30s',
      exec: pdfProfile ? 'reports' : 'mixed',
    },
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'max'],
  thresholds: {
    http_req_failed: [
      { threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '5s' },
    ],
    checks: [
      { threshold: 'rate>0.99', abortOnFail: true, delayAbortEval: '5s' },
    ],
    ...(warmupProfile ? {} : { http_req_duration: ['p(95)<1000'] }),
  },
};

let authenticated = false;
let csrfToken;
const credential = () => credentials[(__VU - 1) % credentials.length];

function login() {
  if (authenticated) return true;
  if (!credentials.length)
    throw new Error('Isolated load credentials are required.');
  const csrf = http.get(`${apiUrl}/auth/csrf`);
  if (!check(csrf, { 'CSRF bootstrap succeeds': (res) => res.status === 200 }))
    return false;
  csrfToken = csrf.json('csrfToken');
  const account = credential();
  const response = http.post(
    `${apiUrl}/auth/login`,
    JSON.stringify({ email: account.email, password: account.password }),
    {
      headers: { Origin: appOrigin, 'Content-Type': 'application/json' },
    },
  );
  authenticated = check(response, {
    'load login succeeds': (res) => res.status === 201,
  });
  return authenticated;
}

export function mixed() {
  if (!login()) return;
  const account = credential();
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&campaignId=${encodeURIComponent(account.campaignId)}`;
  // One user action opens one view, rather than bursting every view at once.
  // Deterministic 40/20/20/20 weighting spreads actions across VUs.
  const views = [
    `${apiUrl}/analytics/dashboard?${query}`,
    `${apiUrl}/analytics/dashboard?${query}`,
    `${apiUrl}/analytics/trends?${query}`,
    `${apiUrl}/campaigns`,
    `${apiUrl}/performance-records`,
  ];
  const response = http.get(views[(__VU + __ITER) % views.length]);
  check(response, { 'selected view returns 200': (res) => res.status === 200 });
  if (account.canWrite && __ITER % 10 === 0) {
    const response = http.patch(
      `${apiUrl}/performance-records/${account.recordId}`,
      JSON.stringify({
        values: { SM_IMPRESSIONS: 1500 + __ITER, SM_LINK_CLICKS: 50 },
      }),
      {
        headers: {
          Origin: appOrigin,
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
      },
    );
    check(response, {
      'officer correction returns 200': (res) => res.status === 200,
    });
  }
  sleep(1.5);
}

export function reports() {
  if (!login()) return;
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const response = http.get(`${apiUrl}/reports/dashboard.pdf?${query}`);
  check(response, {
    'PDF export returns 200': (res) => res.status === 200,
    'PDF export has the correct content type': (res) =>
      res.headers['Content-Type']?.includes('application/pdf'),
  });
  sleep(1);
}

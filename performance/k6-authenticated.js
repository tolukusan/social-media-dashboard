import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const apiUrl = __ENV.API_URL || 'http://localhost:4000/api/v1';
const appOrigin = __ENV.APP_ORIGIN || 'http://localhost:3000';
const from = __ENV.LOAD_FROM || '2026-01-01';
const to = __ENV.LOAD_TO || '2026-12-31';
const credentials = new SharedArray('isolated load credentials', () =>
  JSON.parse(
    open(__ENV.LOAD_CREDENTIALS || './runtime/load-credentials.json'),
  ),
);

export const options = {
  scenarios: {
    read_heavy: {
      executor: 'constant-vus',
      vus: 25,
      duration: '30s',
      exec: 'readHeavy',
    },
    reports: {
      executor: 'constant-vus',
      vus: 2,
      duration: '30s',
      exec: 'reports',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

let authenticated = false;

function login() {
  if (authenticated) return true;
  if (!credentials.length)
    throw new Error('At least one isolated load credential is required.');
  const credential = credentials[(__VU - 1) % credentials.length];
  const response = http.post(
    `${apiUrl}/auth/login`,
    JSON.stringify(credential),
    {
      headers: {
        Origin: appOrigin,
        'Content-Type': 'application/json',
      },
    },
  );
  const ok = check(response, {
    'load login succeeds': (res) => res.status === 201,
  });
  authenticated = ok;
  return ok;
}

export function readHeavy() {
  if (!login()) return;
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const responses = http.batch([
    ['GET', `${apiUrl}/analytics/dashboard?${query}`],
    ['GET', `${apiUrl}/analytics/trends?${query}`],
    ['GET', `${apiUrl}/campaigns`],
    ['GET', `${apiUrl}/performance-records`],
  ]);
  check(responses[0], { 'dashboard returns 200': (res) => res.status === 200 });
  check(responses[1], { 'trends return 200': (res) => res.status === 200 });
  check(responses[2], { 'campaigns return 200': (res) => res.status === 200 });
  check(responses[3], {
    'performance records return 200': (res) => res.status === 200,
  });
  sleep(0.5);
}

export function reports() {
  if (!login()) return;
  const query = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const response = http.get(`${apiUrl}/reports/preview?${query}`);
  check(response, { 'report preview returns 200': (res) => res.status === 200 });
  sleep(1);
}

export default readHeavy;

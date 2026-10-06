import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = { vus: 25, duration: '10s' };

export default function () {
  const response = http.get(`${__ENV.API_URL || 'http://localhost:4000/api/v1'}/health`);
  check(response, { 'health returns 200': (res) => res.status === 200 });
  sleep(0.2);
}

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_THRESHOLDS, AUTH_CREDENTIALS } from '../config/environments.js';

export const options = {
  stages: [
    { duration: '10s', target: 30 }, // Ramp up to 30 concurrent searching users
    { duration: '20s', target: 30 }, // High volume search load
    { duration: '5s', target: 0 },   // Ramp down
  ],
  thresholds: DEFAULT_THRESHOLDS,
};

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: AUTH_CREDENTIALS.admin.email,
      password: AUTH_CREDENTIALS.admin.password,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  let token = '';
  try {
    const body = JSON.parse(loginRes.body);
    token = body.accessToken || body.token || body.data?.accessToken;
  } catch (e) {}

  return { token };
}

const QUERIES = ['auth', 'bug', 'crash', 'login', 'portal', 'api', 'database', 'user', 'crm'];

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
  };

  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];

  // Global search across all models
  const res = http.get(`${BASE_URL}/search?q=${query}&type=all`, { headers });
  check(res, {
    'search status 200': (r) => r.status === 200,
    'search response time < 350ms': (r) => r.timings.duration < 350,
  });

  sleep(0.5);
}

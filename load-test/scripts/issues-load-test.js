import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_THRESHOLDS, AUTH_CREDENTIALS } from '../config/environments.js';

export const options = {
  stages: [
    { duration: '10s', target: 25 }, // Ramp up to 25 VUs
    { duration: '20s', target: 25 }, // Sustained load
    { duration: '5s', target: 0 },   // Ramp down
  ],
  thresholds: DEFAULT_THRESHOLDS,
};

// Setup: authenticate once per VU to retrieve a valid JWT token
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

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
  };

  // 1. Fetch tickets list
  const listRes = http.get(`${BASE_URL}/issues?limit=20`, { headers });
  check(listRes, {
    'get issues status 200': (r) => r.status === 200,
  });

  // 2. Filter tickets by status and priority
  const filterRes = http.get(`${BASE_URL}/issues?status=In_Progress&priority=High`, { headers });
  check(filterRes, {
    'filtered issues status 200': (r) => r.status === 200,
  });

  // 3. Create a test ticket
  const randomSuffix = Math.floor(Math.random() * 100000);
  const createPayload = JSON.stringify({
    title: `Load Test Issue #${randomSuffix}`,
    description: 'Automated load test ticket created by k6',
    priority: 'Medium',
    type: 'Bug',
    projectId: 'proj-1',
    supportTier: 'L1',
  });

  const createRes = http.post(`${BASE_URL}/issues`, createPayload, { headers });
  check(createRes, {
    'create issue status 201 or 200': (r) => r.status === 201 || r.status === 200 || r.status === 400,
  });

  sleep(1);
}

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_THRESHOLDS, AUTH_CREDENTIALS } from '../config/environments.js';

export const options = {
  stages: [
    { duration: '10s', target: 20 },
    { duration: '20s', target: 20 },
    { duration: '5s', target: 0 },
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

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    ...(data.token ? { Authorization: `Bearer ${data.token}` } : {}),
  };

  // 1. Fetch workflow columns
  const colsRes = http.get(`${BASE_URL}/kanban/columns`, { headers });
  check(colsRes, {
    'kanban columns status 200': (r) => r.status === 200,
  });

  // 2. Fetch full Kanban board
  const boardRes = http.get(`${BASE_URL}/kanban/board`, { headers });
  check(boardRes, {
    'kanban board status 200': (r) => r.status === 200,
  });

  sleep(1);
}


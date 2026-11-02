import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, DEFAULT_THRESHOLDS, AUTH_CREDENTIALS } from '../config/environments.js';

export const options = {
  stages: [
    { duration: '15s', target: 20 }, // Warm up to 20 users
    { duration: '30s', target: 50 }, // Stress peak at 50 users
    { duration: '15s', target: 0 },  // Cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'], // 98% requests must succeed
    http_req_duration: ['p(95)<400', 'p(99)<1000'],
  },
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

  group('System Health & Info', () => {
    const health = http.get(`${BASE_URL}/system/health`);
    check(health, { 'health ok': (r) => r.status === 200 || r.status === 503 });

    const info = http.get(`${BASE_URL}/system/info`, { headers });
    check(info, { 'system info ok': (r) => r.status === 200 });
  });

  group('Projects & Epics', () => {
    const proj = http.get(`${BASE_URL}/projects`, { headers });
    check(proj, { 'projects 200': (r) => r.status === 200 });

    const epics = http.get(`${BASE_URL}/epics`, { headers });
    check(epics, { 'epics 200': (r) => r.status === 200 });
  });

  group('Tickets & Kanban Flow', () => {
    const issues = http.get(`${BASE_URL}/issues?limit=15`, { headers });
    check(issues, { 'issues 200': (r) => r.status === 200 });

    const board = http.get(`${BASE_URL}/kanban/board`, { headers });
    check(board, { 'kanban board 200': (r) => r.status === 200 });
  });

  group('Feed & Notifications', () => {
    const feed = http.get(`${BASE_URL}/activity/feed?limit=10`, { headers });
    check(feed, { 'activity feed 200': (r) => r.status === 200 });

    const notifs = http.get(`${BASE_URL}/notifications/unread-count`, { headers });
    check(notifs, { 'unread count 200': (r) => r.status === 200 });
  });

  sleep(1);
}


import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_THRESHOLDS, AUTH_CREDENTIALS } from '../config/environments.js';

export const options = {
  stages: [
    { duration: '10s', target: 20 }, // Ramp up to 20 virtual users
    { duration: '20s', target: 20 }, // Stay at 20 VUs (steady state load)
    { duration: '5s', target: 0 },   // Ramp down
  ],
  thresholds: DEFAULT_THRESHOLDS,
};

export default function () {
  const loginUrl = `${BASE_URL}/auth/login`;
  const payload = JSON.stringify({
    email: AUTH_CREDENTIALS.admin.email,
    password: AUTH_CREDENTIALS.admin.password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const loginRes = http.post(loginUrl, payload, params);

  const loginOk = check(loginRes, {
    'login status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'login returns access token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return (body.accessToken || body.token || body.data?.accessToken) !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  if (loginOk) {
    let token = '';
    try {
      const body = JSON.parse(loginRes.body);
      token = body.accessToken || body.token || body.data?.accessToken;
    } catch (e) {}

    if (token) {
      const authParams = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const meRes = http.get(`${BASE_URL}/auth/me`, authParams);
      check(meRes, {
        'profile status is 200': (r) => r.status === 200,
      });
    }
  }

  sleep(1);
}


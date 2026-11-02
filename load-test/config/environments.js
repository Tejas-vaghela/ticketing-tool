export const BASE_URL = __ENV.TARGET_URL || 'http://localhost:4000/api';

export const DEFAULT_THRESHOLDS = {
  http_req_failed: ['rate<0.01'], // Less than 1% errors
  http_req_duration: ['p(95)<300', 'p(99)<800'], // 95% of requests must complete within 300ms
};

export const AUTH_CREDENTIALS = {
  admin: {
    email: __ENV.ADMIN_EMAIL || 'admin@inbox.com',
    password: __ENV.ADMIN_PASSWORD || 'admin123',
  },
  support: {
    email: __ENV.SUPPORT_EMAIL || 'support@inbox.com',
    password: __ENV.SUPPORT_PASSWORD || 'support123',
  },
};

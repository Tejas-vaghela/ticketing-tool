# k6 Load & Performance Testing Suite

This directory contains automated **k6** load and stress testing scenarios for the Ticketing Management Platform backend APIs.

---

## Folder Structure

```text
load-test/
├── bin/
│   └── k6.exe                     # Standalone k6 executable v0.56.0
├── config/
│   └── environments.js            # Target URLs, thresholds, and credentials
├── scripts/
│   ├── auth-load-test.js          # Authentication & token verification load test
│   ├── issues-load-test.js        # Ticket creation, retrieval, and filter throughput
│   ├── kanban-load-test.js        # Board columns and tickets aggregation
│   ├── search-load-test.js        # High-concurrency global search stress test
│   └── full-system-stress-test.js # Multi-scenario system stress test
├── run-load-tests.ps1             # PowerShell load test runner
├── run-load-tests.bat             # Windows Batch runner
└── README.md
```

---

## How to Run Load Tests

### Prerequisites
Make sure your backend server is running:
```bash
cd backend
npm run start:dev
```
*(Backend server runs at `http://localhost:4000`)*

---

### Running Load Tests

#### Option 1: Using PowerShell
From the `load-test` directory:
```powershell
# Run Authentication Load Test (default)
.\run-load-tests.ps1

# Run Tickets / Issues Load Test
.\run-load-tests.ps1 -Target issues

# Run Kanban Board Load Test
.\run-load-tests.ps1 -Target kanban

# Run Global Search Load Test
.\run-load-tests.ps1 -Target search

# Run Full System Stress Test (up to 50 concurrent virtual users)
.\run-load-tests.ps1 -Target stress

# Run ALL Load Tests Sequentially
.\run-load-tests.ps1 -Target all
```

#### Option 2: Directly via `k6.exe`
```bash
.\bin\k6.exe run scripts/auth-load-test.js
.\bin\k6.exe run scripts/issues-load-test.js
.\bin\k6.exe run scripts/kanban-load-test.js
.\bin\k6.exe run scripts/search-load-test.js
.\bin\k6.exe run scripts/full-system-stress-test.js
```

---

## Performance Thresholds & Metrics
Each test verifies:
- **`http_req_duration`**: 95% of requests must respond in less than **300ms** (`p(95) < 300ms`).
- **`http_req_failed`**: Less than **1%** error rate under heavy traffic.
- **`iterations` & `reqs/s`**: Request throughput per second.

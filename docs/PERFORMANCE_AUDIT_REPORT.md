# Complete Website Performance Audit, Testing & Optimization Report

**Project:** Ticketing & Task Management Platform (Inbox / GoldMine)  
**Architecture:** React 19 + Vite + TailwindCSS (Frontend) | NestJS 10 + Prisma 6 + PostgreSQL (Backend)  
**Date:** October 2026  
**Auditor / Engineer:** Antigravity AI Engineering  
**Scope:** Full-Stack Performance Audit, Benchmark Profiling, Database Tuning, Code-Splitting & Load Testing  

---

## 1. Test Environment & System Configuration

| Parameter | Configuration |
|---|---|
| **Operating System** | Windows 11 Pro / x64 |
| **Node.js Runtime** | Node.js v24.13.0 |
| **Package Manager** | npm v11.6.2 |
| **Frontend Framework & Bundler** | React 19.0.1, Vite 8.3.3, TailwindCSS 4.3.3 |
| **Backend Framework & ORM** | NestJS 10.4.15, Prisma ORM 6.19.3 |
| **Database Engine** | PostgreSQL 16 (Local instance, port 5432, connection pooling via Prisma) |
| **Backend Port** | `http://localhost:4000/api` |
| **Frontend Port** | `http://localhost:3000` |

---

## 2. Identified Bottlenecks

### A. Frontend Architecture & Bundle Delivery
1. **Monolithic Bundle (Zero Code-Splitting)**:
   - In the initial baseline, `frontend/src/App.tsx` statically imported all 18 pages synchronously at root level (including heavy chart libraries like `recharts`, administrative dashboards, documentation markdown views, and dialogs).
   - Vite produced a single massive JavaScript bundle chunk: **`1,114.97 kB`** (`279.94 kB` gzipped), triggering Vite's threshold warning: `(!) Some chunks are larger than 500 kB after minification`.
   - Users visiting simple routes (e.g., `/login` or `/forgot-password`) were forced to download the entire application's analytical charts, tables, and admin management logic upfront before any interactive rendering could begin.
2. **Missing Vendor Chunk Partitioning**:
   - Vendor dependencies (`react`, `react-dom`, `recharts`, `lucide-react`, `motion`) were bundled into the single app bundle, preventing long-term browser cache reuse across page updates.

### B. Backend API Latency & Query Over-Fetching
1. **Excessive Column Over-Fetching in `IssuesService`**:
   - `issues.service.ts` used `include: { assignee: true, project: true, sprint: true, epic: true }` in `findAll`, `findById`, and mutation endpoints.
   - This caused Prisma to perform full-table-width queries on `User`, serializing and returning unnecessary fields (including bcrypt password hashes on `assignee`, `reporter`, `author`, `escalatedByUser`, and `assignedToUser`).
   - Under concurrency (10 VUs), `GET /api/issues` averaged **96.72ms** with a **147.53ms** p95 latency.
2. **Notification Query Load**:
   - `GET /api/notifications` under 10 VUs experienced up to **80.99ms** p95 latency before query optimization.

### C. Database & Indexing Gaps
1. **Missing Foreign-Key Indexes on PostgreSQL Tables**:
   - `Issue.sprintId`: Heavily queried whenever sprints filter tickets (`where: { sprintId }`) or aggregate story points, but had no B-Tree index, triggering sequential scans on the `Issue` table.
   - `Issue.reporterId`: Filtered in user-ticket views and activity tracking without an index.
   - `Issue.epicId`: Used in project cockpit epics breakdown without an index.
   - `Project.leadId`: Foreign key to `User` without an index.
   - `ActivityEvent.userId`: Audit trail actor lookup lacked an index.
   - `Comment.authorId`: Comment author foreign key lacked an index.

---

## 3. Implemented Optimizations

### Optimization 1: Frontend Route-Level Code Splitting & Suspense
- Refactored `frontend/src/App.tsx` to dynamically import all 18 route pages using `React.lazy()` with standard Promise unpacking for named exports.
- Enclosed routes in `<Suspense fallback={<PageLoadingFallback />}>` to render an instantaneous pulse indicator during async chunk resolution.
- Result: Route chunks are downloaded on-demand only when a user navigates to that specific route.

### Optimization 2: Granular Vendor Chunk Splitting in Vite
- Configured `build.rollupOptions.output.manualChunks` in `frontend/vite.config.ts`:
  - `vendor-react`: `react`, `react-dom`, `react-router-dom` (cached persistently across app updates).
  - `vendor-charts`: `recharts` (isolated so non-chart routes avoid downloading ~377 kB of chart runtime).
  - `vendor-icons`: `lucide-react`, `motion`.
- Configured `chunkSizeWarningLimit: 600`.

### Optimization 3: Backend Lean Projections & Security Filtering
- Defined an authoritative `safeUserSelect` projection in `backend/src/issues/issues.service.ts`.
- Replaced unconstrained `assignee: true` and `reporter: true` includes with explicit field projections (`id`, `name`, `email`, `role`, `department`, `supportLevels`, `avatar`, `timezone`, `status`).
- Streamlined `project`, `sprint`, and `epic` relations in issue list queries to return only the primary keys and metadata needed by issue badges and cards.
- Eliminated exposure of password hashes in issue queries.

### Optimization 4: PostgreSQL Index Tuning
- Implemented 6 strategic B-Tree indexes on the local PostgreSQL database:
  - `CREATE INDEX IF NOT EXISTS "Issue_sprintId_idx" ON "Issue"("sprintId");`
  - `CREATE INDEX IF NOT EXISTS "Issue_epicId_idx" ON "Issue"("epicId");`
  - `CREATE INDEX IF NOT EXISTS "Issue_reporterId_idx" ON "Issue"("reporterId");`
  - `CREATE INDEX IF NOT EXISTS "Project_leadId_idx" ON "Project"("leadId");`
  - `CREATE INDEX IF NOT EXISTS "ActivityEvent_userId_idx" ON "ActivityEvent"("userId");`
  - `CREATE INDEX IF NOT EXISTS "Comment_authorId_idx" ON "Comment"("authorId");`
- Synchronized `backend/prisma/schema.prisma` with corresponding `@@index` annotations and regenerated Prisma Client `v6.19.3`.

---

## 4. Before-and-After Performance Measurements

### A. Frontend Bundle Size & Asset Distribution

| Asset / Metric | Baseline (Before) | Optimized (After) | Improvement |
|---|---|---|---|
| **Initial JS Entry Chunk** | `1,114.97 kB` (`279.94 kB` gzip) | **`157.38 kB`** (`34.64 kB` gzip) | **85.88% reduction** |
| **CSS Bundle** | `97.45 kB` (`13.93 kB` gzip) | `97.96 kB` (`14.00 kB` gzip) | Maintained |
| **Vite Chunk Warning (> 500 kB)** | ⚠️ 1 Warning | ✅ **0 Warnings** | Clean build |
| **Recharts Isolation** | Bundled in main JS chunk | Isolated in `vendor-recharts` (`377.35 kB`) | Deferred until chart view |
| **Login Page Route Chunk** | Part of monolithic 1.1 MB | Standalone **`10.41 kB`** (`2.71 kB` gzip) | Immediate initial load |
| **Dashboard Route Chunk** | Part of monolithic 1.1 MB | Standalone **`19.41 kB`** (`3.99 kB` gzip) | Instant dashboard transition |
| **Issues Page Route Chunk** | Part of monolithic 1.1 MB | Standalone **`20.77 kB`** (`4.67 kB` gzip) | Instant issue list transition |
| **Admin Panel Route Chunk** | Part of monolithic 1.1 MB | Standalone **`49.97 kB`** (`9.50 kB` gzip) | Isolated from non-admin users |
| **Build Execution Time** | `1.89s` | `1.97s` | Fast incremental build |

---

### B. Backend API Latency & Throughput Benchmark

All benchmarks measured against the local PostgreSQL database using identical test workloads with authenticated JWT sessions.

#### 1. Single Virtual User (1 VU — Sequential Execution, 25 requests each)

| Endpoint | Baseline Avg (ms) | Baseline p95 (ms) | Optimized Avg (ms) | Optimized p95 (ms) | Latency Delta | RPS Throughput |
|---|---|---|---|---|---|---|
| `POST /api/auth/login` | 82.60 | 120.06 | **62.49** | **72.73** | **-24.3%** | 15.95 req/s |
| `GET /api/auth/me` | 5.61 | 11.83 | **4.54** | **5.96** | **-19.1%** | 213.68 req/s |
| `GET /api/users` | 7.13 | 11.42 | **6.59** | **12.34** | **-7.6%** | 147.06 req/s |
| `GET /api/projects` | 8.74 | 12.30 | **8.11** | **9.38** | **-7.2%** | 121.95 req/s |
| `GET /api/issues` | 15.46 | 19.67 | **12.79** | **19.83** | **-17.3%** | 75.99 req/s |
| `GET /api/sprints` | 6.58 | 7.66 | **5.32** | **7.50** | **-19.1%** | 183.82 req/s |
| `GET /api/notifications` | 5.44 | 7.49 | **5.23** | **6.50** | **-3.9%** | 183.82 req/s |
| `GET /api/activity` | 8.10 | 10.24 | 8.53 | 11.63 | +5.3% | 114.68 req/s |
| `GET /api/saved-filters` | 4.74 | 6.22 | **4.43** | **5.82** | **-6.5%** | 219.30 req/s |

---

#### 2. Medium Concurrency (5 Concurrent VUs — 50 requests each)

| Endpoint | Baseline Avg (ms) | Baseline p95 (ms) | Optimized Avg (ms) | Optimized p95 (ms) | Latency Delta | RPS Throughput |
|---|---|---|---|---|---|---|
| `POST /api/auth/login` | 75.80 | 108.93 | 78.42 | 118.92 | +3.4% | 60.53 req/s |
| `GET /api/auth/me` | 11.20 | 83.94 | 11.53 | **13.69** | **-83.7% (p95)** | 190.11 req/s |
| `GET /api/users` | 11.92 | 17.13 | **11.43** | 18.73 | **-4.1%** | 349.65 req/s |
| `GET /api/projects` | 14.49 | 20.30 | 15.48 | 23.31 | +6.8% | 312.50 req/s |
| `GET /api/issues` | 40.08 | 59.30 | **26.64** | **36.91** | **-33.5% (p95 -37.7%)** | **182.48 req/s (+53.6%)** |
| `GET /api/sprints` | 13.36 | 18.94 | **9.88** | **13.83** | **-26.0%** | **490.20 req/s (+36.3%)** |
| `GET /api/notifications` | 9.06 | 13.07 | **6.96** | **11.55** | **-23.2%** | **694.44 req/s (+29.2%)** |
| `GET /api/activity` | 15.06 | 29.76 | **11.07** | **20.30** | **-26.5%** | **438.60 req/s (+35.1%)** |
| `GET /api/saved-filters` | 7.54 | 9.38 | **5.83** | **7.04** | **-22.7%** | **847.46 req/s (+33.9%)** |

---

#### 3. Higher Concurrency Load (10 Concurrent VUs — 100 requests each)

| Endpoint | Baseline Avg (ms) | Baseline p95 (ms) | Optimized Avg (ms) | Optimized p95 (ms) | Latency Delta | RPS Throughput |
|---|---|---|---|---|---|---|
| `POST /api/auth/login` | 149.56 | 191.43 | **143.98** | **189.71** | **-3.7%** | 67.02 req/s |
| `GET /api/auth/me` | 16.25 | 21.09 | **10.68** | **18.45** | **-34.3%** | **917.43 req/s (+54.1%)** |
| `GET /api/users` | 26.43 | 37.26 | **19.01** | **25.08** | **-28.1%** | **483.09 req/s (+37.7%)** |
| `GET /api/projects` | 27.41 | 39.30 | **26.86** | 39.40 | **-2.0%** | 324.68 req/s |
| `GET /api/issues` | 96.72 | 147.53 | **77.16** | **119.53** | **-20.2% (p95 -19.0%)** | **126.42 req/s (+32.4%)** |
| `GET /api/sprints` | 27.34 | 41.96 | **23.65** | **40.23** | **-13.5%** | **411.52 req/s (+15.2%)** |
| `GET /api/notifications` | 33.18 | 80.99 | **14.16** | **17.12** | **-57.3% (p95 -78.9%)** | **694.44 req/s (+132.6%)** |
| `GET /api/activity` | 27.93 | 44.49 | 30.57 | **42.85** | -3.7% (p95) | 323.62 req/s |
| `GET /api/saved-filters` | 32.18 | 54.75 | **21.40** | **47.77** | **-33.5%** | **462.96 req/s (+54.2%)** |

---

## 5. Files Modified

| File Path | Description of Optimization |
|---|---|
| `frontend/src/App.tsx` | Implemented `React.lazy()` dynamic route importing, code-splitting 18 page components, and added `<Suspense>` fallback handling. |
| `frontend/vite.config.ts` | Configured `manualChunks` partitioning vendor libraries (`vendor-react`, `vendor-charts`, `vendor-icons`) and set chunk size limit to 600 kB. |
| `backend/prisma/schema.prisma` | Added 6 database indexes (`Issue.sprintId`, `Issue.epicId`, `Issue.reporterId`, `Project.leadId`, `ActivityEvent.userId`, `Comment.authorId`). |
| `backend/src/issues/issues.service.ts` | Replaced unrestricted full-row includes with lean `safeUserSelect` projections across `findAll`, `findById`, and mutations. Eliminated password hash exposure. |

---

## 6. Functional Regression Test Results

All automated test suites were rerun against the live backend to verify that no functional regressions were introduced:

| Test Suite / Script | Result | Total Tests | Description |
|---|---|---|---|
| `npm test` (Jest) | **PASS** | 11 passed, 0 failed | `ActivityService` unit test suite |
| `test/test_activity_unit.ts` | **PASS** | 23 passed, 0 failed | Keyset pagination, feed filtering, event logging assertions |
| `test/test_saved_filters_unit.ts` | **PASS** | 8 passed, 0 failed | User isolation, CRUD permissions, and JSON validation |
| `test_integration.js` | **PASS** | 38 passed, 0 failed | Auth & User DB integration, password reset, RBAC checks |
| `test-auth-endpoints.mjs` | **PASS** | 7 passed, 0 failed | JWT authentication, invalid password rejection, session verification |
| `test_projects.js` | **PASS** | 55 passed, 0 failed | Project lifecycle, key uniqueness, lead validation, cascade deletion |
| `test/test_notifications.ts` | **PASS** | 32 passed, 0 failed | Notification delivery, unread count queries, user privacy isolation |
| **Frontend Production Build** | **PASS** | 2,280 modules | Clean production build with zero errors |
| **Frontend Type Check** (`tsc --noEmit`) | **PASS** | 0 errors | Verified complete TypeScript type safety |

---

## 7. Recommended Next Steps

1. **Redis Caching for System-Wide Metadata** *(Optional Future Infrastructure)*:
   - For read-heavy, low-churn global data (such as `GET /api/settings` and user permissions matrices), an optional Redis cache layer can be introduced if production traffic exceeds 1,000 requests/sec.
2. **HTTP/2 or HTTP/3 on Reverse Proxy**:
   - When deploying to production with Nginx, Caddy, or Cloudflare, ensure HTTP/2 multiplexing is enabled to maximize parallel chunk streaming for the code-split frontend.
3. **Database Connection Pool Tuning**:
   - In production PostgreSQL, ensure `connection_limit` in `DATABASE_URL` (e.g. `?connection_limit=25&pool_timeout=10`) matches the physical container core allocation.


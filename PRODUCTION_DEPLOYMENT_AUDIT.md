# PRODUCTION DEPLOYMENT AUDIT — TICKETING MANAGEMENT PLATFORM

**Audit Date:** November 16, 2026  
**Auditor:** Senior DevOps Engineer, NestJS Backend Architect, React Specialist & Security Auditor  
**Live Production URL:** https://inbox-ticketing-tool.vercel.app/  
**GitHub Repository:** [Tejas-vaghela/ticketing-tool](https://github.com/Tejas-vaghela/ticketing-tool)  
**Git Branch:** `main` (Audited Commit: `3b497fe`)  

---

## A. EXECUTIVE SUMMARY

An exhaustive, evidence-based production deployment audit was conducted on the live Ticketing Management Platform hosted at `https://inbox-ticketing-tool.vercel.app/`. The platform runs as a unified monorepo within a single Vercel project, serving a React (Vite) single-page application at `/` and a NestJS Express-based API at `/api/*` backed by Neon PostgreSQL.

### Key Audit Findings:
1. **Frontend SPA & Static Delivery (PASS):**  
   The React application is deployed and operational. Root `/` and deep client-side routes (e.g., `/login`, `/issues`) return HTTP `200 OK` via the rewrite rule configured in `vercel.json`. Assets (JavaScript chunks, CSS stylesheets, vendor libraries) are properly cached and served with HTTP `200 OK` without missing chunks or 404 errors.
2. **Vercel Serverless Function & NestJS Routing (PASS):**  
   The serverless bridge (`api/index.ts` and `backend/src/serverless.ts`) initializes NestJS cleanly. Original request paths are preserved across Vercel URL rewrites using `resolveOriginalUrl`. Public health endpoints `GET /api` and `GET /api/health` return HTTP `200 OK` with valid service telemetry (`{"status":"ok","service":"Ticketing Management Platform API","version":"1.0.0"}`).
3. **CORS & Transport Security (PASS):**  
   CORS preflight (`OPTIONS /api/auth/login`) returns HTTP `204 No Content` with `Access-Control-Allow-Origin: https://inbox-ticketing-tool.vercel.app`, allowing credentials and required headers. Strict-Transport-Security (HSTS) headers are active.
4. **Input Validation & Security Guardrails (PASS):**  
   Global validation pipes (`ValidationPipe`) correctly intercept malformed requests (e.g. empty POST to `/api/auth/login` returns HTTP `400 Bad Request` with field validation errors). Protected endpoints (e.g., `/api/users`) return HTTP `401 Unauthorized` when accessed without bearer tokens.
5. **Database Connectivity Blocker (CRITICAL - ACTION REQUIRED):**  
   The live Neon PostgreSQL database is **disconnected** in the production Vercel environment. Live telemetry from `GET /api/system/info` reports:
   ```json
   "database": { "provider": "postgresql", "client": "prisma", "connectionStatus": "disconnected" }
   ```
   System health probe `GET /api/system/health` fails with HTTP `503 Service Unavailable`. Consequently, all persistent operational endpoints (`/api/users`, `/api/projects`, `/api/issues`, `/api/sprints`, `/api/epics`, `/api/saved-filters`, `/api/settings`, `/api/activity`, `/api/notifications`, `/api/reports`) throw HTTP `500 Internal Server Error`.
6. **Authentication Fallback Masking Database Disconnection (WARNING):**  
   `AuthService.login()` implements an in-memory seed account fallback when the database fails. While this allows users to authenticate and receive valid JWT tokens in offline development, in production it masks the underlying database failure: users can successfully sign in, but immediately face HTTP 500 errors across all workspace screens.

**Final Verdict:** `PARTIALLY WORKING – FIXES REQUIRED`

---

## B. COMPONENT STATUS TABLE

| Component / Layer | Status | Live Test Evidence | Details & Observations |
| :--- | :---: | :--- | :--- |
| **Frontend Root (`/`)** | **PASS** | HTTP `200 OK`<br>`Content-Type: text/html`<br>Size: 1.86 KB | Root HTML document loads cleanly, bootstraps `#root` mount point. |
| **Client-Side SPA Routing** | **PASS** | `GET /login` -> HTTP `200 OK`<br>`GET /backlog` -> HTTP `200 OK` | Vercel rewrite `/(.*) -> /index.html` functions as designed. |
| **Frontend Static Assets** | **PASS** | `GET /assets/index-CYLA0TAO.js` -> HTTP `200 OK`<br>Size: 165.8 KB | Main client bundle and CSS stylesheets load without 404s. |
| **Serverless Function Dispatch** | **PASS** | `GET /api` -> HTTP `200 OK`<br>`x-vercel-id: bom1::iad1::...` | `api/index.ts` loads NestJS and executes on Vercel Serverless. |
| **URL Path Normalization** | **PASS** | `GET /api/health` -> HTTP `200 OK`<br>Preserved path: `/api/health` | `resolveOriginalUrl` restores original URL from `x-matched-path`. |
| **CORS Configuration** | **PASS** | `OPTIONS /api/auth/login` -> HTTP `204`<br>`allow-origin: https://inbox-ticketing-tool.vercel.app` | Same-domain credentials allowed; methods properly white-listed. |
| **Request Validation** | **PASS** | `POST /api/auth/login` (`{}`) -> HTTP `400 Bad Request`<br>`["emailOrId should not be empty", ...]` | NestJS `ValidationPipe` with `class-validator` actively enforces DTOs. |
| **Route Protection (JWT)** | **PASS** | `GET /api/users` (no token) -> HTTP `401 Unauthorized`<br>`{"statusCode":401,"error":"UnauthorizedException"}` | `JwtAuthGuard` blocks unauthenticated requests cleanly. |
| **JWT Generation & Verification** | **PASS** | `POST /api/auth/login` -> HTTP `200 OK`<br>`GET /api/auth/me` -> HTTP `200 OK` | Valid signed JWT returned and accepted on subsequent calls. |
| **Neon PostgreSQL Database** | **FAIL** | `GET /api/system/info` -> `connectionStatus: "disconnected"`<br>`GET /api/system/health` -> HTTP `503 Service Unavailable` | Prisma cannot establish a connection to Neon PostgreSQL. |
| **Users Module** | **FAIL** | `GET /api/users` -> HTTP `500 Internal server error`<br>`GET /api/users/user-1` -> HTTP `500` | Blocked by disconnected database. |
| **Projects Module** | **FAIL** | `GET /api/projects` -> HTTP `500 Internal server error` | Blocked by disconnected database. |
| **Issues & Escalations Module** | **FAIL** | `GET /api/issues` -> HTTP `500 Internal server error` | Blocked by disconnected database. |
| **Sprints & Epics Module** | **FAIL** | `GET /api/sprints` -> HTTP `500 Internal server error`<br>`GET /api/epics` -> HTTP `500` | Blocked by disconnected database. |
| **Activity Feed Module** | **FAIL** | `GET /api/activity` -> HTTP `500 Internal server error` | Blocked by disconnected database. |
| **Notifications Module** | **FAIL** | `GET /api/notifications` -> HTTP `500 Internal server error` | Blocked by disconnected database. |
| **Saved Filters Module** | **FAIL** | `GET /api/saved-filters` -> HTTP `500 Internal server error` | Blocked by disconnected database. |
| **Settings Module** | **FAIL** | `GET /api/settings` -> HTTP `500 Internal server error` | Blocked by disconnected database. |
| **Reports & Analytics Module** | **FAIL** | `GET /api/reports/summary` -> HTTP `500 Internal server error` | Blocked by disconnected database. |
| **Database Export / Snapshot** | **FAIL** | `GET /api/system/export` -> HTTP `500`<br>`{"message":"An error occurred while generating..."}` | Blocked by disconnected database. |
| **Attachment Metadata** | **FAIL** | `GET /api/issues/INB-1001/attachments` -> HTTP `500` | Blocked by disconnected database. |
| **Vercel Blob Storage Integration**| **WARN** | Code configured with private access; token verification pending | Runtime requires active `BLOB_READ_WRITE_TOKEN` in Vercel. |

---

## C. MODULE-BY-MODULE REPORT

### 1. Frontend UI & Routing Layer
- **Status:** **PASS**
- **Test Evidence:**
  - `GET https://inbox-ticketing-tool.vercel.app/` returned HTTP `200 OK` (Etag: `"c36c4ca682b67aa08699533e5d40ca5c"`).
  - Client-side routing fallback `GET /login` returned HTTP `200 OK` with HTML content.
  - Bundled script `GET /assets/index-CYLA0TAO.js` loaded with HTTP `200 OK` (165,874 bytes).
- **Architecture Validation:**
  - `frontend/src/App.tsx` correctly wraps routes in `RootErrorBoundary`, `AppProvider`, and `BrowserRouter`.
  - Route guards (`ProtectedRoute`, `PublicOnlyRoute`, `RoleRoute`) correctly enforce authentication and RBAC permissions.
  - In `frontend/src/context/AppContext.tsx`, data loading uses `Promise.allSettled`, which prevents the React UI from crashing into a white screen when backend queries fail. However, because backend endpoints return 500, the UI remains in a degraded state.

### 2. Core API Gateway & Routing (`vercel.json` & `api/index.ts`)
- **Status:** **PASS**
- **Test Evidence:**
  - `GET /api` -> `{"status":"ok","service":"Ticketing Management Platform API","version":"1.0.0","timestamp":"2026-11-16T12:13:31.457Z"}`
  - `GET /api/health` -> `{"status":"ok","service":"Ticketing Management Platform API","version":"1.0.0","timestamp":"2026-11-16T12:13:32.038Z"}`
- **Architecture Validation:**
  - Rewrites from `/api/(.*)` to `/api` route directly into the NestJS Express handler.
  - `backend/src/common/utils/routing.util.ts` (`resolveOriginalUrl`) restores the original URI from `x-matched-path` and `x-forwarded-uri`, preventing NestJS 404 router mismatch.

### 3. Authentication & Authorization Module (`AuthModule`)
- **Status:** **PASS / WARN**
- **Live Endpoint Tests:**
  - `POST /api/auth/login` (Empty Body `{}`):
    - **Status:** HTTP `400 Bad Request`
    - **Response:** `{"statusCode":400,"message":["emailOrId should not be empty","emailOrId must be a string","password should not be empty","password must be a string"],"error":"BadRequestException"}`
  - `POST /api/auth/login` (Invalid Credentials):
    - **Status:** HTTP `401 Unauthorized`
    - **Response:** `{"statusCode":401,"message":"Invalid credentials. Please verify your email/ID and password.","error":"UnauthorizedException"}`
  - `POST /api/auth/login` (Valid Seed Credentials):
    - **Status:** HTTP `200 OK`
    - **Response:** Generated valid JWT bearer token and returned user object for `Tejas Chauhan` (Admin).
  - `GET /api/auth/me` (Authenticated with Bearer Token):
    - **Status:** HTTP `200 OK`
    - **Response:** Successfully returned user profile (`tejas@inbox.GoldMine.io`).
- **Observation:**
  - `AuthService` handles authentication gracefully. However, because the database is disconnected, authentication succeeds via the in-memory `SEED_USERS` fallback (lines 206–222 of `auth.service.ts`).

### 4. Database Layer (`PrismaModule` & Neon PostgreSQL)
- **Status:** **FAIL (CRITICAL BLOCKER)**
- **Live Endpoint Tests:**
  - `GET /api/system/info`:
    ```json
    {
      "success": true,
      "data": {
        "application": { "name": "Inbox Ticketing & Task Management Core API", "version": "0.0.1", "environment": "production" },
        "runtime": { "nodeVersion": "v26.13.1", "platform": "linux", "uptimeSeconds": 1086 },
        "database": { "provider": "postgresql", "client": "prisma", "connectionStatus": "disconnected" }
      }
    }
    ```
  - `GET /api/system/health`:
    - **Status:** HTTP `503 Service Unavailable`
    - **Response:** `{"statusCode":503,"message":"Service Unavailable Exception","error":"ServiceUnavailableException","timestamp":"2026-11-16T12:22:51.855Z","path":"/api/system/health"}`
- **Root Cause:**
  - `PrismaClient` failed to connect to Neon PostgreSQL at startup or during queries. Either `DATABASE_URL` is not defined in the Vercel Project Environment Variables, or the connection string is missing `?sslmode=require`, or the Neon compute instance is paused/unreachable from Vercel's AWS region (`iad1`).

### 5. Application Modules (Users, Projects, Issues, Sprints, Epics, Settings, Reports)
- **Status:** **FAIL (Blocked by Database Disconnection)**
- **Live Endpoint Audit (Authenticated as Admin):**
  - `GET /api/users` -> HTTP `500 Internal server error`
  - `GET /api/users/user-1` -> HTTP `500 Internal server error`
  - `GET /api/projects` -> HTTP `500 Internal server error`
  - `GET /api/issues` -> HTTP `500 Internal server error`
  - `GET /api/epics` -> HTTP `500 Internal server error`
  - `GET /api/sprints` -> HTTP `500 Internal server error`
  - `GET /api/saved-filters` -> HTTP `500 Internal server error`
  - `GET /api/settings` -> HTTP `500 Internal server error`
  - `GET /api/activity` -> HTTP `500 Internal server error`
  - `GET /api/notifications` -> HTTP `500 Internal server error`
  - `GET /api/reports/summary` -> HTTP `500 Internal server error`
  - `GET /api/system/export` -> HTTP `500 Internal server error`
- **Observation:**
  - All application controllers and services are properly wired and receive requests. Once invoked, their Prisma query calls (`findMany`, `$transaction`, `count`) throw unhandled connection errors because the database is offline, which NestJS catches as generic 500 errors.

### 6. File Attachments & Vercel Blob Storage (`AttachmentsModule`)
- **Status:** **WARN / BLOCKED**
- **Live Endpoint Tests:**
  - `GET /api/issues/INB-1001/attachments` -> HTTP `500 Internal server error`
- **Architecture Validation:**
  - `backend/src/attachments/storage/storage.service.ts` integrates `@vercel/blob` with private access (`BLOB_ACCESS=private`) and client download streaming (`GET /api/attachments/:id/download`).
  - However, attachment metadata is stored in the database (`Attachment` table). Because the database is offline, listing or creating attachments fails immediately before storage operations execute.
  - Vercel Blob store token `BLOB_READ_WRITE_TOKEN` must be verified in the Vercel dashboard.

---

## D. CRITICAL ISSUES

### 1. Database Connection Disconnected on Production Vercel
- **Severity:** High / Blocker
- **Symptoms:**
  - `GET /api/system/info` reports `"database": { "connectionStatus": "disconnected" }`.
  - `GET /api/system/health` returns HTTP `503 Service Unavailable`.
  - Every application endpoint requiring database access fails with HTTP `500 Internal server error`.
- **Root Cause:**
  - In Vercel Project Settings (`Settings -> Environment Variables`), `DATABASE_URL` is either missing, contains placeholder values from `.env.example`, lacks `?sslmode=require`, or points to a paused Neon compute branch.
- **Remediation:**
  1. Open the [Neon Console](https://console.neon.tech/) and copy the pooled connection string.
  2. In Vercel Project Settings, add `DATABASE_URL` with the pooled Neon URL (format: `postgresql://[user]:[password]@[endpoint]-pooler.eastus2.azure.neon.tech/[dbname]?sslmode=require`).
  3. Ensure the unpooled direct connection string is also configured as `DIRECT_URL` for migration deployment.
  4. Trigger a redeployment.

### 2. Silent Offline Fallback in `AuthService` Masks Database Status
- **Severity:** Medium
- **Symptoms:**
  - `POST /api/auth/login` returns HTTP `200 OK` even though the database is disconnected.
  - Users are permitted into the application UI, but every subsequent screen displays loading errors or blank states.
- **Root Cause:**
  - Lines 201–222 of `backend/src/auth/auth.service.ts` contain a catch block that ignores database query errors and attempts authentication against hardcoded `SEED_USERS`.
- **Remediation:**
  - Once production database connectivity is established, this fallback serves as a safety net. However, logging should clearly flag when a database failure occurs in production.

---

## E. WARNINGS

1. **Prisma Connection Errors Surface as Generic 500s:**  
   `PrismaExceptionFilter` (`backend/src/common/filters/prisma-exception.filter.ts`) currently catches `Prisma.PrismaClientKnownRequestError` (query errors like P2002, P2025). It does not explicitly catch `PrismaClientInitializationError` (connection refusal, network timeout, invalid credentials), causing connection errors to be handled by the default NestJS fallback as `{"statusCode":500,"message":"Internal server error"}` without detailed diagnostic messages in the logs.
2. **Ephemeral Disk Fallback in Serverless (`/tmp/attachments`):**  
   If `BLOB_READ_WRITE_TOKEN` is omitted, `StorageService` falls back to `/tmp/attachments`. On Vercel Serverless Functions, `/tmp` is non-persistent across function instances. Permanent storage requires an active Vercel Blob store.
3. **Vercel Serverless Request Body Limit (4.5 MB):**  
   Vercel Serverless Functions impose an unconfigurable 4.5 MB request payload limit. Direct file uploads through `POST /api/issues/:issueId/attachments` exceeding ~4.5 MB will be rejected by the Vercel edge proxy before reaching NestJS. Larger files require direct-to-blob client-side presigned uploads.

---

## F. MISSING CONFIGURATION

The following production environment variables must be verified in the **Vercel Dashboard (`Settings -> Environment Variables`)**:

| Variable Name | Required For | Recommended Production Setting |
| :--- | :--- | :--- |
| `DATABASE_URL` | Prisma Client Runtime Queries | Pooled Neon PostgreSQL connection string (`-pooler`), with `?sslmode=require` |
| `DIRECT_URL` | Prisma Migrations (`prisma:migrate:deploy`) | Direct unpooled Neon connection string with `?sslmode=require` |
| `JWT_SECRET` | Auth Token Signing | 256-bit cryptographic random string |
| `JWT_EXPIRATION` | Auth Token Validity | `"7d"` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Storage | Automatically injected when linking a Vercel Blob store |
| `BLOB_ACCESS` | Attachment Privacy | `"private"` |
| `CORS_ORIGIN` | Cross-Origin Protection | `https://inbox-ticketing-tool.vercel.app` |
| `NODE_ENV` | Production Optimization | `production` |

---

## G. DATABASE MIGRATION STATUS

### Repository Migration Files:
1. `backend/prisma/migrations/20261012111255_init`
2. `backend/prisma/migrations/20261014061339_add_password_reset_tokens`
3. `backend/prisma/migrations/migration_lock.toml` (provider: `postgresql`)

### Status & Verification:
- The Prisma schema (`backend/prisma/schema.prisma`) is valid and configured with:
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
  }
  ```
- Both migrations exist in version control and are compatible with Neon PostgreSQL.
- **Pending Step:** Because the live database is disconnected, migrations cannot run automatically during build without `DIRECT_URL`. Migrations must be applied using:
  ```bash
  npm run prisma:migrate:deploy
  ```
  with `DIRECT_URL` set to the unpooled Neon connection string.

---

## H. RECOMMENDED FIXES (STEP-BY-STEP)

### Step 1: Configure Neon Database Credentials in Vercel
1. Log in to your [Vercel Dashboard](https://vercel.com/) and navigate to project `inbox-ticketing-tool`.
2. Go to **Settings > Environment Variables**.
3. Add the following variables for **Production**, **Preview**, and **Development**:
   - `DATABASE_URL`: Your pooled Neon connection string (e.g., `postgresql://[user]:[password]@ep-xxxx-pooler.[region].aws.neon.tech/neondb?sslmode=require`).
   - `DIRECT_URL`: Your direct Neon connection string (e.g., `postgresql://[user]:[password]@ep-xxxx.[region].aws.neon.tech/neondb?sslmode=require`).
   - `JWT_SECRET`: A secure 32+ character random string.

### Step 2: Deploy Database Migrations to Neon
Run the Prisma migration deploy command against your Neon database from your local terminal:
```bash
# Set your Neon DIRECT_URL
$env:DIRECT_URL="postgresql://[user]:[password]@ep-xxxx.[region].aws.neon.tech/neondb?sslmode=require"
$env:DATABASE_URL="postgresql://[user]:[password]@ep-xxxx-pooler.[region].aws.neon.tech/neondb?sslmode=require"

# Apply all migrations safely
npm run prisma:migrate:deploy

# Optionally seed initial operational data if empty
npm --prefix backend run prisma:seed
```

### Step 3: Connect Vercel Blob Storage
1. In the Vercel project dashboard, navigate to the **Storage** tab.
2. Click **Create Database** > select **Blob** > click **Continue**.
3. Name your store (e.g., `ticketing-attachments`) and attach it to `inbox-ticketing-tool`.
4. Vercel will automatically inject `BLOB_READ_WRITE_TOKEN`.
5. Set `BLOB_ACCESS="private"` in **Environment Variables**.

### Step 4: Redeploy on Vercel
1. Go to the **Deployments** tab on Vercel.
2. Click the three dots on the latest deployment and select **Redeploy** (or trigger a new commit).
3. Once deployed, re-run verification probes against `https://inbox-ticketing-tool.vercel.app/api/system/health`.

---

## I. FINAL PRODUCTION VERDICT

```
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         VERDICT: PARTIALLY WORKING – FIXES REQUIRED                        ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

### Justification:
- **What is working:** The unified monorepo Vercel architecture, React frontend, client-side SPA routing, Vercel Serverless Function bridge, URL path normalization (`resolveOriginalUrl`), CORS preflight, request DTO validation, and JWT generation/verification are completely operational on the live domain.
- **What requires attention:** The Neon PostgreSQL database connection is offline in the Vercel production environment (`connectionStatus: "disconnected"`). As a result, all database-backed endpoints (`/api/users`, `/api/projects`, `/api/issues`, etc.) return HTTP 500 errors. Once `DATABASE_URL` is set in the Vercel dashboard and migrations are deployed, the platform will reach full **PRODUCTION READY** status.

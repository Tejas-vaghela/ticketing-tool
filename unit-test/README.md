# Unit Tests Suite

This directory contains the consolidated unit test suites for both the **Backend** and **Frontend** of the Ticketing Management Platform.

---

## Structure

```text
unit-test/
├── backend/
│   ├── activity.service.spec.ts         # Activity feed and audit event tests
│   ├── attachments.service.spec.ts      # Secure file storage, magic byte & MIME tests
│   ├── auth.controller.spec.ts          # Auth REST API endpoints (login, me, logout, reset)
│   ├── auth.service.spec.ts             # Auth JWT issuance, bcrypt & timing attack tests
│   ├── epics.controller.spec.ts         # Epics REST API controller tests
│   ├── epics.service.spec.ts            # Epics business logic & metric tests
│   ├── issues.controller.spec.ts        # Issues REST API controller tests
│   ├── issues.service.spec.ts           # Issues status, SLA & filter tests
│   ├── status-mapper.spec.ts            # Kanban status to Prisma enum mapping
│   ├── kanban.controller.spec.ts        # Kanban board controller tests
│   ├── kanban.service.spec.ts           # Kanban board column & issue movement
│   ├── notifications.service.spec.ts    # User notifications & read receipt tests
│   ├── projects.service.spec.ts         # Projects CRUD, metrics & active issue counts
│   ├── reports.service.spec.ts          # SLA compliance, duration calculations & analytics
│   ├── saved-filters.service.spec.ts    # User saved filter queries & access control
│   ├── search.controller.spec.ts        # Global search controller tests
│   ├── search.service.spec.ts           # Multi-entity search engine tests
│   ├── settings.service.spec.ts         # Singleton workspace settings & SLA threshold tests
│   ├── sprints.controller.spec.ts       # Sprints REST API controller tests
│   ├── sprints.service.spec.ts          # Sprints lifecycle & rollover tests
│   ├── system.controller.spec.ts        # System health and info controller tests
│   ├── system.service.spec.ts           # Health check, JSON export/import tests
│   └── users.service.spec.ts            # User management, RBAC guard & FK safety tests
└── frontend/
    ├── rbac.test.ts                     # Role-based access control tests
    ├── PriorityBadge.test.tsx           # Priority badges UI tests
    ├── StatusBadge.test.tsx             # Status badges UI tests
    ├── TypeBadge.test.tsx               # Issue type badges UI tests
    └── SLABadge.test.tsx                # SLA countdown and status tests
```

---

## Test Execution Commands

### Backend Tests (Jest)
```bash
cd backend
npm test
```
*23 test suites, 184 tests — 100% Passed.*

### Frontend Tests (Vitest)
```bash
cd frontend
npm test
```
*5 test suites, 29 tests — 100% Passed.*

---

## Consolidated Test Metrics

| Component | Framework | Test Suites | Total Tests | Status |
|:---|:---|:---:|:---:|:---:|
| **Backend API & Services** | Jest | 23 | 184 | **100% PASS** |
| **Frontend UI & RBAC** | Vitest | 5 | 29 | **100% PASS** |
| **Total** | - | **28** | **213** | **100% PASS** |

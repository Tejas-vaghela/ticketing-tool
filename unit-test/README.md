# Unit Tests Suite

This directory contains the consolidated unit test suites for both the **Backend** and **Frontend** of the Ticketing Management Platform.

---

## Structure

```text
unit-test/
├── backend/
│   ├── activity.service.spec.ts      # Activity feed and audit event tests
│   ├── epics.controller.spec.ts      # Epics REST API controller tests
│   ├── epics.service.spec.ts         # Epics business logic & metric tests
│   ├── issues.controller.spec.ts     # Issues REST API controller tests
│   ├── issues.service.spec.ts        # Issues status, SLA & filter tests
│   ├── status-mapper.spec.ts         # Kanban status to Prisma enum mapping
│   ├── kanban.controller.spec.ts     # Kanban board controller tests
│   ├── kanban.service.spec.ts        # Kanban board column & issue movement
│   ├── search.controller.spec.ts     # Global search controller tests
│   ├── search.service.spec.ts        # Multi-entity search engine tests
│   ├── sprints.controller.spec.ts    # Sprints REST API controller tests
│   ├── sprints.service.spec.ts       # Sprints lifecycle & rollover tests
│   ├── system.controller.spec.ts     # System health and info controller tests
│   └── system.service.spec.ts        # Health check, JSON export/import tests
└── frontend/
    ├── rbac.test.ts                  # Role-based access control tests
    ├── PriorityBadge.test.tsx        # Priority badges UI tests
    ├── StatusBadge.test.tsx          # Status badges UI tests
    ├── TypeBadge.test.tsx            # Issue type badges UI tests
    └── SLABadge.test.tsx             # SLA countdown and status tests
```

---

## Test Execution Commands

### Backend Tests (Jest)
```bash
cd backend
npm test
```
*14 test suites, 106 tests — 100% Passed.*

### Frontend Tests (Vitest)
```bash
cd frontend
npm test
```
*5 test suites, 29 tests — 100% Passed.*


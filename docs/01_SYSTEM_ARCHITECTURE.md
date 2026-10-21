# System Architecture & Technical Blueprint
## Ticketing Management Platform (Inbox / GoldMine Portal)

---

## 1. Document Purpose and Scope

### 1.1 Purpose
This document establishes the authoritative, macro-level system architecture and integration blueprint for the **Ticketing Management Platform** (known internally as the *Inbox / GoldMine Portal*). Its primary purpose is to serve as the unified technical specification enabling a distributed team of backend and frontend engineers working on disparate machines to build, extend, and integrate backend modules with absolute consistency in conventions, boundaries, protocols, and data models.

### 1.2 Scope
This document covers:
- The overall system topology connecting the React 19 single-page application (SPA) with the NestJS modular backend and the PostgreSQL relational database.
- Clear demarcation of responsibilities between client, server, and data persistence layers.
- Global architectural principles governing NestJS module structure, request/response lifecycles, and database interactions through Prisma ORM.
- Authentication, authorization (Role-Based Access Control / RBAC), validation, error handling, logging, and security baselines.
- An honest assessment of the current codebase status, identifying implemented features versus planned systems.
- Concrete architectural rules, constraints, and integration contracts that all developers must adhere to.

### 1.3 Documentation Suite Structure
To prevent knowledge fragmentation and maintain clear documentation boundaries, backend documentation is organized into three centralized guides:

1. **`docs/01_SYSTEM_ARCHITECTURE.md` (This Document)**:
   The macro architectural blueprint. Governs system topology, module boundaries, database architecture, security model, request lifecycle, and integration rules.
2. [**`docs/02_CODING_STANDARDS.md`**](02_CODING_STANDARDS.md) **(Active / Established)**:
   The micro implementation standard. Governs TypeScript conventions, NestJS idioms, DTO validation rules, Prisma query patterns, exception handling specifics, and unit/integration testing standards.
3. **`docs/03_MODULE_IMPLEMENTATION.md` (Planned Companion Guide)**:
   The granular module-by-module implementation guide. Provides the concrete endpoint definitions, DTO schemas, service contracts, and step-by-step tasks for each of the backend business modules.

### 1.4 Relationship to `BACKEND_ARCHITECTURE.md`
The root directory of this repository contains an existing reference document: [**`BACKEND_ARCHITECTURE.md`**](../BACKEND_ARCHITECTURE.md). 
- That file represents the foundational analysis and full theoretical specification derived from the initial frontend prototype.
- **`BACKEND_ARCHITECTURE.md` remains strictly immutable and preserved as a primary design reference.**
- This document (`01_SYSTEM_ARCHITECTURE.md`) builds upon `BACKEND_ARCHITECTURE.md`, synthesizing its designs into an operational architectural manual, resolving real-world repository considerations, documenting existing codebase realities, and providing practical guidance for distributed development.

---

## 2. Project Overview

### 2.1 Mission & Domain
The Ticketing Management Platform is an enterprise-grade service desk, sprint execution, and tiered technical support escalation system designed for multi-disciplinary product and support teams. It bridges customer support operations with engineering sprint execution under a unified workspace.

### 2.2 Core Functional Capabilities
The application encompasses twelve interrelated functional domains:

1. **Authentication & Identity**: User authentication via email/credentials, JWT issuance, and session hydration.
2. **Executive Dashboard**: Metric telemetry summarizing open tickets, active sprints, SLA compliance percentages, tier distribution charts, and urgent items.
3. **Issue & Ticket Management**: Comprehensive issue tracking supporting diverse issue types (`Task`, `Bug`, `Story`, `Epic`, `Sub-task`), multi-facet filtering, full-text search, and field updates.
4. **Agile Kanban Board**: Visual workflow state machine (`Open`, `To Do`, `In Progress`, `In Review`, `Testing`, `Blocked`, `Resolved`, `Closed`) with drag-and-drop transitions.
5. **Backlog & Sprint Ceremonies**: Sprint creation, sprint activation, issue assignment, and sprint closure with automatic unfinished ticket rollover.
6. **Project & Epic Cockpit**: Project portfolio directory with project lead assignments, unique project numbering keys (e.g. `INB`, `CSP`, `MOB`), and high-level epic groupings.
7. **Tiered Support Center**: Three-tier escalation queues:
   - **L1 (Frontline Support)**: Initial triage, customer communication.
   - **L2 (Technical Support)**: Deep diagnosis, environment verification.
   - **L3 (Engineering Support)**: Core code remediation and bug fixing.
8. **Real-Time SLA Governance**: Dynamic calculation of response and resolution deadlines based on ticket priority and support tier, with proactive breach warnings.
9. **Team Management**: Team member directory, department classification, workload monitoring, and support tier competency assignment (`L1`, `L2`, `L3`).
10. **Administration & Governance**: Administrative user CRUD, administrative password resets, dynamic role-to-page permission matrix (RBAC), and SLA threshold configuration.
11. **Audit & Activity Telemetry**: Append-only activity logs capturing ticket updates, assignments, status transitions, and support escalations.
12. **System Administration**: Full JSON database snapshot export, backup import, and factory reset to initial seed data.

---

## 3. Existing System Status (Reality vs Specification)

Before embarking on backend module development, all developers must understand the **precise physical status** of the codebase to avoid misconceptions.

### 3.1 Codebase Audit Findings
An exhaustive inspection of the repository reveals the following:

| Architectural Area | Implemented in Codebase? | Current Implementation State | Notes & Evidence |
|---|---|---|---|
| **Frontend UI & Pages** | **YES (Fully Implemented)** | React 19 Single Page Application in [`src/pages`](../src/pages) | 16 complete views: Dashboard, Issues, Kanban, Backlog, Support Center, Reports, Projects, Team, Admin, Settings, Profile, Docs, etc. |
| **Frontend Routing** | **YES (Fully Implemented)** | React Router v7 in [`src/App.tsx`](../src/App.tsx) | Client-side routing with `ProtectedRoute`, `PublicOnlyRoute`, and `RoleRoute` access checks. |
| **Frontend RBAC Logic** | **YES (Fully Implemented)** | [`src/services/rbac.ts`](../src/services/rbac.ts) | Defines 8 roles (`Admin`, `Project Manager`, `Engineer`, `Technical`, `Developer`, `QA`, `Support Agent`, `Viewer`) and dynamic page permission mappings. |
| **Frontend Seed Data** | **YES (Fully Implemented)** | [`src/data/seedData.ts`](../src/data/seedData.ts) | 75KB seed dataset containing comprehensive mock projects, users, issues, sprints, epics, comments, notifications, and settings. |
| **Frontend State & Persistence** | **MOCK ONLY (Browser LocalStorage)** | [`src/services/storage.ts`](../src/services/storage.ts) | Data is currently read and persisted purely inside browser `localStorage`. No actual backend server is contacted. |
| **Frontend HTTP Client** | **NOT IMPLEMENTED** | Missing `src/services/api.ts` | The HTTP client specified in `BACKEND_ARCHITECTURE.md` (Phase 14) has not yet been authored in `src/`. |
| **Backend NestJS App** | **NOT IMPLEMENTED** | Planned in `backend/` directory | No `@nestjs` dependencies exist in the root `package.json`. No controllers, services, or modules exist on disk yet. |
| **Prisma Schema & Migrations** | **SPECIFIED ONLY** | Defined in `BACKEND_ARCHITECTURE.md` Phase 5 | No `prisma/` folder or `schema.prisma` file exists on disk yet. |
| **PostgreSQL Database** | **NOT PROVISIONED** | Planned | No active database container or instance is linked to the repository. |
| **Automated Testing Suite** | **MINIMAL** | `npm run lint` (`tsc --noEmit`) | No Vitest, Jest, or Supertest harnesses are currently configured in `package.json`. |

> [!IMPORTANT]
> The application currently runs as a standalone React 19 frontend simulating backend persistence via browser `localStorage`. The backend architecture documented herein and in `BACKEND_ARCHITECTURE.md` represents the target enterprise implementation to be built by developers.

---

## 4. Technology Stack

The target production stack has been strictly selected for enterprise stability, end-to-end type safety, and high developer velocity.

### 4.1 Frontend Tier
- **Framework**: React 19 (`react: ^19.0.1`, `react-dom: ^19.0.1`)
- **Build Tool**: Vite 8 (`vite: ^8.3.0`, `@vitejs/plugin-react: ^6.1.1`)
- **Routing**: React Router DOM 7 (`react-router-dom: ^7.18.4`)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite: ^4.3.3`, `tailwindcss: ^4.3.3`)
- **Icons**: Lucide React (`lucide-react: ^0.546.0`)
- **Data Visualization**: Recharts (`recharts: ^3.10.1`)
- **Animations**: Motion (`motion: ^12.23.24`)

### 4.2 Backend Tier
- **Framework**: NestJS (v10.x / v11.x) with Express HTTP adapter
- **Runtime**: Node.js LTS (v20.x or v22.x)
- **Language**: TypeScript 5.x+ with strict typing enabled (`strict: true`)
- **Architecture**: Modular Monolith with Domain-Driven Design (DDD) module grouping
- **Validation**: `class-validator` and `class-transformer`
- **Security & Crypto**: `bcrypt` (10 rounds) for password hashing, `@nestjs/jwt` and `passport-jwt` for stateless token authentication

### 4.3 Persistence & Infrastructure Tier
- **Database Engine**: PostgreSQL 16+
- **Object-Relational Mapping (ORM)**: Prisma ORM (`@prisma/client: ^5.x/6.x`, `prisma: ^5.x/6.x`)
- **Database Driver**: Native PostgreSQL protocol via Prisma Client connection pooling
- **Configuration**: `@nestjs/config` utilizing typed environment definitions

---

## 5. High-Level System Architecture

### 5.1 System Topology Diagram

```mermaid
flowchart TB
    subgraph ClientTier ["Frontend Tier (Client Browser)"]
        UI["React 19 SPA (Vite / Tailwind CSS)"]
        State["AppContext (React Context)"]
        API_Client["API Service Layer (src/services/api.ts)"]
        UI --> State
        State --> API_Client
    end

    subgraph NetworkTier ["Network & Ingress"]
        CORS["CORS Middleware (Configured via CORS_ORIGIN, default: localhost:3000)"]
        Proxy["Reverse Proxy / API Gateway (/api/*)"]
        API_Client -- "HTTPS / JSON (Bearer JWT)" --> Proxy
        Proxy --> CORS
    end

    subgraph BackendTier ["Backend Tier (NestJS Modular Monolith)"]
        CORS --> GlobalPipes["Global Validation Pipe (class-validator)"]
        GlobalPipes --> Guards["Guards Layer (JwtAuthGuard -> RolesGuard)"]
        
        subgraph Modules ["14 Business Domain Modules"]
            AuthMod["AuthModule"]
            UserMod["UsersModule"]
            IssueMod["IssuesModule (SLA Engine)"]
            ProjMod["ProjectsModule"]
            SprintMod["SprintsModule"]
            EpicMod["EpicsModule"]
            CommMod["CommentsModule"]
            AttachMod["AttachmentsModule"]
            NotifMod["NotificationsModule"]
            AuditMod["ActivityModule"]
            SetMod["SettingsModule"]
            SearchMod["SearchModule"]
            SysMod["SystemModule"]
            FilterMod["SavedFiltersModule"]
        end

        Guards --> Modules
        
        subgraph DataLayer ["Infrastructure Layer"]
            PrismaSvc["PrismaService (Global PrismaModule)"]
        end

        Modules --> PrismaSvc
    end

    subgraph PersistenceTier ["Persistence Tier"]
        DB[(PostgreSQL 16 Database)]
        PrismaSvc -- "Connection Pool / SQL" --> DB
        DiskStorage[("File System / Object Storage (Attachments)")]
        AttachMod -.-> DiskStorage
    end
```

### 5.2 Architectural Characteristics
1. **Stateless Backend**: The NestJS server maintains zero in-memory session state. Authentication state is validated per request via cryptographic JWT validation, facilitating zero-downtime rolling restarts and horizontal scaling.
2. **Decoupled Client-Server**: The frontend communicates strictly over standardized JSON REST endpoints. The frontend remains agnostic to whether the backend is running locally, in Docker, or across a distributed cluster.
3. **Encapsulated Data Access**: No module executes raw SQL queries directly or communicates with the database outside of the unified `PrismaService`.

---

## 6. Frontend, Backend, and Database Responsibilities

A primary cause of architectural decay in multi-developer teams is ambiguous division of labor. The table below codifies the strict separation of concerns:

| Architectural Responsibility | Frontend Tier (React) | Backend Tier (NestJS) | Database Tier (PostgreSQL / Prisma) |
|---|---|---|---|
| **User Input & Presentation** | **Owner**: Renders forms, captures keystrokes, validates client UX requirements (e.g. required field visual cues). | **Consumer**: Never assumes client input is valid. Validates every payload through DTOs. | **Storage**: Stores sanitized strings and structured data types. |
| **Authentication Credential Validation** | Collects email/userId & password; stores JWT in browser `localStorage` (MVP client standard; see Section 15.1 for production cookie roadmap). | **Owner**: Verifies credentials against `bcrypt` hash; generates and signs JWT; verifies signature on incoming requests. | Stores hashed passwords (`password` column); enforces uniqueness on `email`. |
| **Authorization & Permissions** | Displays/hides navigation links and action buttons based on user role. | **Owner**: Enforces authorization guards (`RolesGuard`). Denies unauthorized requests with `403 Forbidden`. | Stores dynamic role permissions in `Settings.rolePageAccess`. |
| **Issue ID Generation (e.g. INB-1001)** | Never generates IDs in production. Displays formatted ID. | **Owner**: Atomically queries project key, computes next sequential counter, and formats ID during creation. | Enforces Primary Key uniqueness on `Issue.id`. |
| **SLA Countdown & Calculation** | Computes and displays dynamic countdown timers and color badges for active viewing. | **Owner**: Authoritative SLA rules engine. Calculates `responseSLAHours` and `resolutionSLAHours` at write time. | Stores baseline creation timestamps, response times, and partial indexes for active tickets. |
| **Support Tier Escalations** | Renders `EscalateModal`, captures reason and target tier (`L1` -> `L2` -> `L3`). | **Owner**: Validates tier transition hierarchy; executes atomic transaction (records escalation, updates issue, posts internal comment, creates audit event). | Enforces foreign key constraints between `EscalationRecord`, `Issue`, and `User`. |
| **Sprint Management & Rollover** | Triggers start/complete sprint UI dialogs. | **Owner**: Enforces single-active-sprint rule; moves unresolved tickets to backlog or next sprint on completion. | Updates `sprintId` associations transactionally. |
| **Data Integrity & Relational Rules** | Assumes referential integrity is guaranteed by the API. | Enforces business rules and validation logic prior to persistence. | **Owner**: Enforces foreign keys (`ON DELETE CASCADE`, `ON DELETE SET NULL`), check constraints, and unique indexes. |

---

## 7. Overall Backend Architecture

The backend is engineered as a **Modular Monolith**. 

### 7.1 Core Tenets
1. **Domain-Driven Cohesion**: Each business domain (Issues, Sprints, Projects, Auth) is encapsulated in its own NestJS module containing its controller, service, DTOs, and internal logic.
2. **Strict Inversion of Control (IoC)**: Controllers depend on Services; Services depend on `PrismaService` or exported services of other modules. Concrete instances are managed exclusively by the NestJS IoC container.
3. **Single Source of Truth**: The Prisma schema ([`schema.prisma`](../BACKEND_ARCHITECTURE.md#phase-5--complete-prisma-schema-schemaprisma)) defines the authoritative database model. TypeScript types are generated directly by `@prisma/client`.
4. **Isolated Business Logic**: Business logic lives strictly in Services. Controllers are lightweight HTTP adapters.

---

## 8. NestJS Architectural Principles

Every developer must apply the following structural layer rules:

```
[ Incoming HTTP Request ]
          │
          ▼
   [ Controller ]   ◄── Routing, parameter extraction, HTTP response codes
          │
          ▼
     [ DTO Layer ]  ◄── class-validator decorator inspection, type casting
          │
          ▼
      [ Service ]   ◄── Business rules, SLA calculations, workflow logic
          │
          ▼
  [ PrismaService ] ◄── Type-safe query building, transactions ($transaction)
          │
          ▼
    [ PostgreSQL ]  ◄── Relational storage & ACID execution
```

### 8.1 Controllers (`*.controller.ts`)
- **Permitted**: Route mapping (`@Get`, `@Post`, `@Patch`, `@Delete`), query/param/body extraction (`@Query`, `@Param`, `@Body`, `@CurrentUser`), invoking the service method, returning the result.
- **Prohibited**: Complex conditional business logic, direct Prisma calls, mutating entities directly, formatting SQL queries.

### 8.2 Services (`*.service.ts`)
- **Permitted**: Implementing domain algorithms, orchestrating multi-step workflows, calculating SLA deadlines, coordinating database calls via `PrismaService`, raising NestJS standard HTTP exceptions (`NotFoundException`, `ConflictException`, `BadRequestException`).
- **Prohibited**: Direct access to Express `Request` or `Response` objects, formatting HTTP responses.

### 8.3 Data Transfer Objects (`*.dto.ts`)
- **Permitted**: Class declarations with `class-validator` and `class-transformer` decorators defining expected payloads for input mutation and query filtering.
- **Prohibited**: Active logic, database queries, circular type references.

### 8.4 Guards (`*.guard.ts`)
- **Permitted**: Extracting JWT headers, validating token integrity, attaching decoded user to request (`request.user`), checking user role against route metadata (`Reflector`).
- **Prohibited**: Mutating database entities, executing complex business logic.

---

## 9. Recommended Backend Folder Structure

Because the current workspace contains the React frontend in the root directory, the backend must be established in a dedicated `backend/` directory to maintain clean separation between the Vite frontend and the NestJS backend.

The backend consists of **15 total NestJS modules**:
* **1 Global Infrastructure Module**: `PrismaModule` (located in `src/prisma/`)
* **14 Business Domain Modules**: Located in `src/modules/`

```text
backend/
├── prisma/
│   ├── migrations/                      # Timestamped Prisma SQL migrations
│   │   └── 20261010000000_init/
│   │       └── migration.sql
│   ├── schema.prisma                    # Authoritative PostgreSQL schema
│   └── seed.ts                          # Database seed script (ports src/data/seedData.ts)
│
├── src/
│   ├── main.ts                          # Application bootstrap & global pipes/filters
│   ├── app.module.ts                    # Root module orchestrating all domain modules
│   │
│   ├── common/                          # Shared cross-cutting concerns
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts # Injects decoded AuthenticatedUser into route
│   │   │   ├── roles.decorator.ts       # Decorates route with required UserRole array
│   │   │   └── public.decorator.ts      # Bypasses global JWT guard
│   │   ├── filters/
│   │   │   ├── http-exception.filter.ts # Uniform JSON error formatter
│   │   │   └── prisma-exception.filter.ts # Maps Prisma errors (P2002, P2025) to HTTP
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts        # Enforces valid Bearer JWT
│   │   │   └── roles.guard.ts           # Enforces RBAC permissions
│   │   ├── interceptors/
│   │   │   ├── transform.interceptor.ts # Uniform response wrapping (optional)
│   │   │   └── logging.interceptor.ts   # Request/response telemetry & latency
│   │   └── pipes/
│   │       └── validation.pipe.ts       # Configured global ValidationPipe
│   │
│   ├── prisma/                          # Global Infrastructure Module (1 of 15)
│   │   ├── prisma.module.ts             # Exports PrismaService globally
│   │   └── prisma.service.ts            # PrismaClient wrapper with connection hooks
│   │
│   └── modules/                         # 14 Business Domain Modules (2 through 15)
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── strategies/jwt.strategy.ts
│       │   └── dto/
│       │       ├── login.dto.ts
│       │       └── change-password.dto.ts
│       ├── users/
│       │   ├── users.module.ts
│       │   ├── users.controller.ts
│       │   ├── users.service.ts
│       │   └── dto/
│       │       ├── create-user.dto.ts
│       │       ├── update-user.dto.ts
│       │       └── update-profile.dto.ts
│       ├── issues/
│       │   ├── issues.module.ts
│       │   ├── issues.controller.ts
│       │   ├── issues.service.ts
│       │   └── dto/
│       │       ├── create-issue.dto.ts
│       │       ├── update-issue.dto.ts
│       │       ├── update-status.dto.ts
│       │       ├── escalate-issue.dto.ts
│       │       └── query-issues.dto.ts
│       ├── comments/
│       │   ├── comments.module.ts
│       │   ├── comments.controller.ts
│       │   ├── comments.service.ts
│       │   └── dto/
│       │       ├── create-comment.dto.ts
│       │       └── update-comment.dto.ts
│       ├── attachments/
│       │   ├── attachments.module.ts
│       │   ├── attachments.controller.ts
│       │   ├── attachments.service.ts
│       │   └── dto/create-attachment.dto.ts
│       ├── projects/
│       │   ├── projects.module.ts
│       │   ├── projects.controller.ts
│       │   ├── projects.service.ts
│       │   └── dto/
│       │       ├── create-project.dto.ts
│       │       └── update-project.dto.ts
│       ├── sprints/
│       │   ├── sprints.module.ts
│       │   ├── sprints.controller.ts
│       │   ├── sprints.service.ts
│       │   └── dto/
│       │       ├── create-sprint.dto.ts
│       │       ├── update-sprint.dto.ts
│       │       └── complete-sprint.dto.ts
│       ├── epics/
│       │   ├── epics.module.ts
│       │   ├── epics.controller.ts
│       │   ├── epics.service.ts
│       │   └── dto/
│       │       ├── create-epic.dto.ts
│       │       └── update-epic.dto.ts
│       ├── notifications/
│       │   ├── notifications.module.ts
│       │   ├── notifications.controller.ts
│       │   └── notifications.service.ts
│       ├── activity/
│       │   ├── activity.module.ts
│       │   ├── activity.controller.ts
│       │   └── activity.service.ts
│       ├── saved-filters/
│       │   ├── saved-filters.module.ts
│       │   ├── saved-filters.controller.ts
│       │   ├── saved-filters.service.ts
│       │   └── dto/create-filter.dto.ts
│       ├── settings/
│       │   ├── settings.module.ts
│       │   ├── settings.controller.ts
│       │   ├── settings.service.ts
│       │   └── dto/update-settings.dto.ts
│       ├── search/
│       │   ├── search.module.ts
│       │   ├── search.controller.ts
│       │   └── search.service.ts
│       └── system/
│           ├── system.module.ts
│           ├── system.controller.ts
│           └── system.service.ts
│
├── test/                                # Integration & E2E test suites
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── .env.example                         # Environment configuration blueprint
├── package.json                         # Backend dependencies & scripts
├── tsconfig.json                        # Strict TypeScript compiler options
└── tsconfig.build.json
```

---

## 10. Module Organization

The backend is composed of **15 coordinated modules** (1 global infrastructure module + 14 business domain modules), each owning a distinct slice of the platform's capabilities:

### 10.1 Module Catalog & Boundary Matrix

| Module | Classification | Core Responsibility | Key Injected Dependencies | Exported Providers |
|---|---|---|---|---|
| **`PrismaModule`** | Infrastructure | Provides single connection pool instance of `PrismaClient` to all modules. | None (Global `@Global()`) | `PrismaService` |
| **`AuthModule`** | Domain | Validates user credentials, issues JWTs, handles session validation. | `UsersModule`, `JwtModule`, `PassportModule` | `AuthService`, `JwtStrategy` |
| **`UsersModule`** | Domain | CRUD for team accounts, password management, profile telemetry. | `PrismaModule` | `UsersService` |
| **`IssuesModule`** | Domain | Central ticketing engine: CRUD, status flow, SLA calculations, escalations. | `PrismaModule`, `NotificationsModule`, `ActivityModule` | `IssuesService` |
| **`CommentsModule`** | Domain | Manages public responses and internal escalation notes on tickets. | `PrismaModule`, `ActivityModule`, `NotificationsModule` | `CommentsService` |
| **`AttachmentsModule`** | Domain | Manages attachment records and file uploads linked to tickets. | `PrismaModule`, `ActivityModule` | `AttachmentsService` |
| **`ProjectsModule`** | Domain | Project portfolio management, project keys, member assignments. | `PrismaModule` | `ProjectsService` |
| **`SprintsModule`** | Domain | Sprint planning, starting sprints, completion with unfinished rollover. | `PrismaModule`, `ActivityModule` | `SprintsService` |
| **`EpicsModule`** | Domain | High-level roadmap tracking and epic status lifecycle. | `PrismaModule` | `EpicsService` |
| **`NotificationsModule`** | Domain | In-app user notifications for ticket assignments and escalations. | `PrismaModule` | `NotificationsService` |
| **`ActivityModule`** | Domain | Immutable system-wide audit telemetry feed. | `PrismaModule` | `ActivityService` |
| **`SavedFiltersModule`** | Domain | Persists custom user-defined issue query filters. | `PrismaModule` | `SavedFiltersService` |
| **`SettingsModule`** | Domain | Persists workspace settings, SLA policy hours, role permission matrix. | `PrismaModule` | `SettingsService` |
| **`SearchModule`** | Domain | Multi-entity cross-domain text search (Issues, Projects, Epics). | `PrismaModule` | `SearchService` |
| **`SystemModule`** | Domain | Full database JSON export, backup restoration, seed data reset. | `PrismaModule` | `SystemService` |

---

## 11. Request and Response Lifecycle

Every HTTP interaction follows a deterministic path through NestJS pipelines, with distinct execution paths for successful requests versus unhandled exceptions:

```
[ Incoming HTTP Request ]
       │
       ▼
1. CORS & Security Headers (Express Helmet / CORS Middleware)
       │
       ▼
2. NestJS Global Middleware (Request correlation ID & HTTP Logger)
       │
       ▼
3. Guards Pipeline
   ├── JwtAuthGuard (Validates Bearer JWT; bypasses if @Public())
   └── RolesGuard (Verifies user.role against @Roles metadata)
       │
       ▼
4. Interceptors (Pre-handler phase: records start timestamp, initiates telemetry span)
       │
       ▼
5. ValidationPipe (Validates DTO constraints & casts primitives)
       │
       ▼
6. Controller Handler (Extracts @Param, @Query, @Body, @CurrentUser)
       │
       ▼
7. Service Execution (Business rules, SLA calculations, transaction orchestration)
       │
       ▼
8. Database Access (PostgreSQL query execution via PrismaService)
       │
       ▼
9. Interceptors (Post-handler phase: records duration, sanitizes output)
       │
       ▼
[ HTTP 200/201/204 JSON Response ]
```

### 11.1 Exception Handling Pathway
Exception Filters do **not** run sequentially after Interceptors in the normal request pipeline. Instead, they act as an out-of-band error boundary wrapping the entire execution context:

```
               [ Error Thrown in Guard / Pipe / Controller / Service / DB ]
                                            │
                                            ▼
                           [ Exception Filter Boundary ]
                            ├── HttpExceptionFilter (Handles NestJS HttpExceptions)
                            └── PrismaExceptionFilter (Maps P2002, P2025, P2003)
                                            │
                                            ▼
                           [ Formatted JSON Error Response ]
                           (statusCode, message, error, timestamp, path)
```

---

## 12. API Design Principles

### 12.1 Standard RESTful Resource URIs
- All routes are pluralized and resource-oriented, prefixed with `/api`:
  - `GET /api/issues` (List)
  - `POST /api/issues` (Create)
  - `GET /api/issues/:id` (Retrieve single)
  - `PATCH /api/issues/:id` (Partial update)
  - `DELETE /api/issues/:id` (Delete)
- Sub-resources follow hierarchical nesting:
  - `POST /api/issues/:id/comments` (Create comment on issue)
  - `POST /api/issues/:id/escalate` (Escalate specific issue)
  - `POST /api/issues/:id/attachments` (Attach file to issue)

### 12.2 HTTP Status Code Usage
Developers must use appropriate HTTP status codes:
- **`200 OK`**: Standard successful retrieval, partial update, workflow action, or deletion.
- **`201 Created`**: Resource successfully created via `POST` (e.g. creating issues, projects, comments).
- **`400 Bad Request`**: Validation failure or malformed payload.
- **`401 Unauthorized`**: Missing, invalid, or expired JWT.
- **`403 Forbidden`**: Authenticated user lacks required role or resource permission.
- **`404 Not Found`**: Targeted entity ID does not exist.
- **`409 Conflict`**: Unique constraint violation (e.g. duplicate email, project key).
- **`500 Internal Server Error`**: Unexpected server-side fault.

> [!NOTE]
> Deletion endpoints (`DELETE /api/issues/:id`, etc.) return `200 OK` with JSON `{ success: true }`, preserving compatibility with the React frontend client which parses JSON via `response.json()`. They do **not** return `204 No Content`.

### 12.3 Query Conventions for Lists
Query endpoints must support standardized filtering parameters:
- **Search**: `q` (e.g. `?q=payment+failure`)
- **Filters**: Exact field matches (e.g. `?status=In+Progress&priority=High&supportLevel=L2`)
- **Pagination**: `take` (limit, default 50) and `skip` (offset)
- **Sorting**: `sortBy` (e.g. `createdDate`) and `sortOrder` (`asc` | `desc`)

---

## 13. Database Architecture

### 13.1 Schema Blueprint
The PostgreSQL database model is derived strictly from [`src/types/index.ts`](../src/types/index.ts) and fully defined in [`BACKEND_ARCHITECTURE.md`](../BACKEND_ARCHITECTURE.md#phase-5--complete-prisma-schema-schemaprisma).

### 13.2 Entity-Relationship Summary

```mermaid
erDiagram
    User ||--o{ Issue : "assigned to"
    User ||--o{ Issue : "reported by"
    User ||--o{ Comment : "authored"
    User ||--o{ EscalationRecord : "escalated by"
    User ||--o{ Project : "leads"
    User }o--o{ Project : "member of"
    User ||--o{ Notification : "receives"
    User ||--o{ ActivityEvent : "triggers"
    User ||--o{ SavedFilter : "owns"

    Project ||--o{ Issue : "contains"
    Project ||--o{ Sprint : "schedules"
    Project ||--o{ Epic : "groups"

    Sprint ||--o{ Issue : "tracks"
    Epic ||--o{ Issue : "aligns"

    Issue ||--o{ Comment : "has"
    Issue ||--o{ Attachment : "includes"
    Issue ||--o{ EscalationRecord : "history"
    Issue ||--o{ ActivityEvent : "logs"

    Settings ||--|| User : "governs all"
```

### 13.3 Key Entities & Identifiers
1. **`User`**: Primary Key `id` (CUID). Unique `email`. Hashed `password`. Enums: `role` (`UserRole`), `status` (`UserStatus`), `supportLevels` (`SupportLevel[]`).
2. **`Project`**: Primary Key `id` (CUID). Unique `key` (e.g. `INB`, `CSP`, `MOB`). Foreign key `leadId` referencing `User`.
3. **`Issue`**: Primary Key `id` formatted as `<PROJECT_KEY>-<COUNTER>` (e.g. `INB-1001`). Foreign keys: `projectId` (Cascade), `reporterId`, `assigneeId` (SetNull), `sprintId` (SetNull), `epicId` (SetNull).
4. **`Sprint`**: Primary Key `id` (CUID). Foreign key `projectId` (Cascade). Status enum (`planned`, `active`, `completed`).
5. **`Epic`**: Primary Key `id` (CUID). Foreign key `projectId` (Cascade). Status enum (`To_Do`, `In_Progress`, `Done`).
6. **`EscalationRecord`**: Primary Key `id` (CUID). Foreign key `issueId` (Cascade). Captures `fromLevel`, `toLevel`, `reason`, `escalatedByUserId`, `assignedToUserId`.
7. **`Comment`**: Primary Key `id` (CUID). Foreign keys: `issueId` (Cascade), `authorId`. Enum `type` (`public`, `internal`).
8. **`Attachment`**: Primary Key `id` (CUID). Foreign key `issueId` (Cascade). Stores `filename`, `fileType`, `fileSize`, `uploadDate`.
9. **`ActivityEvent`**: Primary Key `id` (CUID). Foreign keys: `issueId` (optional), `projectId` (optional), `userId`.
10. **`Notification`**: Primary Key `id` (CUID). Foreign keys: `userId` (Cascade), `issueId` (optional). Boolean `read`.
11. **`SavedFilter`**: Primary Key `id` (CUID). Foreign key `userId` (Cascade). Stores JSON filters.
12. **`Settings`**: Primary Key `id` (`"singleton"`). Stores workspace preferences, JSON SLA thresholds, JSON role page access matrix.

### 13.4 SLA Indexing Strategy & Partial Indexing
To guarantee sub-second SLA calculations across large volumes of historical tickets:
- Composite index on `Issue(projectId, status)` for Kanban board rendering.
- Composite index on `Issue(supportLevel, status)` for Support Center queues.
- Index on `Issue(assigneeId)` for personal ticket filtering.
- **PostgreSQL Partial Index for SLA Monitoring**:
  ```sql
  CREATE INDEX idx_issue_unresolved_sla ON "Issue" ("createdDate", "priority", "supportLevel")
  WHERE "status" NOT IN ('Resolved', 'Closed');
  ```
  *Justification*: Over 90% of tickets in a mature service desk are closed. Real-time SLA monitors and countdown timers query only active, unresolved tickets. By utilizing a PostgreSQL partial index with a `WHERE "status" NOT IN ('Resolved', 'Closed')` predicate, the index remains extremely compact, fully resident in RAM, and queries execute in `< 2ms` even on millions of historical records.

---

## 14. Prisma ORM Responsibilities

Prisma ORM is the single abstraction layer between business services and PostgreSQL.

### 14.1 Rules for Database Interaction
1. **Standard Queries**: Standard create, read, update, and delete operations must use Prisma Client typed methods (`findMany`, `findUnique`, `create`, `update`, `delete`).
2. **Eliminating the N+1 Problem**: Never query related records in loops. Use Prisma's `include` or explicit `select` trees:
   ```typescript
   // Correct: Single database round-trip
   const issues = await this.prisma.issue.findMany({
     where: { projectId },
     include: {
       assignee: { select: { id: true, name: true, avatar: true } },
       _count: { select: { comments: true, attachments: true } },
     },
   });
   ```
3. **Atomic Multi-Entity Transactions**: Multi-entity mutations (such as ticket escalations or sprint completions) must be wrapped in `prisma.$transaction`.
4. **Parameterized Raw SQL Exception**: Parameterized raw SQL (`prisma.$queryRaw`) is permitted when technically justified (e.g., complex interval math or full-text ranking) provided it uses tagged template literals (`Prisma.sql`) to prevent SQL injection.
5. **Migration Discipline**:
   - Schema modifications are strictly executed via `npx prisma migrate dev --name <migration_name>` during development.
   - Production migrations run exclusively via `npx prisma migrate deploy`.
   - Never alter the production database schema manually through raw SQL consoles.

---

## 15. Authentication Architecture

### 15.1 Stateless JWT Flow
The authentication system adheres to the OpenID Connect / OAuth2 Bearer token model:

```
[ Client: LoginPage ]
         │
         │ 1. POST /api/auth/login { emailOrId, password }
         ▼
[ NestJS: AuthController ]
         │
         │ 2. AuthService.validateUser(emailOrId, password)
         ▼
[ UsersService / Prisma ]
         │
         │ 3. Fetch user by email or ID -> bcrypt.compare(password, user.password)
         ▼
[ AuthService ]
         │
         │ 4. Generate JWT payload: { sub: user.id, email: user.email, role: user.role }
         │    Sign token using JWT_SECRET with expiration (e.g. 7d)
         ▼
[ Client Response ]
         │
         │ 5. Returns { accessToken, user }
         ▼
[ Client Browser ]
         │
         │ 6. Stores token in localStorage
         │    Attaches "Authorization: Bearer <token>" to subsequent HTTP requests
```

### 15.2 Security Architecture Decision: Token Storage & Expiration
1. **MVP Client Standard (`localStorage`)**:
   - The current React frontend client persists authentication in browser `localStorage`.
   - **XSS Risk Consideration**: `localStorage` is accessible to JavaScript, meaning Cross-Site Scripting (XSS) vulnerabilities could allow token extraction.
   - **Mitigation**: The frontend applies strict JSX auto-escaping, and production deployments must enforce a rigid Content Security Policy (CSP) header.
2. **Production Roadmap (`HttpOnly` Cookies)**:
   - For enterprise production deployments, the system is designed to transition from `localStorage` to `HttpOnly, Secure, SameSite=Lax` cookies, eliminating XSS token theft.
3. **Token Expiration & Revocation Trade-off**:
   - The current default token expiration is `7d` for developer ergonomics during MVP construction.
   - **Revocation Risk**: Stateless JWTs cannot be revoked prior to expiration without an in-memory or Redis-backed token revocation blocklist.
   - **Target Production Standard**: Transition to short-lived access tokens (15 minutes) coupled with rotating refresh tokens stored in `HttpOnly` cookies.

### 15.3 Current Codebase Reality & Migration
- In the frontend seed data ([`src/data/seedData.ts`](../src/data/seedData.ts)), passwords default to `password123` (or `admin123` for Admin).
- When initializing the backend database seed script (`backend/prisma/seed.ts`), all default passwords must be processed through `bcrypt.hash(password, 10)` before insertion into PostgreSQL.

---

## 16. Authorization and RBAC Architecture

### 16.1 Conceptual Separation
- **Authentication**: Verifies *who* the caller is (validates JWT integrity and extracts `user.id`).
- **Authorization**: Determines *what* the authenticated user is permitted to do based on their role and context.

### 16.2 Two-Tier Authorization Model
The system enforces authorization at two distinct layers:

#### Tier 1: Endpoint Role Guards (`RolesGuard`)
Coarse-grained operational restrictions applied via `@Roles(...)` metadata:
```typescript
@Post('projects')
@Roles(UserRole.Admin, UserRole.Project_Manager)
async createProject(@Body() dto: CreateProjectDto) {
  return this.projectsService.create(dto);
}
```
If a user with role `Developer` or `Viewer` invokes this endpoint, `RolesGuard` immediately throws a `403 Forbidden` exception without invoking service logic.

#### Tier 2: Dynamic Role-to-Page Access Matrix
Derived from [`src/services/rbac.ts`](../src/services/rbac.ts), administrators can dynamically modify which roles can access specific workspace pages via the Admin Panel. This matrix is persisted in the database (`Settings.rolePageAccess`) and served via `GET /api/settings` to synchronize with frontend route guards (`RoleRoute`).

### 16.3 Scope of Admin Superuser Bypass
While the `Admin` role possesses elevated privileges, the bypass is strictly scoped to prevent security bypasses:
1. **Authentication is Mandatory**: Administrators MUST present a valid, unexpired Bearer token. `Admin` does not bypass `JwtAuthGuard`.
2. **Public Endpoints**: Endpoints decorated with `@Public()` (such as `POST /api/auth/login`) bypass `JwtAuthGuard` and `RolesGuard` regardless of role.
3. **Role Check Bypass Only**: Within `RolesGuard`, if an authenticated user has `user.role === UserRole.Admin`, they satisfy the role check for that route.
4. **No Domain Validation Bypass**: Administrators cannot bypass DTO validation, foreign key constraints, or state machine rules (e.g. completing an already closed sprint).
5. **No Account Self-Lockout**: System safety constraints (such as preventing an administrator from deleting their own active account) cannot be bypassed.

---

## 17. Cross-Module Communication

### 17.1 Module Boundary Rules
To prevent circular dependencies and spaghetti architecture in a modular monolith:
1. **No Direct Model Manipulation**: `IssuesModule` must never directly modify notifications in the database. It must delegate to `NotificationsService`.
2. **Explicit Module Exports**: If `IssuesModule` requires `NotificationsService`, `NotificationsModule` must explicitly export `NotificationsService` in its `exports` array, and `IssuesModule` must import `NotificationsModule` in its `imports` array.

### 17.2 Transactional Integrity & Event Reliability Strategy
When an operation has both database state mutations and side effects (such as sending notifications):
1. **Local Database Consistency (Inside Transaction)**:
   In-app database notification rows (`Notification` table) and audit records (`ActivityEvent` table) MUST be created inside the `prisma.$transaction` block so that if the ticket update fails, no orphan notification or audit row is left behind.
2. **External Side Effects (Post-Commit Dispatch)**:
   External network operations (such as sending SMTP emails, mobile push notifications, or WebSocket broadcasts) MUST NEVER be executed inside `prisma.$transaction`. Holding database connections open while awaiting external network responses exhausts connection pools and risks transaction timeouts.
3. **Recommended Two-Phase Execution**:
   ```typescript
   // Step 1: Atomic Database Transaction
   const updatedIssue = await this.prisma.$transaction(async (tx) => {
     await tx.escalationRecord.create({ ... });
     await tx.comment.create({ ... });
     await tx.activityEvent.create({ ... });
     if (dto.assignedToUserId) {
       await tx.notification.create({ ... }); // In-app notification
     }
     return tx.issue.update({ ... });
   });

   // Step 2: Post-Commit Event Emission (Safe outside transaction)
   this.eventEmitter.emit('issue.escalated', new IssueEscalatedEvent(updatedIssue, dto));
   ```

---

## 18. Validation and Error Handling Architecture

### 18.1 Global Input Validation Pipeline
Every incoming HTTP request body, query parameter, and route parameter is passed through a global NestJS `ValidationPipe` configured in `main.ts`:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Strips unexpected fields not defined in DTO
    forbidNonWhitelisted: true,    // Throws 400 Bad Request if unexpected fields are sent
    transform: true,              // Automatically casts JSON primitives to DTO types
    transformOptions: {
      enableImplicitConversion: true, // Enables automatic conversion of query primitives (e.g. take="50" -> 50)
    },
  }),
);
```

> [!NOTE]
> While `enableImplicitConversion: true` enables seamless conversion of query strings, DTOs should explicitly use `@Type(() => Number)` from `class-transformer` or specific validators (`@IsInt()`) on complex payloads to prevent accidental coercion.

### 18.2 Uniform Error Response Contract
All exceptions thrown across the application are intercepted by `HttpExceptionFilter` and formatted into a consistent, predictable JSON contract:

```json
{
  "statusCode": 404,
  "message": "Ticket INB-1002 was not found.",
  "error": "Not Found",
  "timestamp": "2026-10-10T12:00:00.000Z",
  "path": "/api/issues/INB-1002"
}
```

### 18.3 Prisma Exception Mapping
The backend registers a global `PrismaExceptionFilter` to convert raw database driver errors into clean HTTP status codes:
- **`P2002` (Unique Constraint Violation)**: Returns `409 Conflict` (e.g. "A project with key CSP already exists").
- **`P2025` (Record Not Found)**: Returns `404 Not Found`.
- **`P2003` (Foreign Key Constraint Failed)**: Returns `400 Bad Request` (e.g. "Referenced assigneeId does not exist").

---

## 19. Logging and Auditing Architecture

### 19.1 Technical System Logging
- NestJS built-in `Logger` (or structured Winston/Pino logger) logs server lifecycle events, incoming request routes, execution latencies, and unexpected runtime errors.
- No sensitive data (passwords, JWT secrets, customer credit card information) may ever be printed to log streams.

### 19.2 Business Domain Auditing (`ActivityEvent`)
- The application implements an append-only audit trail persisted in the `ActivityEvent` table.
- Every state mutation (issue creation, status transition, priority change, support tier escalation, comment posting, project creation) generates an immutable `ActivityEvent` recording:
  - `userId`: Who performed the action.
  - `issueId` / `projectId`: Target entity.
  - `action`: Canonical action verb (`created`, `updated`, `escalated`, `commented`, `status_changed`).
  - `details`: Human-readable summary of the exact change.
  - `timestamp`: UTC timestamp.

---

## 20. Security Architecture

### 20.1 Defense-in-Depth Principles
1. **Secret Isolation**: Secrets (e.g. `JWT_SECRET`, database passwords) must never be committed to source control or hardcoded in TypeScript files.
2. **SQL Injection Protection**: Guaranteed natively by Prisma ORM, which executes all database queries using prepared statements and parameterized inputs.
3. **Cross-Site Scripting (XSS) Prevention**: All user-generated text content (issue descriptions, comments) must be sanitized before rendering. React's JSX auto-escaping protects against HTML injection.
4. **CORS Governance**: Configured dynamically from the `CORS_ORIGIN` environment variable. In local development, it defaults to `http://localhost:3000` (matching the Vite development server port configured in `package.json`). In production, it supports comma-separated allowed origins.
5. **Password Encryption**: All passwords stored in PostgreSQL must be hashed using `bcrypt` with a minimum of 10 salt rounds. Plaintext passwords must never be stored or logged.
6. **HTTP Security Headers**: Production deployments must utilize `helmet` middleware to enforce HTTP Strict Transport Security (HSTS), Content Security Policy (CSP), and clickjacking prevention (`X-Frame-Options: DENY`).

---

## 21. Environment Configuration Principles

### 21.1 Environment Variable Management
All environment configurations must be loaded through `@nestjs/config` and validated against a schema at startup. If any required environment variable is missing or malformed, the application must immediately fail to boot with an explicit error message.

### 21.2 Configuration Template (`backend/.env.example`)
```env
# Application Runtime
PORT=4000
NODE_ENV=development

# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inbox_ticketing?schema=public"

# Authentication & Security
JWT_SECRET="replace-with-a-secure-random-256-bit-key-in-production"
JWT_EXPIRATION="7d"

# Network & Cross-Origin Resource Sharing (Matches Vite --port=3000 default)
CORS_ORIGIN="http://localhost:3000"
```

> [!WARNING]
> Real production secrets must never be placed in `.env.example` or shared in documentation. Each developer must maintain their own local `.env` file copied from `.env.example`.

---

## 22. Testing Architecture

### 22.1 Testing Strategy
Distributed backend developers must implement tests at three levels:

```
        / \
       /   \
      / E2E \       <-- Full HTTP workflow tests (Supertest + In-Memory/Docker DB)
     /-------\
    / Integr. \     <-- Controller + Service + Prisma integration
   /-----------\
  /    Unit     \   <-- Service business logic, SLA calculators, DTO validators
 /---------------\
```

1. **Unit Tests (`*.spec.ts`)**:
   - Test individual service methods in complete isolation.
   - Mock `PrismaService` to test business calculations (e.g. SLA deadline logic, escalation state validation) without requiring a running database.
2. **Integration Tests**:
   - Verify controller routing, validation pipes, and error filters against actual service logic.
3. **End-to-End Tests (`test/*.e2e-spec.ts`)**:
   - Test full user journeys (e.g. Login -> Create Ticket -> Escalate Ticket -> Query Support Queue) via HTTP calls using Supertest against a test PostgreSQL instance.

---

## 23. Development and Integration Workflow

To enable multiple developers to work independently on different machines without conflicts:

### 23.1 Developer Setup Sequence
1. **Clone Repository**: Clone the repository and navigate to root.
2. **Run Frontend**: Verify the React frontend runs locally:
   ```bash
   npm install
   npm run dev
   ```
3. **Initialize Backend**:
   When implementing the backend, create `backend/` initialized with NestJS CLI.
4. **Provision Database**:
   Launch a local PostgreSQL instance (e.g. via Docker Compose or native PostgreSQL) listening on port `5432`.
5. **Run Prisma Migrations**:
   Execute `npx prisma migrate dev --name init` to apply the database schema.
6. **Seed Database**:
   Execute `npx prisma db seed` to import seed data matching `src/data/seedData.ts`.
7. **Start Backend Dev Server**:
   Execute `npm run start:dev` in `backend/` (listening on port `4000`).

### 23.2 Frontend Integration Switch
Once backend endpoints are ready, transition the React frontend from mock `localStorage` to live HTTP endpoints:
1. Introduce [`src/services/api.ts`](../BACKEND_ARCHITECTURE.md#1-http-api-client-srcservicesapits) implementing `apiRequest<T>()`.
2. Update [`src/context/AppContext.tsx`](../src/context/AppContext.tsx) to fetch initial data from `/api/issues`, `/api/projects`, `/api/users`, and `/api/settings` upon authentication.
3. Replace direct `storage.*` mutations with corresponding `apiRequest` calls.

---

## 24. Deployment Considerations

### 24.1 Production Deployment Topology
1. **Frontend Distribution**: The React 19 application is built into static HTML/CSS/JS bundles (`npm run build`) and served via a CDN or static web server (Nginx / Cloudflare Pages).
2. **Backend Services**: The NestJS application is packaged as a lightweight Docker container running Node.js in cluster or production mode (`node dist/main.js`).
3. **Ingress / Reverse Proxy**: An Nginx or Cloud Application Load Balancer routes traffic:
   - Path `/api/*` -> Forwarded to NestJS backend container (port 4000).
   - Path `/*` -> Forwarded to React static assets.
4. **Database Tier**: Managed PostgreSQL instance (e.g. AWS RDS, Google Cloud SQL, Supabase, Neon) with automated daily backups and connection pooling.

---

## 25. Architectural Constraints

All developers contributing backend code must abide by these non-negotiable constraints:

1. **Strict Type Safety**: The TypeScript compiler must run with `"strict": true`. The use of `any` is prohibited. All DTOs, return types, and service parameters must be explicitly typed.
2. **No Monolithic Service Bloat**: Do not pack all business logic into a single service. Adhere strictly to the 15-module domain boundaries.
3. **UTC Everywhere**: All timestamps stored in PostgreSQL and returned via JSON APIs must be in UTC ISO-8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`).
4. **No UI-Driven DB Mutations**: The database schema must never be modified to accommodate cosmetic frontend hacks. Maintain a clean, normalized relational design.
5. **Zero Secrets in Git**: Any commit containing API keys, private credentials, or real passwords will be rejected.

---

## 26. Known Gaps and Unresolved Decisions

The following architectural gaps and decisions are documented for explicit stakeholder awareness:

| Item | Current Status | Impact / Open Question | Recommended Direction |
|---|---|---|---|
| **Repository Layout (Monorepo vs Nested Backend)** | Root `package.json` currently belongs to the React frontend. | Where should NestJS backend reside long-term? | Maintain `backend/` folder alongside frontend or migrate to npm workspaces / Turborepo monorepo. |
| **Attachment File Storage** | Attachment schema stores metadata (`filename`, `fileType`, `fileSize`), but binary file storage is undefined. | Where are uploaded files physically stored? | For local dev, store in `backend/uploads/`. For production, integrate AWS S3 or MinIO presigned URLs. |
| **Real-Time SLA & Notification Delivery** | Current design relies on HTTP polling and client-side countdown calculation. | Does the application require live WebSocket pushes for ticket assignments and tier escalations? | Implement `@nestjs/websockets` (Socket.io) in a subsequent phase once REST APIs are stable. |
| **Token Refresh & Revocation** | Stateless JWT uses a single long-lived access token (`7d`). | Should the system implement short-lived access tokens (15m) + rotating refresh tokens in HttpOnly cookies? | Keep 7d token for initial MVP launch; introduce refresh token rotation in Phase 2 security hardening. |
| **Issue Numbering Concurrency** | Issue IDs (e.g. `INB-1001`) combine project key with a numeric counter. | High concurrency could result in duplicate IDs if two tickets are created simultaneously. | Use PostgreSQL sequence or an explicit transactional counter table per project to guarantee atomic increment. |
| **User Password Reset Workflow** | Admin overwrites password directly in `PATCH /api/users/:id/password`. | Self-service forgot-password email workflow is currently unmodeled. | Plan self-service forgot password with time-limited email reset tokens in future sprint. |

---
*End of System Architecture Specification.*
*Refer to [docs/02_CODING_STANDARDS.md](02_CODING_STANDARDS.md) for micro coding rules and docs/03_MODULE_IMPLEMENTATION.md (planned) for module-by-module implementation contracts.*

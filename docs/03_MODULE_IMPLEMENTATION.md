# Backend Module Implementation Guide
## Ticketing Management Platform (Inbox / GoldMine Portal)

---

## 1. Document Purpose and Architectural Alignment

### 1.1 Purpose
This document provides the authoritative, module-by-module implementation blueprint for the backend of the **Ticketing Management Platform** (Inbox / GoldMine Portal). It is designed specifically to allow multiple backend engineers working concurrently on physically separate machines to build, test, and integrate independent backend modules without introducing architectural drift, contract incompatibilities, database conflicts, or duplicate implementations.

### 1.2 Documentation Hierarchy and Authority
This document constitutes Part 3 of the unified backend engineering specification suite:

1. [**`docs/01_SYSTEM_ARCHITECTURE.md`**](file:///c:/Users/kirit/ticketing_tool/docs/01_SYSTEM_ARCHITECTURE.md):
   **The Macro Architectural Blueprint.** Governs system topology, module organization, database architecture, security model, request/response lifecycles, and cross-tier responsibilities.
2. [**`docs/02_CODING_STANDARDS.md`**](file:///c:/Users/kirit/ticketing_tool/docs/02_CODING_STANDARDS.md):
   **The Micro Engineering Standard.** Governs line-level TypeScript rules, NestJS conventions, DTO validation syntax, Prisma query patterns, exception handling specifics, and testing standards.
3. [**`docs/03_MODULE_IMPLEMENTATION.md` (This Document)**](file:///c:/Users/kirit/ticketing_tool/docs/03_MODULE_IMPLEMENTATION.md):
   **The Module Implementation Blueprint.** Governs module boundaries, folder structures, component responsibilities, exhaustive REST API contracts, database ownership, authorization rules, business rules, error handling, testing criteria, completion checklists, dependency sequencing, and multi-developer parallel collaboration rules.

### 1.3 Immutable Architectural Predecessor
The repository root contains [**`BACKEND_ARCHITECTURE.md`**](file:///c:/Users/kirit/ticketing_tool/BACKEND_ARCHITECTURE.md), representing the foundational domain analysis derived directly from the existing React 19 frontend application. That document remains **strictly immutable**. All module boundaries, REST endpoint signatures, DTO structures, and Prisma models documented herein conform strictly to `BACKEND_ARCHITECTURE.md`, `docs/01_SYSTEM_ARCHITECTURE.md`, and `docs/02_CODING_STANDARDS.md`.

---

## 2. Codebase Audit and Baseline Inspection Summary

Before formulating module boundaries and implementation tasks, an exhaustive inspection of the existing workspace was executed:

| Inspected Artifact | Physical Location / Reference | Current Physical Status | Architectural Findings & Baseline Facts |
|---|---|---|---|
| **Primary Design Spec** | [`BACKEND_ARCHITECTURE.md`](file:///c:/Users/kirit/ticketing_tool/BACKEND_ARCHITECTURE.md) | **Active (Immutable)** | Specifies 15 backend modules, 12 PostgreSQL models, 11 enums, 30+ endpoints, and complete DTOs derived from frontend. |
| **System Architecture** | [`docs/01_SYSTEM_ARCHITECTURE.md`](file:///c:/Users/kirit/ticketing_tool/docs/01_SYSTEM_ARCHITECTURE.md) | **Active** | Formalizes 15 modules (1 global infrastructure + 14 business domains), request lifecycle, SLA indexing, and data pipeline. |
| **Coding Standards** | [`docs/02_CODING_STANDARDS.md`](file:///c:/Users/kirit/ticketing_tool/docs/02_CODING_STANDARDS.md) | **Active** | Establishes kebab-case filenames, strict typing, DTO rules, 200 OK for delete responses, and two-phase transaction execution. |
| **Frontend UI Views** | `frontend/src/pages/` | **Implemented (16 Views)** | Fully functioning React 19 views: `Dashboard`, `IssuesPage`, `IssueDetailPage`, `KanbanBoard`, `BacklogPage`, `SupportCenterPage`, `ReportsPage`, `ProjectsPage`, `ProjectDetailPage`, `TeamPage`, `AdminPanelPage`, `SettingsPage`, `ProfilePage`, `DocumentationPage`, `LoginPage`, `AccessDeniedPage`. |
| **Frontend Routing** | `frontend/src/App.tsx` | **Implemented** | Client routing via React Router DOM 7 with `RoleRoute`, `ProtectedRoute`, and `PublicOnlyRoute`. |
| **Frontend RBAC Logic** | `frontend/src/services/rbac.ts` | **Implemented** | Defines 8 roles (`Admin`, `Project Manager`, `Engineer`, `Technical`, `Developer`, `QA`, `Support Agent`, `Viewer`) and dynamic page permission mappings. |
| **Frontend Persistence** | `frontend/src/services/storage.ts` | **Mock Only** | Reads and persists data purely in browser `localStorage`. No network HTTP calls to an actual backend. |
| **Frontend Seed Data** | `frontend/src/data/seedData.ts` | **Implemented** | 75KB seed dataset containing seed projects (`INB`, `CSP`, `MOB`), users, issues, sprints, epics, comments, notifications, and settings. |
| **Backend Source Code** | `backend/src/` | **Not Implemented** | Directory does not exist yet. Only `backend/.env.example` and `backend/README.md` exist. |
| **Prisma Schema** | `backend/prisma/schema.prisma` | **Specified Only** | Fully specified in `BACKEND_ARCHITECTURE.md` Phase 5, but not yet generated on disk in `backend/prisma/`. |
| **Automated Tests** | `backend/test/` | **Not Implemented** | Backend test harnesses (Jest, Supertest) have not yet been initialized. |

---

## 3. Module Inventory and Architectural Boundary Analysis

### 3.1 Master Module Catalog
Based on the verified architecture in `docs/01_SYSTEM_ARCHITECTURE.md` and `BACKEND_ARCHITECTURE.md`, the backend application is structured into **15 Confirmed Modules** plus **1 Proposed Module** (`ReportsModule`):

```
                                  ┌────────────────────────┐
                                  │      PrismaModule      │ (Global Infrastructure)
                                  └───────────┬────────────┘
                                              │
                      ┌───────────────────────┴────────────────────────┐
                      ▼                                                ▼
        ┌───────────────────────────┐                    ┌───────────────────────────┐
        │        AuthModule         │                    │        UsersModule        │
        └─────────────┬─────────────┘                    └─────────────┬─────────────┘
                      │                                                │
                      └───────────────────────┬────────────────────────┘
                                              ▼
                             ┌─────────────────────────────────┐
                             │         ProjectsModule          │
                             └────────────────┬────────────────┘
                                              ▼
                             ┌─────────────────────────────────┐
                             │          IssuesModule           │◄── (Central Ticketing & SLA Engine)
                             └────┬───────────┬───────────┬────┘
                                  │           │           │
           ┌──────────────────────┼───────────┴───────────┼──────────────────────┐
           ▼                      ▼                       ▼                      ▼
┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│   CommentsModule   │ │ AttachmentsModule  │ │   SprintsModule    │ │    EpicsModule     │
└────────────────────┘ └────────────────────┘ └────────────────────┘ └────────────────────┘
           │                      │                       │                      │
           └──────────────────────┼───────────────────────┴──────────────────────┘
                                  ▼
         ┌───────────────────────────────────────────────────────────────┐
         │ Cross-Cutting & Governance: ActivityModule, NotificationsModule,│
         │ SettingsModule, SavedFiltersModule, SearchModule, SystemModule│
         │ [PROPOSED]: ReportsModule                                     │
         └───────────────────────────────────────────────────────────────┘
```

### 3.2 Boundary Rationale for Potential & Discovered Subsystems
During system decomposition, several capabilities might appear as candidates for standalone NestJS modules. The following table explains the architectural reasoning for confirming, encapsulating, or proposing each module boundary:

| Candidate Capability | Boundary Decision | Architectural Rationale & Mapping |
|---|---|---|
| **Roles & Permissions** | **Encapsulated** in `common/` & `SettingsModule` | Operational route authorization is implemented via cross-cutting guards (`RolesGuard`) and decorators (`@Roles()`). Dynamic role-to-page permission matrices are stored in `Settings.rolePageAccess` and governed by `SettingsModule`. A standalone module is redundant and would create circular dependencies. |
| **Backlog** | **Encapsulated** in `SprintsModule` & `IssuesModule` | In Agile lifecycle, "Backlog" is not a separate entity; it is the set of issues where `sprintId === null`. Backlog ceremonies (sprint creation, issue assignment, starting, and rolling over) belong to `SprintsModule`, while backlog issue queries belong to `IssuesModule`. |
| **Support Escalation** | **Encapsulated** in `IssuesModule` | Escalations mutate `Issue.supportLevel` (`L1` -> `L2` -> `L3`), generate an `EscalationRecord`, and post internal comments. Separating support escalations into an isolated module would require distributed two-phase commits across modules. Encapsulating this inside `IssuesModule` preserves ACID transactions. |
| **Team Management** | **Encapsulated** in `UsersModule` | The frontend `TeamPage` displays users, their departments, tier badges (`L1`, `L2`, `L3`), and workload stats. All underlying data maps directly to the `User` entity. `UsersModule` provides all necessary queries and mutations. |
| **Admin Panel** | **Distributed** across domain modules | Administrative features span multiple domains: user management (`UsersModule`), SLA/RBAC policies (`SettingsModule`), audit logs (`ActivityModule`), and database backup/restore (`SystemModule`). Admin access is secured using `@Roles(UserRole.Admin)` across respective controllers. |
| **Audit Logs** | **Confirmed** as `ActivityModule` | An append-only ledger of historical state mutations across tickets, projects, and users. Operating as an independent module allows other domain modules to record telemetry without tight coupling. |
| **Search** | **Confirmed** as `SearchModule` | Full-text global search queries across multiple independent entities (`Issue`, `Project`, `Epic`). Encapsulating search keeps domain modules free of cross-entity search indexes. |
| **Reports & Analytics** | **PROPOSED** as `ReportsModule` | Currently, `ReportsPage` and `Dashboard` aggregate SLA metrics and velocity client-side from fetched issues. In production with large datasets, calculating compliance rates and breach metrics client-side is inefficient. A dedicated `ReportsModule` provides server-side aggregated metrics. |

---

## 4. Module-by-Module Implementation Blueprint

---

### Module 1: PrismaModule (Global Infrastructure)

#### A. Module Overview
* **Module Name**: `PrismaModule`
* **Purpose**: Serves as the centralized, global database connection and lifecycle abstraction layer for PostgreSQL via Prisma ORM.
* **Business Responsibilities**: Manages database connection pooling, enforces clean application shutdown hooks, logs query performance, and provides type-safe database access to all domain services.
* **In-Scope Functionality**:
  - `PrismaService` extending `PrismaClient` with `OnModuleInit` and `OnModuleDestroy` hooks.
  - Exporting `PrismaService` globally (`@Global()`).
  - Connection pooling configuration via `DATABASE_URL`.
* **Out-of-Scope Functionality**:
  - Domain business logic, entity mutations, or HTTP request handling.

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 5/6 and `docs/01_SYSTEM_ARCHITECTURE.md` Section 9/14; `backend/prisma/` directory not yet created on disk).

#### C. Folder Structure
```text
backend/
├── prisma/
│   ├── [PROPOSED] schema.prisma             # Authoritative Prisma schema (from BACKEND_ARCHITECTURE.md)
│   ├── [PROPOSED] seed.ts                   # Database seed script
│   └── migrations/                          # Prisma migration history
└── src/
    └── prisma/
        ├── [PROPOSED] prisma.module.ts      # Global NestJS module
        └── [PROPOSED] prisma.service.ts     # Injectable PrismaClient wrapper
```

#### D. Components and Responsibilities
* **Module (`prisma.module.ts`)**: Decorated with `@Global()`. Provides and exports `PrismaService`.
* **Service (`prisma.service.ts`)**: Inherits from `PrismaClient`. Implements `onModuleInit()` (`await this.$connect()`) and `onModuleDestroy()` (`await this.$disconnect()`).
* **Database Access**: Encapsulates connection lifecycle.
* **Tests**: Unit tests verify connection and teardown hooks using mocked `$connect` and `$disconnect`.

#### E. API Contracts
* No HTTP endpoints. Purely an internal infrastructure provider.

#### F. Database Requirements
* **Models**: Owns the lifecycle of the entire PostgreSQL schema defined in `schema.prisma`.
* **Transaction Requirements**: Provides `$transaction` to all domain modules.

#### G. Authorization Requirements
* Not applicable. Internal backend service.

#### H. Dependencies
* **Prerequisites**: PostgreSQL database instance, `@prisma/client`, `prisma` CLI.
* **Dependent Modules**: All 14 business domain modules depend on `PrismaModule`.

#### I. Business Rules
* Connection pool sizing must respect `DATABASE_URL` pool parameters.
* Must disconnect gracefully on `SIGINT` and `SIGTERM`.

#### J. Error Handling
* Connection timeouts or connection pool exhaustion must throw structured server startup errors.
* Database error codes (`P2002`, `P2025`, `P2003`) are intercepted by the global `PrismaExceptionFilter`.

#### K. Testing Requirements
* Unit test verifying `onModuleInit` invokes `$connect` and logs failures.
* Unit test verifying `onModuleDestroy` invokes `$disconnect`.

#### L. Completion Checklist
- [ ] `prisma/schema.prisma` matches `BACKEND_ARCHITECTURE.md` Phase 5 exactly.
- [ ] Initial migration `init` generated and applied via `npx prisma migrate dev`.
- [ ] `PrismaService` connects and disconnects without memory leaks.
- [ ] `PrismaModule` exported globally in `app.module.ts`.

---

### Module 2: AuthModule

#### A. Module Overview
* **Module Name**: `AuthModule`
* **Purpose**: Manages user authentication, stateless JWT issuance, session validation, and password credential verification.
* **Business Responsibilities**: Validates login credentials against bcrypt password hashes, issues signed JWT access tokens, validates incoming Bearer tokens, and returns authenticated user profiles.
* **In-Scope Functionality**:
  - `POST /api/auth/login` (Credential verification and token issuance).
  - `GET /api/auth/me` (Current user profile hydration).
  - `POST /api/auth/logout` (Client session invalidation confirmation).
  - Passport JWT strategy and authentication guards.
* **Out-of-Scope Functionality**:
  - Creating or modifying user accounts (delegated to `UsersModule`).
  - Refresh token rotation (unresolved design item for Phase 2).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.1 and `docs/01_SYSTEM_ARCHITECTURE.md` Section 15).

#### C. Folder Structure
```text
backend/src/modules/auth/
├── [PROPOSED] auth.module.ts
├── [PROPOSED] auth.controller.ts
├── [PROPOSED] auth.service.ts
├── strategies/
│   └── [PROPOSED] jwt.strategy.ts
└── dto/
    └── [PROPOSED] login.dto.ts
```

#### D. Components and Responsibilities
* **Module (`auth.module.ts`)**: Imports `PassportModule`, `JwtModule.registerAsync()`, and `UsersModule`. Exports `AuthService` and `JwtStrategy`.
* **Controller (`auth.controller.ts`)**: Exposes login, me, and logout endpoints.
* **Service (`auth.service.ts`)**: Validates email/password via `bcrypt.compare`, signs JWT payload (`sub`, `email`, `role`).
* **Strategy (`jwt.strategy.ts`)**: Extracts Bearer token, validates against `JWT_SECRET`, resolves active user from database.
* **DTOs**: `LoginDto` (`emailOrId`, `password`).

#### E. API Contracts

##### 1. `POST /api/auth/login`
* **Purpose**: Authenticate user and issue JWT access token.
* **Auth Requirement**: Public (`@Public()`).
* **Required Permission**: None.
* **Request Body**:
  ```json
  {
    "emailOrId": "tejas@inbox.GoldMine.io",
    "password": "admin123"
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-1",
      "name": "Tejas Chauhan",
      "email": "tejas@inbox.GoldMine.io",
      "role": "Admin",
      "department": "Engineering Management",
      "supportLevels": ["L1", "L2", "L3"],
      "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      "timezone": "America/New_York",
      "status": "Active"
    }
  }
  ```
* **Relevant HTTP Status Codes**: `200 OK`, `400 Bad Request`, `401 Unauthorized`.
* **Possible Errors**: `400` if fields missing; `401` if credentials invalid or user inactive.

##### 2. `GET /api/auth/me`
* **Purpose**: Retrieve currently authenticated user session details.
* **Auth Requirement**: Authenticated (`Bearer JWT`).
* **Required Permission**: Any authenticated role.
* **Request Parameters**: None.
* **Request Body**: None.
* **Success Response (`200 OK`)**: `User` object (excluding password hash).
* **Relevant HTTP Status Codes**: `200 OK`, `401 Unauthorized`.

##### 3. `POST /api/auth/logout`
* **Purpose**: Client logout confirmation.
* **Auth Requirement**: Authenticated (`Bearer JWT`).
* **Required Permission**: Any authenticated role.
* **Success Response (`200 OK`)**: `{ "success": true }`.
* **Relevant HTTP Status Codes**: `200 OK`, `401 Unauthorized`.

#### F. Database Requirements
* **Required Models**: Reads `User` table.
* **Important Fields**: `id`, `email`, `password`, `role`, `status`, `supportLevels`.
* **Transactions**: None. Single-entity lookup.

#### G. Authorization Requirements
* Public for login. All authenticated roles permitted for `/me` and `/logout`.

#### H. Dependencies
* **Prerequisites**: `PrismaModule`, `UsersModule`.
* **Modules Dependent on this**: All modules requiring authenticated endpoints via `JwtAuthGuard`.

#### I. Business Rules
* Passwords must be compared using `bcrypt.compare`.
* Inactive users (`status === 'Offline'` or deactivated) must be rejected with `401 Unauthorized`.
* Token expiration defaults to `7d` (MVP configuration).

#### J. Error Handling
* Invalid credentials must return generic `401 Unauthorized` ("Invalid email/userId or password") to prevent username enumeration.

#### K. Testing Requirements
* Unit test `AuthService.login()` with valid and invalid passwords.
* Integration test `POST /api/auth/login` returning 200 with JWT.
* Integration test `GET /api/auth/me` with valid and expired Bearer tokens.

#### L. Completion Checklist
- [ ] `LoginDto` validates non-empty strings.
- [ ] Passwords hashed with bcrypt (10 rounds).
- [ ] Passwords strictly omitted from response payloads.
- [ ] `GET /api/auth/me` works with Bearer token.
- [ ] Tests pass cleanly with zero lint errors.

---

### Module 3: UsersModule

#### A. Module Overview
* **Module Name**: `UsersModule`
* **Purpose**: Manages user accounts, member profiles, team rosters, support tier competencies, and administrative password overwrites.
* **Business Responsibilities**: Powers `TeamPage`, `AdminPanelPage` (Users tab), `ProfilePage`, and provides assignee lookup data across ticketing modules.
* **In-Scope Functionality**:
  - `GET /api/users` (List team members with filtering by role and support tier).
  - `POST /api/users` (Admin/PM creates member account).
  - `PATCH /api/users/:id` (Update member details, status, or tier competencies).
  - `PATCH /api/users/:id/password` (Admin password reset or self-update).
  - `PATCH /api/users/profile` (Current user updates self profile).
  - `DELETE /api/users/:id` (Admin removes member account).
* **Out-of-Scope Functionality**:
  - Self-service forgotten password email flow (unresolved design decision).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.2 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/users/
├── [PROPOSED] users.module.ts
├── [PROPOSED] users.controller.ts
├── [PROPOSED] users.service.ts
└── dto/
    ├── [PROPOSED] create-user.dto.ts
    ├── [PROPOSED] update-user.dto.ts
    ├── [PROPOSED] update-password.dto.ts
    ├── [PROPOSED] update-profile.dto.ts
    └── [PROPOSED] query-users.dto.ts
```

#### D. Components and Responsibilities
* **Module (`users.module.ts`)**: Declares `UsersController`, `UsersService`. Exports `UsersService` for consumption by `AuthModule` and `IssuesModule`.
* **Controller (`users.controller.ts`)**: Routes user queries, updates, password resets, and deletions. Applies `@Roles(UserRole.Admin, UserRole.Project_Manager)`.
* **Service (`users.service.ts`)**: Manages `User` table CRUD, hashes new passwords, validates email uniqueness.
* **DTOs**: `CreateUserDto`, `UpdateUserDto`, `UpdatePasswordDto`, `UpdateProfileDto`, `QueryUsersDto`.

#### E. API Contracts

##### 1. `GET /api/users`
* **Purpose**: List team members with filtering.
* **Auth Requirement**: Yes.
* **Required Permission**: Any authenticated role.
* **Query Parameters**: `q?: string`, `role?: UserRole`, `supportLevel?: SupportLevel`.
* **Request Body**: None.
* **Success Response (`200 OK`)**: Array of `User` objects (password omitted).
* **Possible Errors**: `401 Unauthorized`.

##### 2. `POST /api/users`
* **Purpose**: Create a new member account.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Request Body**:
  ```json
  {
    "name": "Rajesh Kumar",
    "email": "rajesh@inbox.GoldMine.io",
    "password": "password123",
    "role": "Support Agent",
    "department": "Customer Operations",
    "supportLevels": ["L1"],
    "avatar": "",
    "timezone": "Asia/Kolkata"
  }
  ```
* **Success Response (`201 Created`)**: Created `User` object (password omitted).
* **Possible Errors**: `400 Bad Request`, `403 Forbidden`, `409 Conflict` (Email already exists).

##### 3. `PATCH /api/users/:id`
* **Purpose**: Update member metadata, department, role, or support tier competencies.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Request Body**: Partial `User` fields.
* **Success Response (`200 OK`)**: Updated `User`.
* **Possible Errors**: `400 Bad Request`, `403 Forbidden`, `404 Not Found`.

##### 4. `PATCH /api/users/:id/password`
* **Purpose**: Administrative password overwrite or self-service password update.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin` (or target user `id === currentUserId`).
* **Request Body**: `{ "newPassword": "newSecurePassword123" }`.
* **Success Response (`200 OK`)**: `{ "success": true }`.
* **Possible Errors**: `400 Bad Request` (password < 6 characters), `403 Forbidden`, `404 Not Found`.

##### 5. `PATCH /api/users/profile`
* **Purpose**: Update authenticated user's own profile settings.
* **Auth Requirement**: Yes.
* **Required Permission**: Any authenticated role.
* **Request Body**: `{ "name"?: string, "avatar"?: string, "timezone"?: string, "supportLevels"?: SupportLevel[] }`.
* **Success Response (`200 OK`)**: Updated `User`.

##### 6. `DELETE /api/users/:id`
* **Purpose**: Remove member account.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`.
* **Success Response (`200 OK`)**: `{ "success": true }`.
* **Possible Errors**: `400 Bad Request` (self-deletion prohibited), `403 Forbidden`, `404 Not Found`.

#### F. Database Requirements
* **Model**: `User`.
* **Fields**: `id` (CUID), `email` (unique), `password`, `name`, `role`, `department`, `supportLevels`, `status`, `avatar`, `timezone`.
* **Indexes**: `@@index([role])`, `@@index([email])`.

#### G. Authorization Requirements
* `Admin`: Full access (create, edit, delete, password reset).
* `Project Manager`: Create and edit team members.
* Other Roles: Read team roster; edit own profile (`PATCH /api/users/profile`).

#### H. Dependencies
* **Prerequisites**: `PrismaModule`.
* **Dependent Modules**: `AuthModule`, `ProjectsModule`, `IssuesModule`.

#### I. Business Rules
* Administrator cannot delete their own active account (`currentUserId !== targetId`).
* Email addresses must be normalized to lowercase.
* Default password if omitted during creation is `password123` (hashed with bcrypt).

#### J. Error Handling
* Duplicate email throws `409 Conflict`.
* Target user not found throws `404 Not Found`.

#### K. Testing Requirements
* Unit test: `UsersService.create()` hashes password and strips hash from output.
* Unit test: Prevent self-deletion.
* E2E test: Non-admin calling `DELETE /api/users/:id` receives `403 Forbidden`.

#### L. Completion Checklist
- [ ] Password hash strictly omitted from all query responses.
- [ ] Email uniqueness validated via Prisma exception filter (`P2002` -> `409 Conflict`).
- [ ] Self-deletion prevented.
- [ ] Unit tests achieve >= 80% coverage on user service logic.

---

### Module 4: ProjectsModule

#### A. Module Overview
* **Module Name**: `ProjectsModule`
* **Purpose**: Manages project repositories, unique project keys (e.g., `INB`, `CSP`, `MOB`), project leads, and project memberships.
* **Business Responsibilities**: Powers `ProjectsPage` and `ProjectDetailPage`, establishes numbering prefixes for tickets, and controls project member rosters.
* **In-Scope Functionality**:
  - `GET /api/projects` (List projects with lead info and issue counts).
  - `GET /api/projects/:id` (Project cockpit with linked epics, sprints, and issues).
  - `POST /api/projects` (Create project repository with unique key).
  - `PATCH /api/projects/:id` (Update project metadata and status).
  - `DELETE /api/projects/:id` (Delete project repository and cascade delete issues).
* **Out-of-Scope Functionality**:
  - Direct issue creation (delegated to `IssuesModule`).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.6 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/projects/
├── [PROPOSED] projects.module.ts
├── [PROPOSED] projects.controller.ts
├── [PROPOSED] projects.service.ts
└── dto/
    ├── [PROPOSED] create-project.dto.ts
    ├── [PROPOSED] update-project.dto.ts
    └── [PROPOSED] query-projects.dto.ts
```

#### D. Components and Responsibilities
* **Module (`projects.module.ts`)**: Configures `ProjectsController`, `ProjectsService`. Exports `ProjectsService` for project validation in `IssuesModule`.
* **Controller (`projects.controller.ts`)**: Applies `@Roles(UserRole.Admin, UserRole.Project_Manager)` on mutations.
* **Service (`projects.service.ts`)**: Enforces uppercase project keys, verifies lead existence, executes relational counts.
* **DTOs**: `CreateProjectDto`, `UpdateProjectDto`.

#### E. API Contracts

##### 1. `GET /api/projects`
* **Purpose**: List projects with lead details and issue count telemetry.
* **Auth Requirement**: Yes.
* **Required Permission**: Any authenticated role.
* **Query Params**: `q?: string`, `status?: ProjectStatus`.
* **Success Response (`200 OK`)**: Array of `Project` objects with `lead` and `_count: { issues, sprints, epics }`.

##### 2. `GET /api/projects/:id`
* **Purpose**: Retrieve project cockpit details by ID or Project Key.
* **Auth Requirement**: Yes.
* **Required Permission**: Any authenticated role.
* **Success Response (`200 OK`)**: `Project` object with nested `lead`, `members`, `sprints`, `epics`.
* **Possible Errors**: `404 Not Found`.

##### 3. `POST /api/projects`
* **Purpose**: Create a new project repository.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Request Body**:
  ```json
  {
    "key": "DEV",
    "name": "Developer SDK",
    "description": "Public client libraries and API wrappers",
    "category": "Software",
    "leadId": "user-1",
    "memberIds": ["user-1", "user-3"]
  }
  ```
* **Success Response (`201 Created`)**: Created `Project` object.
* **Possible Errors**: `400 Bad Request`, `403 Forbidden`, `409 Conflict` (Project key already exists).

##### 4. `PATCH /api/projects/:id`
* **Purpose**: Update project metadata, lead, status, or member list.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Request Body**: Partial `Project` fields.
* **Success Response (`200 OK`)**: Updated `Project`.

##### 5. `DELETE /api/projects/:id`
* **Purpose**: Remove project repository.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`.
* **Success Response (`200 OK`)**: `{ "success": true }`.
* **Possible Errors**: `403 Forbidden`, `404 Not Found`.

#### F. Database Requirements
* **Model**: `Project`.
* **Fields**: `id` (CUID), `key` (unique, e.g. `INB`), `name`, `description`, `category`, `leadId` (FK -> `User`), `status`, `createdDate`.
* **Relations**: `lead` (User), `members` (User[] via `_ProjectMembers`), `issues` (Cascade), `sprints` (Cascade), `epics` (Cascade).
* **Indexes**: `@@index([key])`, `@@index([status])`.

#### G. Authorization Requirements
* Read: All authenticated roles.
* Create/Update: `Admin`, `Project Manager`.
* Delete: `Admin`.

#### H. Dependencies
* **Prerequisites**: `PrismaModule`, `UsersModule`.
* **Dependent Modules**: `IssuesModule`, `SprintsModule`, `EpicsModule`.

#### I. Business Rules
* Project `key` must be strictly uppercase alphanumeric (2 to 6 characters, e.g., `INB`, `CSP`).
* When creating a project, the `leadId` must automatically be included in `memberIds`.
* Deleting a project cascades deletion to its issues, sprints, and epics.

#### J. Error Handling
* Duplicate project key throws `409 Conflict`.
* Invalid `leadId` throws `400 Bad Request`.

#### K. Testing Requirements
* Unit test: Key normalization to uppercase.
* Integration test: Prevent duplicate project keys.

#### L. Completion Checklist
- [ ] Project key uniqueness enforced.
- [ ] Project lead automatically linked in members relation.
- [ ] Delete returns `200 OK` with `{ success: true }`.

---

### Module 5: IssuesModule (Core Ticketing & SLA Engine)

#### A. Module Overview
* **Module Name**: `IssuesModule`
* **Purpose**: Serves as the central ticketing, agile execution, and support escalation engine of the platform.
* **Business Responsibilities**: Powers `IssuesPage`, `IssueDetailPage`, `KanbanBoard`, `SupportCenterPage`, `Dashboard`, and `CreateIssueModal`. Generates sequential ticket IDs (e.g. `INB-1001`), computes SLA deadlines, executes support tier escalations (`L1` -> `L2` -> `L3`), and records audit events.
* **In-Scope Functionality**:
  - `GET /api/issues` (Multi-facet filtering, full-text search, support queue views).
  - `GET /api/issues/:id` (Full ticket view with comments, attachments, escalation history).
  - `POST /api/issues` (Create ticket with project key counter and SLA rule calculation).
  - `PATCH /api/issues/:id` (Update issue fields).
  - `PATCH /api/issues/:id/status` (Dedicated Kanban status transitions).
  - `POST /api/issues/:id/escalate` (Tier escalation workflow with reason and internal note).
  - `DELETE /api/issues/:id` (Delete issue).
* **Out-of-Scope Functionality**:
  - Standalone comment creation (delegated to `CommentsModule`).
  - Physical file binary storage (delegated to `AttachmentsModule`).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.3 and `docs/01_SYSTEM_ARCHITECTURE.md` Section 13/17).

#### C. Folder Structure
```text
backend/src/modules/issues/
├── [PROPOSED] issues.module.ts
├── [PROPOSED] issues.controller.ts
├── [PROPOSED] issues.service.ts
└── dto/
    ├── [PROPOSED] create-issue.dto.ts
    ├── [PROPOSED] update-issue.dto.ts
    ├── [PROPOSED] update-status.dto.ts
    ├── [PROPOSED] escalate-issue.dto.ts
    └── [PROPOSED] query-issues.dto.ts
```

#### D. Components and Responsibilities
* **Module (`issues.module.ts`)**: Imports `PrismaModule`, `NotificationsModule`, `ActivityModule`. Exports `IssuesService`.
* **Controller (`issues.controller.ts`)**: Exposes ticket CRUD, status transitions, and escalation endpoints.
* **Service (`issues.service.ts`)**:
  - Calculates SLA hours based on priority and tier.
  - Generates atomic sequential IDs (`<KEY>-<COUNTER>`).
  - Executes atomic escalation transactions via `prisma.$transaction`.
* **DTOs**: `CreateIssueDto`, `UpdateIssueDto`, `UpdateStatusDto`, `EscalateIssueDto`, `QueryIssuesDto`.

#### E. API Contracts

##### 1. `GET /api/issues`
* **Purpose**: List issues with filtering, pagination, and sorting.
* **Auth Requirement**: Yes.
* **Required Permission**: Any authenticated role.
* **Query Params**:
  - `q?: string` (search ticket title, description, ID, labels)
  - `status?: IssueStatus`
  - `priority?: Priority`
  - `supportLevel?: SupportLevel` (`L1`, `L2`, `L3`)
  - `assigneeId?: string` (`unassigned`, specific ID, or omitted)
  - `projectId?: string`
  - `sprintId?: string` (or `backlog` for issues where `sprintId === null`)
  - `isEscalated?: boolean`
  - `take?: number` (default 50), `skip?: number` (default 0)
* **Success Response (`200 OK`)**: Array of `Issue` objects with relations (`assignee`, `project`, `sprint`).

##### 2. `GET /api/issues/:id`
* **Purpose**: Retrieve single issue details.
* **Auth Requirement**: Yes.
* **Success Response (`200 OK`)**: Full `Issue` with `comments`, `attachments`, `escalationHistory`, `assignee`, `reporter`.
* **Possible Errors**: `404 Not Found`.

##### 3. `POST /api/issues`
* **Purpose**: Create ticket with automatic ID and SLA calculation.
* **Auth Requirement**: Yes.
* **Required Permission**: Any authenticated role.
* **Request Body**:
  ```json
  {
    "projectId": "proj-1",
    "title": "Payment gateway timeout on checkout",
    "description": "Customer unable to pay via credit card",
    "type": "Bug",
    "priority": "High",
    "supportLevel": "L1",
    "assigneeId": "user-2",
    "sprintId": "sprint-4",
    "epicId": "epic-2",
    "labels": ["payment", "checkout"],
    "dueDate": "2026-10-15T18:00:00Z",
    "storyPoints": 5,
    "estimatedTime": "4h"
  }
  ```
* **Success Response (`201 Created`)**: Created `Issue` object.
* **Possible Errors**: `400 Bad Request`, `404 Not Found` (invalid project or user ID).

##### 4. `PATCH /api/issues/:id`
* **Purpose**: Partial update of ticket fields.
* **Auth Requirement**: Yes.
* **Request Body**: Partial `Issue` fields.
* **Success Response (`200 OK`)**: Updated `Issue`.

##### 5. `PATCH /api/issues/:id/status`
* **Purpose**: Dedicated status transition for Kanban drag-and-drop.
* **Auth Requirement**: Yes.
* **Request Body**: `{ "status": "In Progress" }`.
* **Success Response (`200 OK`)**: Updated `Issue`.

##### 6. `POST /api/issues/:id/escalate`
* **Purpose**: Escalate support tier (`L1 -> L2` or `L2 -> L3`), create escalation record, and post internal note.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Support Agent`, `Technical`, `Engineer`, `Project Manager`.
* **Request Body**:
  ```json
  {
    "toLevel": "L2",
    "reason": "Stripe API returns non-standard error payload.",
    "assignedToUserId": "user-3"
  }
  ```
* **Success Response (`200 OK`)**: Updated `Issue` with escalation record and comment included.
* **Possible Errors**: `400 Bad Request` (invalid tier transition), `404 Not Found`.

##### 7. `DELETE /api/issues/:id`
* **Purpose**: Remove issue.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Success Response (`200 OK`)**: `{ "success": true, "id": "INB-1002" }`.

#### F. Database Requirements
* **Model**: `Issue`.
* **Fields**: `id` (e.g. `INB-1001`), `title`, `description`, `type`, `status`, `priority`, `supportLevel`, `assigneeId`, `reporterId`, `projectId`, `sprintId`, `epicId`, `labels`, `dueDate`, `storyPoints`, `estimatedTime`, `remainingTime`, `responseSLAHours`, `resolutionSLAHours`, `firstRespondedAt`, `resolvedAt`, `isEscalated`.
* **Relations**: `project` (Cascade), `assignee` (SetNull), `reporter`, `sprint` (SetNull), `epic` (SetNull), `comments` (Cascade), `attachments` (Cascade), `escalationHistory` (Cascade), `activities` (Cascade).
* **Indexes**: `@@index([projectId, status])`, `@@index([supportLevel, status])`, `@@index([assigneeId])`, `@@index([priority])`, `@@index([createdDate])`, `@@index([isEscalated])`.

#### G. Authorization Requirements
* Read/Create/Update: All authenticated roles.
* Escalate: `Admin`, `Support Agent`, `Technical`, `Engineer`, `Project Manager`.
* Delete: `Admin`, `Project Manager`.

#### H. Dependencies
* **Prerequisites**: `PrismaModule`, `UsersModule`, `ProjectsModule`, `NotificationsModule`, `ActivityModule`.
* **Dependent Modules**: `CommentsModule`, `AttachmentsModule`, `SearchModule`, `ReportsModule`.

#### I. Business Rules
* **ID Generation**: Ticket ID must follow `<PROJECT_KEY>-<COUNTER>` (e.g., `INB-1001`). Must be incremented atomically.
* **SLA Calculation**: Default SLA rules based on priority:
  - `Highest`: 1h response, 4h resolution.
  - `High`: 2h response, 8h resolution.
  - `Medium`: 4h response, 24h resolution.
  - `Low`: 8h response, 48h resolution.
  - `Lowest`: 24h response, 72h resolution.
* **Escalation Rules**:
  - `fromLevel` cannot equal `toLevel`.
  - Upward transitions permitted: `L1` -> `L2`, `L2` -> `L3`, `L1` -> `L3`.
  - Downward transition is prohibited unless authorized by `Admin`.
  - Escalation requires a non-empty `reason`.
  - Automatically sets `isEscalated = true`.
* **Resolution Timestamps**: Setting status to `Resolved` or `Closed` sets `resolvedAt = now()` if not already set.

#### J. Error Handling
* Missing issue throws `404 Not Found`.
* Invalid tier transition throws `400 Bad Request`.
* Delete returns `200 OK` with confirmation JSON.

#### K. Testing Requirements
* Unit test: Sequential ID generation formatting.
* Unit test: SLA hours calculation logic by priority.
* Unit test: Atomic escalation transaction execution.
* Integration test: `POST /api/issues/:id/escalate` creates `EscalationRecord`, internal `Comment`, and `ActivityEvent`.

#### L. Completion Checklist
- [ ] Multi-table escalation executes in a single `prisma.$transaction`.
- [ ] Partial PostgreSQL SLA index applied in database migrations.
- [ ] Delete returns `200 OK` with JSON payload.
- [ ] SLA deadlines calculate accurately from settings or defaults.

---

### Module 6: CommentsModule

#### A. Module Overview
* **Module Name**: `CommentsModule`
* **Purpose**: Manages public comments and internal technical notes on issues.
* **Business Responsibilities**: Powers discussion feeds on `IssueDetailPage`, supports internal team escalation notes, and captures audit events for communication.
* **In-Scope Functionality**:
  - `POST /api/issues/:id/comments` (Add public or internal comment).
  - `PATCH /api/comments/:commentId` (Author or Admin edits comment).
  - `DELETE /api/comments/:commentId` (Author or Admin deletes comment).
* **Out-of-Scope Functionality**:
  - Direct ticket mutations (delegated to `IssuesModule`).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.4 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/comments/
├── [PROPOSED] comments.module.ts
├── [PROPOSED] comments.controller.ts
├── [PROPOSED] comments.service.ts
└── dto/
    ├── [PROPOSED] create-comment.dto.ts
    └── [PROPOSED] update-comment.dto.ts
```

#### D. Components and Responsibilities
* **Module (`comments.module.ts`)**: Declares `CommentsController`, `CommentsService`. Imports `PrismaModule`, `ActivityModule`, `NotificationsModule`.
* **Controller (`comments.controller.ts`)**: Routes issue sub-resource comments and top-level comment actions.
* **Service (`comments.service.ts`)**: Validates author permissions, persists comment, records `ActivityEvent`, and triggers notifications for ticket assignee.
* **DTOs**: `CreateCommentDto`, `UpdateCommentDto`.

#### E. API Contracts

##### 1. `POST /api/issues/:id/comments`
* **Purpose**: Post public response or internal note.
* **Auth Requirement**: Yes.
* **Request Body**:
  ```json
  {
    "content": "Investigating logs in CloudWatch.",
    "type": "internal"
  }
  ```
* **Success Response (`201 Created`)**: Created `Comment` with author relation.
* **Possible Errors**: `400 Bad Request`, `404 Not Found`.

##### 2. `PATCH /api/comments/:commentId`
* **Purpose**: Edit comment content.
* **Auth Requirement**: Yes.
* **Required Permission**: Original author or `Admin`.
* **Request Body**: `{ "content": "Updated investigation notes." }`.
* **Success Response (`200 OK`)**: Updated `Comment`.
* **Possible Errors**: `403 Forbidden`, `404 Not Found`.

##### 3. `DELETE /api/comments/:commentId`
* **Purpose**: Remove comment.
* **Auth Requirement**: Yes.
* **Required Permission**: Original author or `Admin`.
* **Success Response (`200 OK`)**: `{ "success": true }`.
* **Possible Errors**: `403 Forbidden`, `404 Not Found`.

#### F. Database Requirements
* **Model**: `Comment`.
* **Fields**: `id` (CUID), `issueId` (FK -> `Issue`), `authorId` (FK -> `User`), `content`, `type` (`public` | `internal`), `createdAt`, `updatedAt`.
* **Indexes**: `@@index([issueId, type])`.

#### G. Authorization Requirements
* Create: Any authenticated user.
* Edit/Delete: Original author (`authorId === user.id`) or `Admin`.

#### H. Dependencies
* **Prerequisites**: `PrismaModule`, `UsersModule`, `IssuesModule`.
* **Dependent Modules**: None.

#### I. Business Rules
* Comment content must not be blank (minimum 1 character).
* Internal notes (`type === 'internal'`) must only be visible to internal support/engineering roles (`Support Agent`, `Technical`, `Engineer`, `Developer`, `Admin`, `Project Manager`).

#### J. Error Handling
* Non-author attempting to edit/delete throws `403 Forbidden`.

#### K. Testing Requirements
* Unit test: Non-author cannot edit comment.
* Integration test: Creating comment logs `ActivityEvent`.

#### L. Completion Checklist
- [ ] Author authorization strictly enforced on edit/delete.
- [ ] Internal comment filtering implemented.
- [ ] Delete returns `200 OK` with `{ success: true }`.

---

### Module 7: AttachmentsModule

#### A. Module Overview
* **Module Name**: `AttachmentsModule`
* **Purpose**: Manages file attachments associated with tickets.
* **Business Responsibilities**: Powers file attachments on `IssueDetailPage`. Stores file metadata and defines the storage integration boundary.
* **In-Scope Functionality**:
  - `POST /api/issues/:id/attachments` (Register attachment metadata / upload file).
  - `DELETE /api/issues/:id/attachments/:attachmentId` (Delete attachment).
* **Out-of-Scope Functionality**:
  - Cloud storage integration (S3/GCS presigned URLs marked as future production enhancement).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.5 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/attachments/
├── [PROPOSED] attachments.module.ts
├── [PROPOSED] attachments.controller.ts
├── [PROPOSED] attachments.service.ts
└── dto/
    └── [PROPOSED] create-attachment.dto.ts
```

#### D. Components and Responsibilities
* **Module (`attachments.module.ts`)**: Configures `AttachmentsController`, `AttachmentsService`.
* **Controller (`attachments.controller.ts`)**: Handles attachment registration and removal.
* **Service (`attachments.service.ts`)**: Records attachment metadata, manages disk/storage boundary, logs `ActivityEvent`.
* **DTOs**: `CreateAttachmentDto` (`filename`, `fileType`, `fileSize`).

#### E. API Contracts

##### 1. `POST /api/issues/:id/attachments`
* **Purpose**: Register uploaded attachment metadata.
* **Auth Requirement**: Yes.
* **Request Body**:
  ```json
  {
    "filename": "traceback.log",
    "fileType": "text/plain",
    "fileSize": 14200
  }
  ```
* **Success Response (`201 Created`)**: Created `Attachment` object.

##### 2. `DELETE /api/issues/:id/attachments/:attachmentId`
* **Purpose**: Remove attachment record.
* **Auth Requirement**: Yes.
* **Success Response (`200 OK`)**: `{ "success": true }`.

#### F. Database Requirements
* **Model**: `Attachment`.
* **Fields**: `id` (CUID), `issueId` (FK -> `Issue`), `filename`, `fileType`, `fileSize`, `uploadDate`.
* **Indexes**: `@@index([issueId])`.

#### G. Authorization Requirements
* Any authenticated user with access to the issue may attach files. Deletion permitted by uploader or `Admin`.

#### H. Dependencies
* **Prerequisites**: `PrismaModule`, `IssuesModule`.

#### I. Business Rules
* Maximum upload size: 25MB.
* Disallowed extensions: `.exe`, `.bat`, `.cmd`, `.sh`.

#### J. Error Handling
* Target issue not found throws `404 Not Found`.

#### K. Testing Requirements
* Unit test: File size limit validation.
* Unit test: Disallowed file extension rejection.

#### L. Completion Checklist
- [ ] Validates file metadata constraints.
- [ ] Attachment removal unlinks file and returns `200 OK`.

---

### Module 8: SprintsModule

#### A. Module Overview
* **Module Name**: `SprintsModule`
* **Purpose**: Manages Agile sprint planning, sprint activation, backlog issue management, and sprint closure ceremonies with unfinished ticket rollover.
* **Business Responsibilities**: Powers `BacklogPage` and `KanbanBoard` sprint filters. Enforces the single-active-sprint rule per project and coordinates ticket rollovers.
* **In-Scope Functionality**:
  - `GET /api/sprints` (List sprints by project).
  - `POST /api/sprints` (Create planned sprint).
  - `PATCH /api/sprints/:id` (Update sprint dates and goal).
  - `POST /api/sprints/:id/start` (Activate sprint).
  - `POST /api/sprints/:id/complete` (Finalize sprint and roll over unfinished issues).
  - `DELETE /api/sprints/:id` (Delete sprint and unassign issues to backlog).
* **Out-of-Scope Functionality**:
  - Issue estimation (story points stored on `Issue`, managed in `IssuesModule`).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.7 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/sprints/
├── [PROPOSED] sprints.module.ts
├── [PROPOSED] sprints.controller.ts
├── [PROPOSED] sprints.service.ts
└── dto/
    ├── [PROPOSED] create-sprint.dto.ts
    ├── [PROPOSED] update-sprint.dto.ts
    ├── [PROPOSED] complete-sprint.dto.ts
    └── [PROPOSED] query-sprints.dto.ts
```

#### D. Components and Responsibilities
* **Module (`sprints.module.ts`)**: Declares `SprintsController`, `SprintsService`. Imports `PrismaModule`, `ActivityModule`.
* **Controller (`sprints.controller.ts`)**: Routes sprint lifecycle actions. Uses `@HttpCode(HttpStatus.OK)` on `/start` and `/complete`.
* **Service (`sprints.service.ts`)**: Enforces single-active-sprint constraint and executes transactional ticket rollover.
* **DTOs**: `CreateSprintDto`, `UpdateSprintDto`, `CompleteSprintDto`.

#### E. API Contracts

##### 1. `GET /api/sprints`
* **Purpose**: List sprints for a project.
* **Auth Requirement**: Yes.
* **Query Params**: `projectId: string`.
* **Success Response (`200 OK`)**: Array of `Sprint` objects with issue counts.

##### 2. `POST /api/sprints`
* **Purpose**: Create a new planned sprint.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Request Body**:
  ```json
  {
    "projectId": "proj-1",
    "name": "Sprint 6",
    "goal": "Zero high-priority checkout bugs",
    "startDate": "2026-10-10T00:00:00Z",
    "endDate": "2026-10-24T00:00:00Z"
  }
  ```
* **Success Response (`201 Created`)**: Created `Sprint`.

##### 3. `POST /api/sprints/:id/start`
* **Purpose**: Start a planned sprint.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Success Response (`200 OK`)**: Updated `Sprint` (`status: 'active'`).
* **Possible Errors**: `400 Bad Request` (another sprint is already active in this project).

##### 4. `POST /api/sprints/:id/complete`
* **Purpose**: Complete sprint and roll over unresolved tickets.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Request Body**: `{ "targetSprintId"?: "sprint-5" }` (if omitted, moves tickets to backlog `null`).
* **Success Response (`200 OK`)**:
  ```json
  {
    "sprint": { "id": "sprint-4", "status": "completed", "completedDate": "2026-10-12T10:00:00Z" },
    "rolledOverCount": 3
  }
  ```

##### 5. `DELETE /api/sprints/:id`
* **Purpose**: Delete sprint. Unassigns all attached issues to backlog (`sprintId = null`).
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Success Response (`200 OK`)**: `{ "success": true }`.

#### F. Database Requirements
* **Model**: `Sprint`.
* **Fields**: `id` (CUID), `projectId` (FK -> `Project`), `name`, `startDate`, `endDate`, `status` (`planned`, `active`, `completed`), `goal`, `completedDate`.
* **Indexes**: `@@index([projectId, status])`.

#### G. Authorization Requirements
* Read: All authenticated roles.
* Create/Start/Complete/Delete: `Admin`, `Project Manager`.

#### H. Dependencies
* **Prerequisites**: `PrismaModule`, `ProjectsModule`.
* **Dependent Modules**: `IssuesModule`.

#### I. Business Rules
* Only one sprint can be `active` per project at any given time.
* Cannot start a sprint that is already `completed`.
* Completing a sprint identifies all attached issues where `status NOT IN ('Resolved', 'Closed')` and reassigns their `sprintId` to `targetSprintId` (or `null`).
* Sprint start and complete must return `200 OK`.

#### J. Error Handling
* Attempting to start a sprint when another active sprint exists throws `400 Bad Request`.

#### K. Testing Requirements
* Unit test: Enforce single active sprint validation.
* Unit test: Sprint completion moves unfinished issues and leaves resolved issues in completed sprint.

#### L. Completion Checklist
- [ ] Single active sprint rule enforced per project.
- [ ] Unfinished issue rollover executes inside `prisma.$transaction`.
- [ ] Action endpoints return `200 OK`.

---

### Module 9: EpicsModule

#### A. Module Overview
* **Module Name**: `EpicsModule`
* **Purpose**: Manages high-level agile epics, roadmap initiatives, and feature groups.
* **Business Responsibilities**: Powers epic planning in `ProjectDetailPage`, `BacklogPage`, and epic tagging in `CreateIssueModal`.
* **In-Scope Functionality**:
  - `GET /api/epics` (List epics by project).
  - `POST /api/epics` (Create epic).
  - `PATCH /api/epics/:id` (Update epic details or status).
  - `DELETE /api/epics/:id` (Delete epic and unassign linked issues).
* **Out-of-Scope Functionality**:
  - Direct ticket execution (managed in `IssuesModule`).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.8 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/epics/
├── [PROPOSED] epics.module.ts
├── [PROPOSED] epics.controller.ts
├── [PROPOSED] epics.service.ts
└── dto/
    ├── [PROPOSED] create-epic.dto.ts
    └── [PROPOSED] update-epic.dto.ts
```

#### D. Components and Responsibilities
* **Module (`epics.module.ts`)**: Configures `EpicsController`, `EpicsService`. Imports `PrismaModule`.
* **Controller (`epics.controller.ts`)**: Routes epic CRUD operations.
* **Service (`epics.service.ts`)**: Manages `Epic` entities and validates project relationships.
* **DTOs**: `CreateEpicDto`, `UpdateEpicDto`.

#### E. API Contracts

##### 1. `GET /api/epics`
* **Purpose**: List epics (optional `?projectId=...`).
* **Auth Requirement**: Yes.
* **Success Response (`200 OK`)**: Array of `Epic` objects with issue count and completion metrics.

##### 2. `POST /api/epics`
* **Purpose**: Create epic.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Request Body**:
  ```json
  {
    "projectId": "proj-1",
    "name": "Authentication V2",
    "description": "Passkeys and WebAuthn support",
    "color": "#10b981",
    "status": "To Do"
  }
  ```
* **Success Response (`201 Created`)**: Created `Epic`.

##### 3. `PATCH /api/epics/:id`
* **Purpose**: Update epic.
* **Auth Requirement**: Yes.
* **Success Response (`200 OK`)**: Updated `Epic`.

##### 4. `DELETE /api/epics/:id`
* **Purpose**: Delete epic. Unlinks issues (`epicId = null`).
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Success Response (`200 OK`)**: `{ "success": true }`.

#### F. Database Requirements
* **Model**: `Epic`.
* **Fields**: `id` (CUID), `projectId` (FK -> `Project`), `name`, `description`, `summary`, `color`, `status` (`To Do`, `In Progress`, `Done`), `dueDate`.
* **Indexes**: `@@index([projectId])`.

#### G. Authorization Requirements
* Read: All authenticated roles.
* Create/Update/Delete: `Admin`, `Project Manager`.

#### H. Dependencies
* **Prerequisites**: `PrismaModule`, `ProjectsModule`.
* **Dependent Modules**: `IssuesModule`.

#### I. Business Rules
* Deleting an epic must NOT delete its attached issues; it must set their `epicId = null`.

#### J. Error Handling
* Epic not found throws `404 Not Found`.

#### K. Testing Requirements
* Unit test: Deleting epic nullifies issue `epicId`.

#### L. Completion Checklist
- [ ] Epic creation assigns color and status properly.
- [ ] Deletion safely unlinks attached tickets.

---

### Module 10: NotificationsModule

#### A. Module Overview
* **Module Name**: `NotificationsModule`
* **Purpose**: Manages in-app user notifications for ticket assignments, support escalations, comments, and sprint changes.
* **Business Responsibilities**: Powers `NotificationPanel` in top navigation bar, provides unread counts, and updates notification read statuses.
* **In-Scope Functionality**:
  - `GET /api/notifications` (Fetch notifications for current user).
  - `PATCH /api/notifications/:id/read` (Mark single notification as read).
  - `POST /api/notifications/mark-all-read` (Mark all user notifications as read).
  - Exporting `NotificationsService.createNotification()` for cross-module calls.
* **Out-of-Scope Functionality**:
  - Real-time WebSocket delivery (future enhancement).
  - Outbound email delivery (SMTP).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.9 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/notifications/
├── [PROPOSED] notifications.module.ts
├── [PROPOSED] notifications.controller.ts
└── [PROPOSED] notifications.service.ts
```

#### D. Components and Responsibilities
* **Module (`notifications.module.ts`)**: Declares `NotificationsController`, `NotificationsService`. Exports `NotificationsService`.
* **Controller (`notifications.controller.ts`)**: Endpoints for current user notifications. Uses `@HttpCode(HttpStatus.OK)` on `/mark-all-read`.
* **Service (`notifications.service.ts`)**: Queries and updates `Notification` records; provides programmatic notification creation for other modules.

#### E. API Contracts

##### 1. `GET /api/notifications`
* **Purpose**: Fetch notifications for current authenticated user.
* **Auth Requirement**: Yes.
* **Success Response (`200 OK`)**: Array of `Notification` objects.

##### 2. `PATCH /api/notifications/:id/read`
* **Purpose**: Mark single notification as read.
* **Auth Requirement**: Yes.
* **Success Response (`200 OK`)**: Updated `Notification` (`read: true`).

##### 3. `POST /api/notifications/mark-all-read`
* **Purpose**: Mark all notifications for current user as read.
* **Auth Requirement**: Yes.
* **Success Response (`200 OK`)**: `{ "success": true }`.

#### F. Database Requirements
* **Model**: `Notification`.
* **Fields**: `id` (CUID), `userId` (FK -> `User`), `title`, `message`, `type` (`escalation`, `assignment`, `comment`, `status`, `sprint`, `system`), `issueId`, `read`, `createdAt`.
* **Indexes**: `@@index([userId, read])`.

#### G. Authorization Requirements
* Users can only access and modify their own notifications (`userId === currentUserId`).

#### H. Dependencies
* **Prerequisites**: `PrismaModule`, `UsersModule`.
* **Dependent Modules**: `IssuesModule`, `CommentsModule`.

#### I. Business Rules
* In-app notifications must be created within database transactions during ticket assignment or escalation.

#### J. Error Handling
* Attempting to mark another user's notification as read throws `403 Forbidden` or `404 Not Found`.

#### K. Testing Requirements
* Unit test: Notification isolation across user IDs.

#### L. Completion Checklist
- [ ] Users cannot read or modify other users' notifications.
- [ ] `mark-all-read` returns `200 OK`.

---

### Module 11: ActivityModule (Audit Logs)

#### A. Module Overview
* **Module Name**: `ActivityModule`
* **Purpose**: Serves as the immutable system audit trail and telemetry ledger.
* **Business Responsibilities**: Powers the Audit tab in `AdminPanelPage` and the History tab on `IssueDetailPage`.
* **In-Scope Functionality**:
  - `GET /api/activity` (Query activity records by issue, project, or user).
  - Exporting `ActivityService.logEvent()` for programmatic recording.
* **Out-of-Scope Functionality**:
  - Updating or deleting activity records (strictly append-only).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.11 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/activity/
├── [PROPOSED] activity.module.ts
├── [PROPOSED] activity.controller.ts
└── [PROPOSED] activity.service.ts
```

#### D. Components and Responsibilities
* **Module (`activity.module.ts`)**: Exports `ActivityService` globally or to domain modules.
* **Controller (`activity.controller.ts`)**: Exposes `GET /api/activity`.
* **Service (`activity.service.ts`)**: Records and queries immutable `ActivityEvent` records.

#### E. API Contracts

##### 1. `GET /api/activity`
* **Purpose**: Retrieve audit log stream.
* **Auth Requirement**: Yes.
* **Query Params**: `issueId?: string`, `projectId?: string`, `userId?: string`, `limit?: number`.
* **Success Response (`200 OK`)**: Array of `ActivityEvent` objects with `user` relation.

#### F. Database Requirements
* **Model**: `ActivityEvent`.
* **Fields**: `id` (CUID), `issueId` (optional), `projectId` (optional), `userId` (FK -> `User`), `action`, `details`, `timestamp`.
* **Indexes**: `@@index([issueId])`, `@@index([projectId])`, `@@index([timestamp])`.

#### G. Authorization Requirements
* Read: Authenticated users (Audit tab restricted to `Admin` in frontend).

#### H. Dependencies
* **Prerequisites**: `PrismaModule`, `UsersModule`.
* **Dependent Modules**: `IssuesModule`, `CommentsModule`, `ProjectsModule`, `SprintsModule`.

#### I. Business Rules
* Append-only ledger: No update or delete endpoints exist.

#### J. Error Handling
* Validates query parameter limits (default 50, maximum 100).

#### K. Testing Requirements
* Unit test: Verify immutable record creation.

#### L. Completion Checklist
- [ ] No `PATCH` or `DELETE` endpoints exposed.
- [ ] Queries performant via composite indexes.

---

### Module 12: SavedFiltersModule

#### A. Module Overview
* **Module Name**: `SavedFiltersModule`
* **Purpose**: Manages personalized, saved search and filter presets for ticket repository exploration.
* **Business Responsibilities**: Powers saved filter tabs on `IssuesPage`.
* **In-Scope Functionality**:
  - `GET /api/saved-filters` (List current user's saved filters).
  - `POST /api/saved-filters` (Save custom filter preset).
  - `DELETE /api/saved-filters/:id` (Delete saved filter preset).
* **Out-of-Scope Functionality**:
  - Executing issue queries (delegated to `IssuesModule`).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.10 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/saved-filters/
├── [PROPOSED] saved-filters.module.ts
├── [PROPOSED] saved-filters.controller.ts
├── [PROPOSED] saved-filters.service.ts
└── dto/
    └── [PROPOSED] create-filter.dto.ts
```

#### D. Components and Responsibilities
* **Module (`saved-filters.module.ts`)**: Configures controller and service.
* **Controller (`saved-filters.controller.ts`)**: Routes filter preset CRUD.
* **Service (`saved-filters.service.ts`)**: Persists JSON filter parameters linked to user.
* **DTOs**: `CreateFilterDto` (`name`, `filters`).

#### E. API Contracts

##### 1. `GET /api/saved-filters`
* **Purpose**: List saved filters for current user.
* **Auth Requirement**: Yes.
* **Success Response (`200 OK`)**: Array of `SavedFilter` objects.

##### 2. `POST /api/saved-filters`
* **Purpose**: Save custom filter preset.
* **Auth Requirement**: Yes.
* **Request Body**:
  ```json
  {
    "name": "Critical L3 Escalations",
    "filters": { "supportLevel": "L3", "priority": "Highest" }
  }
  ```
* **Success Response (`201 Created`)**: Created `SavedFilter`.

##### 3. `DELETE /api/saved-filters/:id`
* **Purpose**: Delete filter preset.
* **Auth Requirement**: Yes.
* **Success Response (`200 OK`)**: `{ "success": true }`.

#### F. Database Requirements
* **Model**: `SavedFilter`.
* **Fields**: `id` (CUID), `userId` (FK -> `User`), `name`, `filters` (JSON).
* **Indexes**: `@@index([userId])`.

#### G. Authorization Requirements
* Users can only access and delete their own saved filters.

#### H. Dependencies
* **Prerequisites**: `PrismaModule`, `UsersModule`.

#### I. Business Rules
* Presets must contain a valid name (1-50 characters).

#### J. Error Handling
* Deleting another user's filter throws `403 Forbidden` or `404 Not Found`.

#### K. Testing Requirements
* Unit test: Filter ownership isolation.

#### L. Completion Checklist
- [ ] User filter isolation verified.
- [ ] Delete returns `200 OK` with `{ success: true }`.

---

### Module 13: SettingsModule

#### A. Module Overview
* **Module Name**: `SettingsModule`
* **Purpose**: Manages workspace configuration, SLA policy hours, dynamic role-to-page permission matrices, and system branding.
* **Business Responsibilities**: Powers `SettingsPage`, `AdminPanelPage` (Permissions & SLA tabs), and initializes frontend route access policies.
* **In-Scope Functionality**:
  - `GET /api/settings` (Retrieve singleton settings object).
  - `PATCH /api/settings` (Update SLA thresholds, role permissions, or branding).
* **Out-of-Scope Functionality**:
  - Physical database backup/restore (delegated to `SystemModule`).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.12 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/settings/
├── [PROPOSED] settings.module.ts
├── [PROPOSED] settings.controller.ts
├── [PROPOSED] settings.service.ts
└── dto/
    └── [PROPOSED] update-settings.dto.ts
```

#### D. Components and Responsibilities
* **Module (`settings.module.ts`)**: Declares controller and service. Exports `SettingsService` for SLA calculations in `IssuesModule`.
* **Controller (`settings.controller.ts`)**: Applies `@Roles(UserRole.Admin, UserRole.Project_Manager)` on updates.
* **Service (`settings.service.ts`)**: Retrieves or creates singleton settings record (`id = "singleton"`).
* **DTOs**: `UpdateSettingsDto`.

#### E. API Contracts

##### 1. `GET /api/settings`
* **Purpose**: Retrieve workspace configuration and SLA policies.
* **Auth Requirement**: Yes.
* **Success Response (`200 OK`)**: `Settings` object.

##### 2. `PATCH /api/settings`
* **Purpose**: Update workspace configuration, SLA policies, or RBAC permissions matrix.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`.
* **Request Body**: Partial `Settings` object (`slaSettings`, `rolePageAccess`, etc.).
* **Success Response (`200 OK`)**: Updated `Settings`.

#### F. Database Requirements
* **Model**: `Settings`.
* **Fields**: `id` (default `"singleton"`), `appName`, `tagline`, `workspaceName`, `theme`, `notificationsEnabled`, `slaSettings` (JSON), `notifications` (JSON), `preferences` (JSON), `slaRules` (JSON), `rolePageAccess` (JSON), `updatedAt`.

#### G. Authorization Requirements
* Read: All authenticated users.
* Update: `Admin`, `Project Manager`.

#### H. Dependencies
* **Prerequisites**: `PrismaModule`.
* **Dependent Modules**: `IssuesModule` (for SLA policy lookup).

#### I. Business Rules
* Singleton pattern: Exactly one settings row exists with `id = "singleton"`.
* SLA response and resolution hours must be strictly positive numbers.

#### J. Error Handling
* Negative SLA hours rejected by DTO validation (`@Min(0.1)`).

#### K. Testing Requirements
* Unit test: Singleton initialization if record does not exist.

#### L. Completion Checklist
- [ ] Auto-creates singleton row if absent on boot.
- [ ] Dynamic RBAC permissions matrix persisted properly.

---

### Module 14: SearchModule

#### A. Module Overview
* **Module Name**: `SearchModule`
* **Purpose**: Provides cross-entity global search across tickets, projects, and epics.
* **Business Responsibilities**: Powers `GlobalSearchModal` (triggered via Cmd+K or search bar).
* **In-Scope Functionality**:
  - `GET /api/search?q=...` (Multi-entity search across issues, projects, epics).
* **Out-of-Scope Functionality**:
  - Full-text search engine integration (Elasticsearch/Meilisearch marked as future enhancement).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.13 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/search/
├── [PROPOSED] search.module.ts
├── [PROPOSED] search.controller.ts
└── [PROPOSED] search.service.ts
```

#### D. Components and Responsibilities
* **Module (`search.module.ts`)**: Declares controller and service. Imports `PrismaModule`.
* **Controller (`search.controller.ts`)**: Exposes `GET /api/search`.
* **Service (`search.service.ts`)**: Executes parallel database queries (`Promise.all`) across `Issue`, `Project`, and `Epic` with case-insensitive matching.

#### E. API Contracts

##### 1. `GET /api/search`
* **Purpose**: Multi-entity global search query.
* **Auth Requirement**: Yes.
* **Query Params**: `q: string` (minimum 2 characters).
* **Success Response (`200 OK`)**:
  ```json
  {
    "issues": [ { "id": "INB-1002", "title": "Stripe timeout", "status": "In Progress" } ],
    "projects": [ { "id": "proj-1", "name": "Inbox Core", "key": "INB" } ],
    "epics": [ { "id": "epic-1", "name": "Payment Modernization" } ]
  }
  ```

#### F. Database Requirements
* Queries `Issue`, `Project`, `Epic` tables using `mode: 'insensitive'`.

#### G. Authorization Requirements
* Any authenticated user.

#### H. Dependencies
* **Prerequisites**: `PrismaModule`.

#### I. Business Rules
* Search query must have at least 2 characters; otherwise return empty arrays.
* Results capped at top 10 items per entity type.

#### J. Error Handling
* Query string shorter than 2 characters returns `{ issues: [], projects: [], epics: [] }`.

#### K. Testing Requirements
* Unit test: Case-insensitive search matching across all three entities.

#### L. Completion Checklist
- [ ] Queries run concurrently via `Promise.all`.
- [ ] Returns structured multi-entity payload.

---

### Module 15: SystemModule

#### A. Module Overview
* **Module Name**: `SystemModule`
* **Purpose**: Provides administrative database governance, backup exports, backup restorations, and seed data resets.
* **Business Responsibilities**: Powers the System tab in `AdminPanelPage` and `SettingsPage`.
* **In-Scope Functionality**:
  - `GET /api/system/export` (Complete JSON snapshot of all database tables).
  - `POST /api/system/import` (Restore full JSON backup).
  - `POST /api/system/reset` (Reset database to initial seed data).
* **Out-of-Scope Functionality**:
  - Automated cloud backup scheduling (infrastructure-level responsibility).

#### B. Implementation Status
* **Classification**: **Not implemented** (Fully specified in `BACKEND_ARCHITECTURE.md` Phase 8.14 and `docs/01_SYSTEM_ARCHITECTURE.md`).

#### C. Folder Structure
```text
backend/src/modules/system/
├── [PROPOSED] system.module.ts
├── [PROPOSED] system.controller.ts
└── [PROPOSED] system.service.ts
```

#### D. Components and Responsibilities
* **Module (`system.module.ts`)**: Declares controller and service. Imports `PrismaModule`.
* **Controller (`system.controller.ts`)**: Applies `@Roles(UserRole.Admin)` to all routes. Uses `@HttpCode(HttpStatus.OK)` on `/import` and `/reset`.
* **Service (`system.service.ts`)**: Reads all models for export; executes atomic transaction for import and reset.

#### E. API Contracts

##### 1. `GET /api/system/export`
* **Purpose**: Generate complete JSON database snapshot.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`.
* **Success Response (`200 OK`)**: Complete JSON backup object containing all tables.

##### 2. `POST /api/system/import`
* **Purpose**: Restore database from JSON backup.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`.
* **Request Body**: Full JSON export object.
* **Success Response (`200 OK`)**: `{ "success": true, "message": "Database restored successfully." }`.

##### 3. `POST /api/system/reset`
* **Purpose**: Reset database to factory seed data.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`.
* **Success Response (`200 OK`)**: `{ "success": true }`.

#### F. Database Requirements
* Accesses all Prisma models in order of foreign key hierarchy to prevent constraint violations during truncation and insertion.

#### G. Authorization Requirements
* Strictly restricted to `Admin` role.

#### H. Dependencies
* **Prerequisites**: `PrismaModule`.

#### I. Business Rules
* Import and Reset must execute within an atomic transaction.
* Reset re-seeds users with properly bcrypt-hashed passwords.

#### J. Error Handling
* Non-admin callers receive `403 Forbidden`.
* Malformed import JSON throws `400 Bad Request`.

#### K. Testing Requirements
* Integration test: Non-admin calling `/export` or `/reset` is rejected with `403`.
* Integration test: Database reset re-seeds default admin user.

#### L. Completion Checklist
- [ ] Strict `Admin` role guard enforcement.
- [ ] Action endpoints return `200 OK`.
- [ ] Reset maintains referential integrity.

---

### Module 16: ReportsModule [PROPOSED]

#### A. Module Overview
* **Module Name**: `ReportsModule` [PROPOSED]
* **Purpose**: Provides server-side aggregated SLA compliance metrics, breach analytics, support tier distributions, and team throughput velocity.
* **Business Responsibilities**: Offloads heavy statistical calculations from the frontend `ReportsPage` and `Dashboard`, replacing client-side loops over raw tickets with optimized PostgreSQL aggregated queries.
* **In-Scope Functionality**:
  - `GET /api/reports/sla-compliance` (Total tickets, breached count, at-risk count, compliance percentage).
  - `GET /api/reports/tier-distribution` (Ticket volume and escalation breakdown by L1, L2, L3).
  - `GET /api/reports/velocity` (Created vs resolved ticket throughput over time).
* **Out-of-Scope Functionality**:
  - Exporting Excel / PDF files (future enhancement).

#### B. Implementation Status
* **Classification**: **Proposed** (In the current frontend, metrics are calculated client-side in `ReportsPage.tsx` using `calculateSLAInfo()`. This module is proposed as an enterprise optimization).

#### C. Folder Structure
```text
backend/src/modules/reports/
├── [PROPOSED] reports.module.ts
├── [PROPOSED] reports.controller.ts
├── [PROPOSED] reports.service.ts
└── dto/
    └── [PROPOSED] query-reports.dto.ts
```

#### D. Components and Responsibilities
* **Module (`reports.module.ts`)**: Declares `ReportsController`, `ReportsService`. Imports `PrismaModule`.
* **Controller (`reports.controller.ts`)**: Exposes report query endpoints. Applies `@Roles(UserRole.Admin, UserRole.Project_Manager, UserRole.QA, UserRole.Engineer)`.
* **Service (`reports.service.ts`)**: Executes optimized PostgreSQL aggregations and utilizes partial SLA indexes.
* **DTOs**: `QueryReportsDto` (`projectId?: string`, `startDate?: string`, `endDate?: string`).

#### E. API Contracts [PROPOSED]

##### 1. `GET /api/reports/sla-compliance` [PROPOSED]
* **Purpose**: Retrieve aggregate SLA compliance statistics.
* **Auth Requirement**: Yes.
* **Required Permission**: `Admin`, `Project Manager`, `QA`, `Engineer`.
* **Query Params**: `projectId?: string`, `timeframe?: '7d' | '30d' | 'all'`.
* **Success Response (`200 OK`)**:
  ```json
  {
    "total": 142,
    "breached": 8,
    "atRisk": 14,
    "withinSLA": 120,
    "escalated": 18,
    "complianceRate": 94
  }
  ```

##### 2. `GET /api/reports/tier-distribution` [PROPOSED]
* **Purpose**: Retrieve escalation distribution across support levels.
* **Auth Requirement**: Yes.
* **Success Response (`200 OK`)**:
  ```json
  [
    { "tier": "L1", "name": "L1 Frontline", "count": 68, "escalatedCount": 12 },
    { "tier": "L2", "name": "L2 Technical", "count": 45, "escalatedCount": 6 },
    { "tier": "L3", "name": "L3 Engineering", "count": 29, "escalatedCount": 0 }
  ]
  ```

#### F. Database Requirements
* Leverages PostgreSQL partial index on `Issue("createdDate", "priority", "supportLevel") WHERE "status" NOT IN ('Resolved', 'Closed')`.

#### G. Authorization Requirements
* `Admin`, `Project Manager`, `QA`, `Engineer` (matching `PAGE_DEFINITIONS` for `reports` in `rbac.ts`).

#### H. Dependencies
* **Prerequisites**: `PrismaModule`, `IssuesModule`.

#### I. Business Rules
* Compliance rate formula: `round(((total - breached) / total) * 100)`. If total is 0, return 100.

#### J. Error Handling
* Invalid date ranges throw `400 Bad Request`.

#### K. Testing Requirements
* Unit test: Compliance rate calculation with zero total tickets.

#### L. Completion Checklist
- [ ] Aggregation queries execute in < 50ms using indexes.
- [ ] Response matches frontend `ReportsPage` chart requirements.

---

## 5. Module Dependency Architecture and Matrix

### 5.1 Comprehensive Dependency Matrix
The following matrix details the upstream and downstream dependencies for each backend module. A module in a row depends on the module in a column marked with `X`:

| Module | Prisma | Users | Auth | Projects | Issues | Comments | Sprints | Epics | Activity | Notif | Settings |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1. PrismaModule** | — | | | | | | | | | | |
| **2. AuthModule** | X | X | — | | | | | | | | |
| **3. UsersModule** | X | — | | | | | | | | | |
| **4. ProjectsModule** | X | X | | — | | | | | | | |
| **5. IssuesModule** | X | X | | X | — | | X | X | X | X | X |
| **6. CommentsModule** | X | X | | | X | — | | | X | X | |
| **7. AttachmentsModule** | X | | | | X | | | | X | | |
| **8. SprintsModule** | X | | | X | | | — | | X | | |
| **9. EpicsModule** | X | | | X | | | | — | | | |
| **10. NotificationsModule** | X | X | | | | | | | | — | |
| **11. ActivityModule** | X | X | | | | | | | — | | |
| **12. SavedFiltersModule** | X | X | | | | | | | | | |
| **13. SettingsModule** | X | | | | | | | | | | — |
| **14. SearchModule** | X | | | X | X | | | X | | | |
| **15. SystemModule** | X | | | | | | | | | | |
| **16. ReportsModule [PROPOSED]**| X | | | X | X | | | | | | |

### 5.2 Architectural Tiers
Modules are categorized into four structural tiers:

1. **Tier 0: Infrastructure Foundation**
   - `PrismaModule`: Database connectivity and connection pooling. Must be initialized first.
2. **Tier 1: Identity & Organizational Core**
   - `UsersModule`, `AuthModule`, `ProjectsModule`, `SettingsModule`.
   - Establishes authenticated sessions, team rosters, project keys, and SLA configurations.
3. **Tier 2: Ticketing, Agile & Communication Engine**
   - `ActivityModule`, `NotificationsModule`, `IssuesModule`, `SprintsModule`, `EpicsModule`.
   - Central ticketing, support escalation, sprint ceremonies, and audit telemetry.
4. **Tier 3: Auxiliary & Governance Features**
   - `CommentsModule`, `AttachmentsModule`, `SavedFiltersModule`, `SearchModule`, `SystemModule`, `ReportsModule` [PROPOSED].
   - Sub-resource management, saved views, full-text search, data backup, and reporting.

---

## 6. Parallel Development and Integration Rules

Because multiple engineers will build these modules independently on separate laptops without a shared filesystem, the team must strictly adhere to the following collaboration rules.

### 6.1 Developer Module Assignment and Ownership
1. **Module Lead Assignment**: Each backend module is assigned to a single designated Developer Lead who is responsible for its controller, service, DTOs, and unit tests.
2. **No Concurrent Edits in Module Folders**: Only the assigned developer may author or modify files within `backend/src/modules/<assigned-module>/`.
3. **Collaborative Review**: Dependent developers review code via Pull Requests rather than editing files directly.

### 6.2 Shared Files Across Modules
The following files are shared across all developers:
* `backend/prisma/schema.prisma` (Database schema).
* `backend/src/app.module.ts` (Root module registering domain modules).
* `backend/src/main.ts` (Bootstrap, global pipes, filters).
* `backend/src/common/` (Guards, decorators, filters, interceptors).
* `backend/package.json` (Project dependencies).

### 6.3 Single-Owner Files and Gatekeepers
To prevent merge conflicts and architectural drift:
* **Prisma Schema Gatekeeper**: The Backend Architect or designated Lead owns `prisma/schema.prisma`. Developers submit schema change proposals via pull requests; no developer may commit uncoordinated schema changes.
* **App Module Gatekeeper**: `backend/src/app.module.ts` registration is managed via clean alphabetical imports.

### 6.4 Prisma Schema and Migration Coordination Protocol
Distributed developers cannot run concurrent ad-hoc migrations without causing divergence in the `prisma/migrations/` timestamp history.
1. **Local Development**: When developing a module, developers run `npx prisma db push` against their local PostgreSQL database for rapid schema iteration.
2. **Official Migration Creation**: Official migrations (`npx prisma migrate dev --name <migration_name>`) are generated exclusively on designated feature branches after schema changes are approved.
3. **Zero Direct DB Changes**: No developer may alter local database tables using raw SQL consoles without updating `schema.prisma`.

### 6.5 Shared DTOs and API Contract Agreement Protocol
1. **Contract-First Development**: Before writing service logic, the developer must submit the DTO classes and controller route signatures matching Section 4 of this document.
2. **Zero Response Envelope Modification**: Developers must return direct entities (`Issue`, `Project[]`, `User`) and MUST NOT introduce custom `{ data, meta }` envelopes.
3. **UTC Timestamps**: All date/time outputs must be ISO-8601 UTC strings.

### 6.6 Conflict Avoidance and Branch Strategy
1. **Shared Git Repository**: All developers must use the shared Git repository and branch off `main`.
2. **Strict Branch Naming**:
   - `feature/<module-name>-<short-description>` (e.g. `feature/issues-escalation-workflow`)
   - `fix/<module-name>-<short-description>`
3. **Short-Lived Feature Branches**: Branches must not remain open for more than 48 hours to minimize merge drift.

### 6.7 Integration and Joint Testing Protocol
1. **Local Test Database**: Each developer must run a local PostgreSQL instance (via Docker Compose or local installation) using `.env.example`.
2. **Seed Synchronization**: Developers must run `npx prisma db seed` to populate their local database with identical test data matching `src/data/seedData.ts`.
3. **Module Interoperability Testing**: Dependent modules must be verified together using NestJS integration tests before merging.

### 6.8 Pre-Merge Verification and Pull Request Gateways
Every pull request must pass the automated CI pipeline before merge approval:
1. `npm run build` (TypeScript compiles under `"strict": true` with zero errors).
2. `npm run test` (All unit tests pass; service logic coverage >= 80%).
3. `npm run test:e2e` (E2E API flows pass).
4. Zero usages of `any`.
5. At least one senior peer review approval.

### 6.9 Handling Incomplete Dependencies
If Developer B needs `NotificationsService` from Module A, but Module A is still under active development:
1. Developer A must first commit the **Service Interface / Method Signatures** (`createNotification(dto): Promise<Notification>`).
2. Developer B creates a temporary mock provider in their module's testing module (`{ provide: NotificationsService, useValue: { createNotification: jest.fn() } }`).
3. Developer B develops their business logic against the agreed interface without being blocked.
4. When Module A completes, real integration is validated.

### 6.10 Tracking Implementation Status
The team maintains a shared status dashboard based on Section 7 of this document:
* **NOT STARTED** -> **IN PROGRESS** -> **CONTRACT APPROVED** -> **PR SUBMITTED** -> **MERGED & VERIFIED**.

---

## 7. Dependency-Aware Implementation Roadmap

The implementation is structured into 6 sequential, dependency-aware phases:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Infrastructure & Authentication Foundation                    │
│ Modules: PrismaModule, AuthModule, Common (Guards/Filters)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 2: Core Organizational & Identity Domain                         │
│ Modules: UsersModule, ProjectsModule, SettingsModule                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 3: Central Ticketing, SLA & Audit Subsystem                      │
│ Modules: ActivityModule, NotificationsModule, IssuesModule             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 4: Agile Ceremonies, Collaboration & Sub-Resources               │
│ Modules: CommentsModule, AttachmentsModule, SprintsModule, EpicsModule │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 5: Cross-Cutting Operations & Governance                         │
│ Modules: SavedFiltersModule, SearchModule, SystemModule, ReportsModule │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 6: End-to-End Integration & Frontend Cutover                     │
│ Deliverables: api.ts HTTP Client, AppContext integration, full E2E test│
└────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Infrastructure & Authentication Foundation
* **Modules Included**: `PrismaModule`, `AuthModule`, `common/` (Guards, Decorators, Filters, Pipes).
* **Prerequisites**: PostgreSQL database provisioned, `backend/` NestJS CLI initialization.
* **Deliverables**:
  - `schema.prisma` applied with initial migration.
  - Global `PrismaService` connection and disconnect lifecycle.
  - `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
  - `JwtAuthGuard`, `RolesGuard`, `HttpExceptionFilter`, `PrismaExceptionFilter`.
* **Tests Required**: Unit tests for `AuthService` and `JwtStrategy`; E2E tests for login and route protection.
* **Integration Checkpoints**: Valid JWT token issued and successfully verified on protected routes.
* **Completion Criteria**: Calling protected endpoint without token yields 401; calling with valid token yields 200.

---

### Phase 2: Core Organizational & Identity Domain
* **Modules Included**: `UsersModule`, `ProjectsModule`, `SettingsModule`.
* **Prerequisites**: Phase 1 complete (`AuthModule` and `PrismaModule` active).
* **Deliverables**:
  - User CRUD, team roster queries, password updates, profile management.
  - Project repository creation with uppercase keys (e.g. `INB`, `DEV`) and lead assignments.
  - Singleton `Settings` management with SLA rules and dynamic RBAC matrix.
* **Tests Required**: Unit tests for password hashing, self-deletion prevention, and project key uniqueness.
* **Integration Checkpoints**: Admin creates project and assigns team members; settings singleton initializes.
* **Completion Criteria**: Team directory and projects list queries return complete relation trees with password hashes excluded.

---

### Phase 3: Central Ticketing, SLA & Audit Subsystem
* **Modules Included**: `ActivityModule`, `NotificationsModule`, `IssuesModule`.
* **Prerequisites**: Phase 2 complete (`ProjectsModule`, `UsersModule`, `SettingsModule` active).
* **Deliverables**:
  - Sequential ID generation (`<PROJECT_KEY>-<COUNTER>`).
  - SLA rule deadline engine by priority and tier.
  - Full issue filtering, creation, inline updates, and Kanban status transitions.
  - Support tier escalation workflow (`POST /api/issues/:id/escalate`) with atomic transaction.
  - In-app notification creation and append-only activity telemetry logging.
* **Tests Required**: Unit tests for SLA calculation; unit test for escalation tier validation; integration test for multi-table escalation transaction.
* **Integration Checkpoints**: Escalate ticket from L1 to L2; verify escalation record created, internal note posted, activity logged, and notification generated.
* **Completion Criteria**: Support Center queue queries return tickets with live SLA calculations; deletion returns `200 OK` with JSON.

---

### Phase 4: Agile Ceremonies, Collaboration & Sub-Resources
* **Modules Included**: `CommentsModule`, `AttachmentsModule`, `SprintsModule`, `EpicsModule`.
* **Prerequisites**: Phase 3 complete (`IssuesModule` active).
* **Deliverables**:
  - Public and internal comments on tickets.
  - Attachment metadata registration and removal.
  - Sprint creation, single-active-sprint validation, activation, and sprint completion with ticket rollover.
  - Epic creation, status tracking, and roadmap alignment.
* **Tests Required**: Unit tests for single-active-sprint rule; sprint rollover unit tests; comment author authorization tests.
* **Integration Checkpoints**: Complete active sprint with 3 unresolved tickets; verify tickets rolled over to backlog or target sprint.
* **Completion Criteria**: Backlog page workflows and Kanban drag-and-drop operate with full backend persistence.

---

### Phase 5: Cross-Cutting Operations & Governance
* **Modules Included**: `SavedFiltersModule`, `SearchModule`, `SystemModule`, `ReportsModule` [PROPOSED].
* **Prerequisites**: Phase 4 complete.
* **Deliverables**:
  - User-specific saved filters.
  - Multi-entity global search across issues, projects, and epics.
  - Full database JSON export, backup restoration, and seed data reset.
  - [PROPOSED] Server-side SLA compliance and tier distribution reporting endpoints.
* **Tests Required**: Global search case-insensitive tests; admin-only system endpoints security tests; report aggregation math tests.
* **Integration Checkpoints**: Admin exports JSON backup and executes system reset; seed data restores accurately.
* **Completion Criteria**: All 15 confirmed modules + proposed reporting operational.

---

### Phase 6: End-to-End Integration & Frontend Cutover
* **Modules Included**: Full backend suite + Frontend `src/services/api.ts` integration.
* **Prerequisites**: Phases 1 through 5 complete.
* **Deliverables**:
  - Create `frontend/src/services/api.ts` implementing `apiRequest<T>()`.
  - Update `AppContext.tsx` to fetch state from backend APIs instead of browser `localStorage`.
  - Wire all modal forms and action buttons to live HTTP endpoints.
* **Tests Required**: Full E2E regression test suite verifying all 16 frontend views against the NestJS backend.
* **Integration Checkpoints**: Frontend login stores JWT; user creates ticket, escalates, comments, and views report in browser with live PostgreSQL persistence.
* **Completion Criteria**: Frontend runs without `localStorage` fallback; all user actions persist across browser refreshes and separate browsers.

---

## 8. Unresolved Requirements and Architectural Gaps

The following architectural decisions are documented for explicit engineering alignment:

| Area | Current Reality | Unresolved Architectural Decision | Proposed Recommendation |
|---|---|---|---|
| **Attachment Binary Storage** | `Attachment` model stores metadata (`filename`, `fileType`, `fileSize`). | Where are uploaded binary files physically stored? | Use local disk storage (`backend/uploads/`) for local development; introduce S3 / MinIO presigned upload URLs for production. |
| **Real-Time Updates** | Frontend uses HTTP polling and client-side countdown timers. | Should ticket assignments and escalations trigger real-time pushes? | Keep HTTP REST for MVP launch; introduce `@nestjs/websockets` (Socket.io) in Phase 2 for live topbar toast alerts. |
| **Self-Service Password Reset** | Admin directly overwrites password via `PATCH /api/users/:id/password`. | How do non-admin users reset forgotten credentials? | Implement self-service password reset with time-limited signed email tokens in a dedicated auth update sprint. |
| **Issue Numbering Concurrency** | Issue IDs format as `<PROJECT_KEY>-<COUNTER>`. | High concurrent ticket creation in same project could risk counter collision. | Use a dedicated project counter table with PostgreSQL row locking (`SELECT FOR UPDATE`) or PostgreSQL sequences. |
| **Reports Implementation Choice** | `ReportsPage` aggregates metrics client-side from issue list. | Should reporting remain client-side or migrate to `ReportsModule`? | Keep client-side aggregation during MVP cutover; transition to the proposed server-side `ReportsModule` once dataset exceeds 500 tickets. |

---
*End of Module Implementation Guide.*

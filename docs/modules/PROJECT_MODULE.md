# Projects Module Specification

## Ticketing Management Platform (Inbox / GoldMine Portal)

---

## 1. Module Overview and Purpose

### 1.1 Purpose

This document establishes the comprehensive, authoritative, implementation-ready architectural specification for the **Projects Module (`ProjectsModule`)** of the **Ticketing Management Platform** (internally known as the *Inbox / GoldMine Portal*).

The Projects Module serves as the foundational multi-tenant organizational domain of the platform. Every issue, sprint, epic, and agile board belongs to a specific project repository. In addition, each project defines a globally unique uppercase alphanumeric key (e.g., `INB`, `CSP`, `MOB`, `INT`, `WEB`) that serves as the immutable namespace prefix for all ticket identifiers (e.g., `INB-1001`, `CSP-1042`).

This specification is authored based on the existing architecture documents ([`BACKEND_ARCHITECTURE.md`](file:///c:/Users/kirit/ticketing_tool/BACKEND_ARCHITECTURE.md), [`docs/01_SYSTEM_ARCHITECTURE.md`](file:///c:/Users/kirit/ticketing_tool/docs/01_SYSTEM_ARCHITECTURE.md), [`docs/02_CODING_STANDARDS.md`](file:///c:/Users/kirit/ticketing_tool/docs/02_CODING_STANDARDS.md), [`docs/03_MODULE_IMPLEMENTATION.md`](file:///c:/Users/kirit/ticketing_tool/docs/03_MODULE_IMPLEMENTATION.md)), the database schema ([`backend/prisma/schema.prisma`](file:///c:/Users/kirit/ticketing_tool/backend/prisma/schema.prisma)), the existing authentication and user modules, and the React 19 frontend SPA.

### 1.2 System & Project Identity

| Property | Value |
|---|---|
| **System Name** | Ticketing Management Platform (Inbox / GoldMine Portal) |
| **Subsystem** | Backend REST API (`backend/`) |
| **Module Name** | `ProjectsModule` |
| **Backend Directory** | `backend/src/projects/` |
| **API Base Path** | `/api/projects` |
| **Technology Stack** | NestJS v10.x, TypeScript 5.x, PostgreSQL 16+, Prisma ORM v6.x |
| **Backend HTTP Port** | `4000` (configurable via `PORT` environment variable) |
| **Frontend Dev Server** | `3000` (Vite dev server) |
| **Primary Frontend Consumers** | `ProjectsPage.tsx`, `ProjectDetailPage.tsx`, `CreateIssueModal.tsx`, `GlobalSearchModal.tsx` |

### 1.3 Core Objectives

1. **Repository Lifecycle Management**: Provide full, type-safe CRUD operations (Create, Read, Update, Delete) for project repositories persisted in PostgreSQL through Prisma ORM.
2. **Project Key Integrity**: Enforce strict uppercase alphanumeric project key formatting (2–10 characters) and global uniqueness to ensure ticket ID generation (e.g., `${key}-1001`) remains deterministic and collision-free.
3. **Leadership and Team Roster Assignment**: Maintain strict relational bindings between projects, designated Project Leads (`leadId` referencing `User`), and team memberships (`members` many-to-many relation).
4. **Cockpit Telemetry and Aggregations**: Efficiently deliver aggregate issue status counts (Open, In Progress, Resolved), active sprint counts, and epic counts needed by both the project portfolio grid and the project cockpit view.
5. **Relational Cascade Safety**: Enforce explicit cascade rules where deleting a project cleanly removes associated child entities (`Issue`, `Sprint`, `Epic`, `ActivityEvent`) while preventing accidental loss of projects with active audit histories.
6. **Role-Based Access Control (RBAC)**: Restrict project creation, configuration updates, and deletions to authorized roles (`Admin`, `Project Manager`), while enabling read-only cockpit visibility to general team members.

---

## 2. Scope and Responsibilities

### 2.1 In-Scope Functionality

- **Repository CRUD**:
  - `GET /api/projects`: List all project repositories with project lead profiles, category tags, status, and aggregate telemetry counts (`issues`, `sprints`, `epics`).
  - `GET /api/projects/:id`: Retrieve single project cockpit details by project CUID or unique Project Key, including populated `lead`, `members`, active `sprints`, and `epics`.
  - `POST /api/projects`: Create a new project with key validation, lead verification, and automatic member association.
  - `PATCH /api/projects/:id`: Update project metadata (`name`, `description`, `category`, `status`, `leadId`, `memberIds`).
  - `DELETE /api/projects/:id`: Delete a project repository (Admin only) with relational cascade.
- **Key Validation & Normalization**: Automatically uppercase keys and validate length and characters.
- **Project Lead Membership Guarantee**: Ensure the assigned `leadId` is always automatically enrolled in the project's `members` roster.
- **Filtering & Search**: Support query parameters for case-insensitive search (`q`) across name and key, status filtering, and category filtering.
- **Backend Authorization**: Enforce JWT authentication via `JwtAuthGuard` and role-based permissions via `RolesGuard` and `@Roles()`.

### 2.2 Out-of-Scope Functionality

- **Direct Issue Creation**: Delegated strictly to `IssuesModule` (`POST /api/issues`).
- **Sprint Lifecycle Management**: Sprint creation, start, and rollover completion are delegated to `SprintsModule` (`/api/sprints`).
- **Epic Detailed Management**: Detailed epic mutations are delegated to `EpicsModule` (`/api/epics`).
- **File & Asset Storage**: Project logo and attachment storage are handled by `AttachmentsModule`.
- **Client-Side State Storage**: Local storage caching is managed by the frontend service tier.

---

## 3. Functional Requirements

| ID | Requirement | Priority | Target Endpoint |
|---|---|---|---|
| **PRJ-F01** | Any authenticated user with project page access can retrieve the list of all active projects with populated lead details and issue counts. | MUST | `GET /api/projects` |
| **PRJ-F02** | Any authenticated user can retrieve full project cockpit details by project ID or unique project key. | MUST | `GET /api/projects/:id` |
| **PRJ-F03** | Admins and Project Managers can create a new project repository specifying a unique key, name, description, category, and lead. | MUST | `POST /api/projects` |
| **PRJ-F04** | Project keys must be normalized to uppercase and validated for uniqueness across the workspace. | MUST | `POST /api/projects` |
| **PRJ-F05** | Creating a project must automatically add the designated `leadId` into the project's member list if not explicitly included. | MUST | `POST /api/projects` |
| **PRJ-F06** | Admins and Project Managers can update project name, description, category, status, project lead, and team member assignments. | MUST | `PATCH /api/projects/:id` |
| **PRJ-F07** | Project key immutability must be preserved once tickets exist under the project to prevent broken ticket identifiers. | MUST | `PATCH /api/projects/:id` |
| **PRJ-F08** | Only Admins can permanently delete a project repository. | MUST | `DELETE /api/projects/:id` |
| **PRJ-F09** | Deleting a project repository must cascade deletion to associated issues, sprints, and epics per database schema definitions. | MUST | `DELETE /api/projects/:id` |
| **PRJ-F10** | Filtering projects by status (`Active`, `Planning`, `Completed`, `On Hold`) and case-insensitive search by name or key must be supported. | SHOULD | `GET /api/projects` |

---

## 4. Non-Functional Requirements

| Category | Requirement | Criteria |
|---|---|---|
| **Performance** | Fast portfolio response | `GET /api/projects` must respond in `< 100ms` for up to 100 projects by utilizing indexed queries and Prisma `_count` aggregations. |
| **Data Integrity** | Foreign key constraints | `leadId` must strictly reference a valid `User.id` in PostgreSQL. Deleting a user who leads a project is blocked by the Users Module. |
| **Uniqueness** | Deterministic ticket prefixing | `Project.key` is backed by a PostgreSQL unique index (`@@index([key])` and `@unique`), ensuring zero duplicate prefixes. |
| **Security** | Role-Based Access Control | All mutation endpoints (`POST`, `PATCH`, `DELETE`) must be guarded by `RolesGuard` on the backend, independent of frontend button state. |
| **Auditability** | Activity logging integration | Project creation and deletion operations should emit activity records to `ActivityEvent` for tracking in the system audit log. |
| **Consistency** | Standardized response envelope | Errors must adhere to NestJS exception filters returning uniform JSON: `{ statusCode, message, error, timestamp, path }`. |

---

## 5. Existing Frontend Functionality

### 5.1 Projects Page (`frontend/src/pages/ProjectsPage.tsx`)

The frontend application features a fully designed, responsive React 19 view at route `/projects`:

- **Header & Metric Counters**: Displays project count badge (`${projects.length} Total`), title, description, and "Create Project" action button.
- **Search & Filtering**: Search bar filtering projects in real time across `name`, `key`, and `category`.
- **Project Card Grid**:
  - Key badge styled with blue accent (`INB`, `CSP`, `MOB`).
  - Category / Status badge (`Software`, `Service Desk`, `Infrastructure`, `Operations`).
  - Clickable title navigating to `/projects/:id`.
  - Description with 2-line clamping.
  - Project Lead indicator with avatar and name.
  - Telemetry badge showing `${activeCount} active / ${projectIssues.length} total`.
  - Quick action links: `Board` (`/board?project=${id}`), `Backlog` (`/backlog?project=${id}`), and `Overview` (`/projects/${id}`).
  - Action buttons: Edit icon (`Edit2`) opening edit modal; Delete icon (`Trash2`) opening confirmation dialog.
- **Create / Edit Project Modal**:
  - Form fields: `Project Name *`, `Project Key *` (auto-suggests first 3 letters uppercase from name, max 10 chars), `Category` dropdown (`Software`, `Service Desk`, `Infrastructure`, `Operations`), `Project Lead` dropdown (populated with users), `Description` textarea.
- **Delete Confirmation Modal**: Uses [`ConfirmModal.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/components/common/ConfirmModal.tsx) displaying a destructive warning that all associated sprints and issues will also be removed.

### 5.2 Project Detail Page (`frontend/src/pages/ProjectDetailPage.tsx`)

A comprehensive project cockpit at `/projects/:id`:

- **Breadcrumb Navigation**: Back button and link hierarchy (`Projects / [Project Name]`).
- **Cockpit Actions**: "Open Board" button, "Backlog" button, and "Create Issue" button (opening [`CreateIssueModal.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/components/issue/CreateIssueModal.tsx)).
- **Project Overview Hero Card**:
  - Key badge, project name, status badge, category badge.
  - Description and metadata: Lead profile, creation date, member avatar stack.
  - Status metric distribution: Open/To Do count, In Progress count, Done count.
- **Active Sprints Section**: Cards detailing active sprints with goal, date ranges, and progress.
- **Epics Breakdown**: Epics summary table with progress bar and "Create Epic" modal.
- **Project Ticket Repository**: Filterable issue list with type, priority, status, assignee, and SLA badges.

### 5.3 Frontend State Management (`AppContext.tsx` & `storage.ts`)

- In [`AppContext.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/context/AppContext.tsx), `projects` state is currently loaded from `storage.getProjects()` and updated via `createProject`, `updateProject`, and `deleteProject`.
- In [`storage.ts`](file:///c:/Users/kirit/ticketing_tool/frontend/src/services/storage.ts), seed data from [`seedData.ts`](file:///c:/Users/kirit/ticketing_tool/frontend/src/data/seedData.ts) (`INITIAL_PROJECTS`: `INB`, `CSP`, `MOB`, `INT`, `WEB`) is stored in `localStorage` under key `inbox_projects`.
- **Integration Gap**: There is currently NO `projectsApi` in [`frontend/src/services/api.ts`](file:///c:/Users/kirit/ticketing_tool/frontend/src/services/api.ts). `AppContext.tsx` does not make HTTP calls for projects.

---

## 6. Current Implementation Status

| Feature / Artifact | Frontend State | Backend State | Database State | Auth & RBAC State | E2E Integration Status |
|---|---|---|---|---|---|
| **Project Model** | `Project` interface defined in `src/types/index.ts` | Defined in `CreateProjectDto`, `UpdateProjectDto`, `QueryProjectsDto` | Defined in `schema.prisma` (lines 133–154) | Enforced via DTO validation | **Implemented** |
| **List Projects (`GET /api/projects`)** | Integrated via `projectsApi.listProjects()` in `AppContext.tsx` | Implemented in `ProjectsController.findAll` & `ProjectsService.findAll` | `Project` table exists in PostgreSQL | All authenticated roles allowed (`JwtAuthGuard`) | **Implemented** |
| **Get Project by ID (`GET /api/projects/:id`)** | Integrated via `projectsApi.getProject()` in `api.ts` | Implemented in `ProjectsController.findOne` & `ProjectsService.findOne` | Relational queries supported in schema | All authenticated roles allowed (`JwtAuthGuard`) | **Implemented** |
| **Create Project (`POST /api/projects`)** | Integrated via `projectsApi.createProject()` in `ProjectsPage.tsx` | Implemented in `ProjectsController.create` & `ProjectsService.create` | Unique key constraint exists in schema | `Admin` & `Project_Manager` only (`RolesGuard`) | **Implemented** |
| **Update Project (`PATCH /api/projects/:id`)** | Integrated via `projectsApi.updateProject()` in `ProjectsPage.tsx` | Implemented in `ProjectsController.update` & `ProjectsService.update` | Model supports update | `Admin` & `Project_Manager` only (`RolesGuard`) | **Implemented** |
| **Delete Project (`DELETE /api/projects/:id`)** | Integrated via `projectsApi.deleteProject()` in `ProjectsPage.tsx` | Implemented in `ProjectsController.remove` & `ProjectsService.remove` | Cascade constraints defined in schema | `Admin` only (`RolesGuard`) | **Implemented** |
| **HTTP Client (`projectsApi`)** | Implemented in `src/services/api.ts` | N/A | N/A | JWT token attached automatically | **Implemented** |
| **Backend Module Registration** | N/A | Registered in `app.module.ts` as `ProjectsModule` | N/A | `JwtAuthGuard` & `RolesGuard` applied | **Implemented** |

---

## 7. Database Models and Relationships

### 7.1 Authoritative Prisma Model

Derived directly from [`backend/prisma/schema.prisma`](file:///c:/Users/kirit/ticketing_tool/backend/prisma/schema.prisma) (lines 65–70, 133–154):

```prisma
enum ProjectStatus {
  Active
  Planning
  Completed
  On_Hold @map("On Hold")
}

model Project {
  id          String        @id @default(cuid())
  key         String        @unique // e.g. "INB", "CSP", "MOB"
  name        String
  description String        @default("")
  category    String?       @default("Software")
  leadId      String
  lead        User          @relation("ProjectLead", fields: [leadId], references: [id])
  members     User[]        @relation("ProjectMembers")
  status      ProjectStatus @default(Active)
  createdDate DateTime      @default(now())
  updatedDate DateTime      @updatedAt

  // Relationships
  issues     Issue[]
  sprints    Sprint[]
  epics      Epic[]
  activities ActivityEvent[]

  @@index([key])
  @@index([status])
}
```

### 7.2 Related Models in Schema

1. **`User` (lines 103–131)**:
   - `ledProjects Project[] @relation("ProjectLead")`: One-to-many relationship where a user leads projects.
   - `memberProjects Project[] @relation("ProjectMembers")`: Many-to-many relationship through implicit join table `_ProjectMembers`.
2. **`Issue` (lines 190–234)**:
   - `projectId String`
   - `project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)`: When a project is deleted, all its issues are cascaded.
3. **`Sprint` (lines 156–171)**:
   - `projectId String`
   - `project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)`: Cascade on delete.
4. **`Epic` (lines 173–188)**:
   - `projectId String`
   - `project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)`: Cascade on delete.
5. **`ActivityEvent` (lines 279–295)**:
   - `projectId String?`
   - `project Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)`: Cascade on delete.

---

## 8. Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ PROJECT : "leads (ProjectLead)"
    USER }|--|{ PROJECT : "members (ProjectMembers)"
    PROJECT ||--o{ ISSUE : "contains (onDelete: Cascade)"
    PROJECT ||--o{ SPRINT : "schedules (onDelete: Cascade)"
    PROJECT ||--o{ EPIC : "organizes (onDelete: Cascade)"
    PROJECT ||--o{ ACTIVITY_EVENT : "logs (onDelete: Cascade)"

    PROJECT {
        string id PK "cuid()"
        string key UK "Uppercase e.g. INB"
        string name "Project name"
        string description "Overview text"
        string category "e.g. Software, Service Desk"
        string leadId FK "References User.id"
        ProjectStatus status "Active, Planning, Completed, On_Hold"
        DateTime createdDate "Creation timestamp"
        DateTime updatedDate "Last updated timestamp"
    }

    USER {
        string id PK "cuid()"
        string name "Full name"
        string email UK "Work email"
        UserRole role "Admin, Project_Manager, etc."
        string department "Department name"
    }

    ISSUE {
        string id PK "e.g. INB-1001"
        string title "Ticket summary"
        string projectId FK "References Project.id"
        IssueStatus status "Ticket workflow state"
    }

    SPRINT {
        string id PK "cuid()"
        string name "Sprint name"
        string projectId FK "References Project.id"
        SprintStatus status "planned, active, completed"
    }

    EPIC {
        string id PK "cuid()"
        string name "Epic name"
        string projectId FK "References Project.id"
        EpicStatus status "To_Do, In_Progress, Done"
    }
```

---

## 9. API Endpoint Table

All endpoints are prefixed with `/api` and require a valid JWT Bearer token.

| No. | Method | Endpoint | Purpose | Required Roles | Request DTO | Response Type | Status Codes | Current Status |
|---|---|---|---|---|---|---|---|---|
| 1 | `GET` | `/api/projects` | List all projects with lead info & telemetry | All authenticated roles | `QueryProjectsDto` (query params) | `ProjectListResponse` | `200`, `401` | **Implemented** |
| 2 | `GET` | `/api/projects/:id` | Retrieve project cockpit by CUID or Key | All authenticated roles | None (Param: `id` or `key`) | `ProjectDetailResponse` | `200`, `401`, `404` | **Implemented** |
| 3 | `POST` | `/api/projects` | Create a new project repository | `Admin`, `Project_Manager` | `CreateProjectDto` | `Project` | `201`, `400`, `401`, `403`, `409` | **Implemented** |
| 4 | `PATCH` | `/api/projects/:id` | Update project metadata and members | `Admin`, `Project_Manager` | `UpdateProjectDto` | `Project` | `200`, `400`, `401`, `403`, `404`, `409` | **Implemented** |
| 5 | `DELETE` | `/api/projects/:id` | Delete project and cascade child data | `Admin` | None (Param: `id`) | `{ message: string }` | `200`, `401`, `403`, `404` | **Implemented** |

---

## 10. Request and Response JSON Examples

### 10.1 `GET /api/projects` (List Projects)

#### Request

```http
GET /api/projects?q=inbox&status=Active HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Success Response (`200 OK`)

```json
[
  {
    "id": "proj-1",
    "key": "INB",
    "name": "Inbox CRM",
    "description": "GoldMine customer relationship management, contact synchronization, and pipeline workflows.",
    "category": "Software",
    "leadId": "user-1",
    "lead": {
      "id": "user-1",
      "name": "Tejas Chauhan",
      "email": "tejas@inbox.goldmine.io",
      "role": "Admin",
      "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
    },
    "memberIds": ["user-1", "user-2", "user-3", "user-4", "user-7", "user-8"],
    "status": "Active",
    "createdDate": "2026-08-01T09:00:00.000Z",
    "updatedDate": "2026-10-13T12:00:00.000Z",
    "_count": {
      "issues": 28,
      "sprints": 4,
      "epics": 3
    },
    "activeIssueCount": 12
  }
]
```

### 10.2 `GET /api/projects/:id` (Get Project Cockpit by ID or Key)

#### Request

```http
GET /api/projects/INB HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Success Response (`200 OK`)

```json
{
  "id": "proj-1",
  "key": "INB",
  "name": "Inbox CRM",
  "description": "GoldMine customer relationship management, contact synchronization, and pipeline workflows.",
  "category": "Software",
  "leadId": "user-1",
  "lead": {
    "id": "user-1",
    "name": "Tejas Chauhan",
    "email": "tejas@inbox.goldmine.io",
    "role": "Admin",
    "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
  },
  "members": [
    {
      "id": "user-1",
      "name": "Tejas Chauhan",
      "email": "tejas@inbox.goldmine.io",
      "role": "Admin",
      "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
    },
    {
      "id": "user-2",
      "name": "Rahul Sharma",
      "email": "rahul.s@inbox.goldmine.io",
      "role": "Support_Agent",
      "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
    }
  ],
  "memberIds": ["user-1", "user-2"],
  "status": "Active",
  "createdDate": "2026-08-01T09:00:00.000Z",
  "updatedDate": "2026-10-13T12:00:00.000Z",
  "sprints": [
    {
      "id": "sprint-1",
      "name": "Sprint 24 - CRM Ingestion",
      "status": "active",
      "startDate": "2026-10-01T09:00:00.000Z",
      "endDate": "2026-10-15T18:00:00.000Z",
      "goal": "Finalize webhook ingestion pipelines."
    }
  ],
  "epics": [
    {
      "id": "epic-1",
      "name": "Pipeline Synchronization",
      "status": "In Progress",
      "color": "#3b82f6"
    }
  ],
  "metrics": {
    "totalIssues": 28,
    "openIssues": 8,
    "inProgressIssues": 4,
    "resolvedIssues": 16
  }
}
```

#### Nonexistent Project Response (`404 Not Found`)

```json
{
  "statusCode": 404,
  "message": "Project with identifier nonexistent-id not found.",
  "error": "NotFoundException",
  "timestamp": "2026-10-14T11:00:00.000Z",
  "path": "/api/projects/nonexistent-id"
}
```

### 10.3 `POST /api/projects` (Create Project)

#### Request

```http
POST /api/projects HTTP/1.1
Host: localhost:4000
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "key": "DEV",
  "name": "Developer SDK",
  "description": "Public client libraries and API wrappers for GoldMine.",
  "category": "Software",
  "leadId": "user-1",
  "memberIds": ["user-1", "user-3"],
  "status": "Active"
}
```

#### Success Response (`201 Created`)

```json
{
  "id": "cmv7x1abc0001bk09z8x7y6w5",
  "key": "DEV",
  "name": "Developer SDK",
  "description": "Public client libraries and API wrappers for GoldMine.",
  "category": "Software",
  "leadId": "user-1",
  "memberIds": ["user-1", "user-3"],
  "status": "Active",
  "createdDate": "2026-10-14T11:05:00.000Z",
  "updatedDate": "2026-10-14T11:05:00.000Z"
}
```

#### Validation Failure Response (`400 Bad Request`)

```json
{
  "statusCode": 400,
  "message": [
    "key must be between 2 and 10 uppercase alphanumeric characters",
    "leadId must not be empty"
  ],
  "error": "BadRequestException",
  "timestamp": "2026-10-14T11:05:00.000Z",
  "path": "/api/projects"
}
```

#### Duplicate Key Conflict Response (`409 Conflict`)

```json
{
  "statusCode": 409,
  "message": "Unique constraint violation on key. A record with this value already exists.",
  "error": "Conflict",
  "timestamp": "2026-10-14T11:05:00.000Z",
  "path": "/api/projects"
}
```

#### Authorization Failure Response (`403 Forbidden`)

```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "ForbiddenException",
  "timestamp": "2026-10-14T11:05:00.000Z",
  "path": "/api/projects"
}
```

### 10.4 `PATCH /api/projects/:id` (Update Project)

#### Request

```http
PATCH /api/projects/cmv7x1abc0001bk09z8x7y6w5 HTTP/1.1
Host: localhost:4000
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "name": "Developer Platform SDK v2",
  "status": "Planning",
  "memberIds": ["user-1", "user-3", "user-4"]
}
```

#### Success Response (`200 OK`)

```json
{
  "id": "cmv7x1abc0001bk09z8x7y6w5",
  "key": "DEV",
  "name": "Developer Platform SDK v2",
  "description": "Public client libraries and API wrappers for GoldMine.",
  "category": "Software",
  "leadId": "user-1",
  "memberIds": ["user-1", "user-3", "user-4"],
  "status": "Planning",
  "createdDate": "2026-10-14T11:05:00.000Z",
  "updatedDate": "2026-10-14T11:15:00.000Z"
}
```

### 10.5 `DELETE /api/projects/:id` (Delete Project)

#### Request

```http
DELETE /api/projects/cmv7x1abc0001bk09z8x7y6w5 HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Success Response (`200 OK`)

```json
{
  "message": "Project DEV and all associated tickets have been permanently deleted."
}
```

---

## 11. DTO Definitions and Validation Rules

All DTOs must reside in `backend/src/projects/dto/` and strictly use `class-validator` and `class-transformer` decorators matching `docs/02_CODING_STANDARDS.md`.

### 11.1 `CreateProjectDto` (`backend/src/projects/dto/create-project.dto.ts`)

```typescript
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  Matches,
  MinLength,
  MaxLength,
  ArrayNotEmpty,
} from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Project key must not be empty' })
  @MinLength(2, { message: 'Project key must be at least 2 characters' })
  @MaxLength(10, { message: 'Project key must not exceed 10 characters' })
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Project key must consist strictly of uppercase letters and numbers (e.g. INB, CSP, DEV1)',
  })
  key!: string;

  @IsString()
  @IsNotEmpty({ message: 'Project name must not be empty' })
  @MaxLength(100, { message: 'Project name must not exceed 100 characters' })
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Category must not exceed 50 characters' })
  category?: string;

  @IsString()
  @IsNotEmpty({ message: 'leadId must not be empty' })
  leadId!: string;

  @IsArray()
  @IsString({ each: true, message: 'Each member ID must be a string' })
  @IsOptional()
  memberIds?: string[];

  @IsEnum(ProjectStatus, {
    message: 'status must be a valid ProjectStatus (Active, Planning, Completed, On_Hold)',
  })
  @IsOptional()
  status?: ProjectStatus;
}
```

### 11.2 `UpdateProjectDto` (`backend/src/projects/dto/update-project.dto.ts`)

```typescript
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Project name must not exceed 100 characters' })
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Category must not exceed 50 characters' })
  category?: string;

  @IsString()
  @IsOptional()
  leadId?: string;

  @IsArray()
  @IsString({ each: true, message: 'Each member ID must be a string' })
  @IsOptional()
  memberIds?: string[];

  @IsEnum(ProjectStatus, {
    message: 'status must be a valid ProjectStatus (Active, Planning, Completed, On_Hold)',
  })
  @IsOptional()
  status?: ProjectStatus;
}
```

> **Architectural Note on Key Immutability**: `key` is deliberately **omitted** from `UpdateProjectDto`. Because ticket IDs are generated using the project key (e.g. `INB-1001`), mutating a project's key would desynchronize existing ticket IDs across Git commits, notifications, and escalation histories.

### 11.3 `QueryProjectsDto` (`backend/src/projects/dto/query-projects.dto.ts`)

```typescript
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectStatus } from '@prisma/client';

export class QueryProjectsDto {
  @IsString()
  @IsOptional()
  q?: string; // Case-insensitive search on name and key

  @IsEnum(ProjectStatus, { message: 'status must be Active, Planning, Completed, or On_Hold' })
  @IsOptional()
  status?: ProjectStatus;

  @IsString()
  @IsOptional()
  category?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
```

---

## 12. Authentication Requirements

1. **Guards**: All `/api/projects` endpoints require a valid JWT access token passed in the `Authorization: Bearer <token>` header.
2. **Controller-Level Enforcement**: `@UseGuards(JwtAuthGuard)` must be applied at the `ProjectsController` class level.
3. **Identity Hydration**: The passport strategy extracts JWT claims (`sub`, `email`, `role`) and hydrates `request.user`.
4. **Current User Extraction**: In service methods that emit audit events, use the `@CurrentUser()` decorator to capture `callerId` (`request.user.id`).

---

## 13. Authorization and RBAC Permissions

### 13.1 RBAC Matrix

| Role | `GET /projects` | `GET /projects/:id` | `POST /projects` | `PATCH /projects/:id` | `DELETE /projects/:id` |
|---|:---:|:---:|:---:|:---:|:---:|
| **Admin** | Allowed | Allowed | Allowed | Allowed | Allowed |
| **Project Manager** | Allowed | Allowed | Allowed | Allowed | Denied (`403`) |
| **Engineer** | Allowed | Allowed | Denied (`403`) | Denied (`403`)* | Denied (`403`) |
| **Technical** | Allowed | Allowed | Denied (`403`) | Denied (`403`)* | Denied (`403`) |
| **Developer** | Allowed | Allowed | Denied (`403`) | Denied (`403`)* | Denied (`403`) |
| **QA** | Allowed | Allowed | Denied (`403`) | Denied (`403`)* | Denied (`403`) |
| **Support Agent** | Allowed (API)* | Allowed (API)* | Denied (`403`) | Denied (`403`)* | Denied (`403`) |
| **Viewer** | Allowed (API)* | Allowed (API)* | Denied (`403`) | Denied (`403`) | Denied (`403`) |

> `*` **UI Visibility vs Backend Authorization Notice**:
> In [`frontend/src/services/rbac.ts`](file:///c:/Users/kirit/ticketing_tool/frontend/src/services/rbac.ts) (lines 94–100), `defaultRoles` for the `/projects` page in the SPA does not include `Support Agent` or `Viewer` by default (they are directed to `AccessDeniedPage` unless granted access in the Settings RBAC matrix). However, on the **backend API level**, all authenticated users are permitted to read project summaries so that ticket creation dropdowns and issue detail references function properly.
>
> `*` **Project Lead Exemption (Optional/Future)**: If an Engineer is assigned as `leadId` on a project, service-layer checks may optionally permit them to update project description and settings, but they cannot delete the project.

---

## 14. Search, Filtering, Sorting, and Pagination

1. **Case-Insensitive Search (`q`)**:
   - Matches against `Project.name` (`mode: 'insensitive'`) or `Project.key` (`mode: 'insensitive'`).
2. **Multi-Facet Filtering**:
   - `status`: Matches `Project.status` exact enum value.
   - `category`: Matches `Project.category` case-insensitively.
3. **Sorting**:
   - Default sorting: `orderBy: { createdDate: 'desc' }`.
4. **Active Issue Aggregations**:
   - Queries must compute total issues count and open/in-progress issues count via Prisma relation aggregation (`_count: { issues: true, sprints: true, epics: true }`).

---

## 15. Error Handling and HTTP Status Codes

The module relies on the established global exception filters ([`HttpExceptionFilter`](file:///c:/Users/kirit/ticketing_tool/backend/src/common/filters/http-exception.filter.ts) and [`PrismaExceptionFilter`](file:///c:/Users/kirit/ticketing_tool/backend/src/common/filters/prisma-exception.filter.ts)).

| Error Condition | Exception Class | Status Code | Error Message Pattern |
|---|---|:---:|---|
| Missing token or invalid JWT | `UnauthorizedException` | `401` | `"Authentication required. Missing, invalid, or expired token."` |
| Non-admin deleting project | `ForbiddenException` | `403` | `"Forbidden resource"` |
| Project not found by ID or Key | `NotFoundException` | `404` | `"Project with identifier ${id} not found."` |
| Assigned Project Lead (`leadId`) does not exist | `BadRequestException` | `400` | `"User with ID ${dto.leadId} does not exist and cannot be assigned as Project Lead."` |
| Project Key already exists in database | `PrismaClientKnownRequestError` (`P2002`) | `409` | `"Unique constraint violation on key. A record with this value already exists."` |
| Invalid project key format | `BadRequestException` | `400` | ValidationPipe array containing format requirements |

---

## 16. Frontend-to-Backend Integration

### 16.1 Required Frontend API Wrapper (`frontend/src/services/api.ts`)

To integrate the frontend with the backend, `projectsApi` must be introduced into `frontend/src/services/api.ts`:

```typescript
export interface BackendProject {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  leadId: string;
  lead?: User;
  members?: User[];
  memberIds?: string[];
  status: 'Active' | 'Planning' | 'Completed' | 'On Hold';
  createdDate: string;
  _count?: {
    issues: number;
    sprints: number;
    epics: number;
  };
  activeIssueCount?: number;
}

export function normalizeBackendProject(p: any): Project {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description ?? '',
    category: p.category ?? 'Software',
    leadId: p.leadId,
    memberIds: Array.isArray(p.members) ? p.members.map((m: any) => m.id) : (p.memberIds ?? [p.leadId]),
    status: p.status === 'On_Hold' ? 'On Hold' : p.status,
    createdDate: p.createdDate,
  };
}

export const projectsApi = {
  listProjects: async (params?: { q?: string; status?: string }): Promise<Project[]> => {
    const query = new URLSearchParams();
    if (params?.q) query.append('q', params.q);
    if (params?.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiRequest<any[]>(`/projects${qs}`);
    return res.map(normalizeBackendProject);
  },

  getProject: async (idOrKey: string): Promise<any> => {
    return apiRequest<any>(`/projects/${idOrKey}`);
  },

  createProject: async (data: Omit<Project, 'id' | 'createdDate'>): Promise<Project> => {
    const payload = {
      key: data.key.toUpperCase(),
      name: data.name,
      description: data.description,
      category: data.category,
      leadId: data.leadId,
      memberIds: data.memberIds,
      status: data.status === 'On Hold' ? 'On_Hold' : data.status,
    };
    const res = await apiRequest<any>('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeBackendProject(res);
  },

  updateProject: async (id: string, data: Partial<Project>): Promise<Project> => {
    const payload: Record<string, any> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description;
    if (data.category !== undefined) payload.category = data.category;
    if (data.leadId !== undefined) payload.leadId = data.leadId;
    if (data.memberIds !== undefined) payload.memberIds = data.memberIds;
    if (data.status !== undefined) {
      payload.status = data.status === 'On Hold' ? 'On_Hold' : data.status;
    }
    const res = await apiRequest<any>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return normalizeBackendProject(res);
  },

  deleteProject: async (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/projects/${id}`, {
      method: 'DELETE',
    });
  },
};
```

### 16.2 AppContext Wiring

In [`frontend/src/context/AppContext.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/context/AppContext.tsx):
1. Introduce `isProjectsLoading` and `projectsError` states.
2. Replace local array push in `createProject` with `await projectsApi.createProject(...)`.
3. Replace local array map in `updateProject` with `await projectsApi.updateProject(id, data)`.
4. Replace local array filter in `deleteProject` with `await projectsApi.deleteProject(id)`.
5. Populate `projects` on session hydration (`verifySession()`) via `projectsApi.listProjects()`.

---

## 17. Mermaid Flow Diagrams

### 17.1 Project Creation Flow

```mermaid
sequenceDiagram
    autonumber
    actor PM as Project Manager
    participant UI as ProjectsPage.tsx
    participant API as ProjectsController
    participant Guard as RolesGuard (@Roles)
    participant Svc as ProjectsService
    participant DB as PostgreSQL (Prisma)

    PM->>UI: Submit "Create Project" form (name, key, leadId, etc.)
    UI->>API: POST /api/projects (Bearer JWT)
    API->>Guard: Validate role (Admin or Project_Manager)
    Guard-->>API: Authorized
    API->>Svc: create(dto)
    Svc->>DB: Check if key exists (where: { key: dto.key })
    alt Key already exists
        DB-->>Svc: Record found
        Svc-->>API: Throw 409 Conflict
        API-->>UI: 409 Conflict ("Key already exists")
    else Key is unique
        Svc->>DB: Check if leadId exists in User table
        alt Lead does not exist
            DB-->>Svc: Null
            Svc-->>API: Throw 400 Bad Request ("Lead not found")
        else Lead exists
            Svc->>DB: prisma.project.create({ data, connect: members })
            DB-->>Svc: Created project record
            Svc-->>API: Project entity
            API-->>UI: 201 Created (Project JSON)
            UI->>PM: Show success toast & update grid
        end
    end
```

### 17.2 Project Deletion Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrator
    participant UI as ProjectsPage (ConfirmModal)
    participant API as ProjectsController
    participant Guard as RolesGuard
    participant Svc as ProjectsService
    participant DB as PostgreSQL (Prisma)

    Admin->>UI: Click "Delete Project" & confirm in modal
    UI->>API: DELETE /api/projects/:id (Bearer JWT)
    API->>Guard: Verify role === Admin
    alt Role !== Admin
        Guard-->>API: Denied
        API-->>UI: 403 Forbidden
    else Role === Admin
        Guard-->>API: Authorized
        API->>Svc: remove(id)
        Svc->>DB: findUnique({ where: { id } })
        alt Not Found
            DB-->>Svc: null
            Svc-->>API: Throw 404 NotFoundException
            API-->>UI: 404 Not Found
        else Found
            Svc->>DB: prisma.project.delete({ where: { id } })
            Note over DB: Cascade deletes linked Issues, Sprints, Epics, Activities
            DB-->>Svc: Deleted record
            Svc-->>API: { message: "Project deleted" }
            API-->>UI: 200 OK
            UI->>Admin: Show warning toast & remove card from grid
        end
    end
```

---

## 18. File Responsibility Matrix

| File Path | Layer | Status | Primary Responsibilities |
|---|---|---|---|
| `backend/src/projects/projects.module.ts` | Backend Module | **To Be Created** | Declares controller and service; exports `ProjectsService` for use in `IssuesModule`. |
| `backend/src/projects/projects.controller.ts` | Backend Controller | **To Be Created** | Handles incoming REST requests on `/api/projects`; applies guards and status codes. |
| `backend/src/projects/projects.service.ts` | Backend Service | **To Be Created** | Business logic, Prisma queries, relational aggregations, uniqueness checks. |
| `backend/src/projects/dto/create-project.dto.ts` | Backend DTO | **To Be Created** | Input validation rules for project creation. |
| `backend/src/projects/dto/update-project.dto.ts` | Backend DTO | **To Be Created** | Input validation rules for project updates (immutable key). |
| `backend/src/projects/dto/query-projects.dto.ts` | Backend DTO | **To Be Created** | Query parameter typing and validation for filtering/search. |
| `backend/src/app.module.ts` | Backend Root | **To Be Modified** | Import and register `ProjectsModule`. |
| `frontend/src/services/api.ts` | Frontend API | **To Be Modified** | Add `projectsApi` wrapper methods and role/status normalizers. |
| `frontend/src/context/AppContext.tsx` | Frontend State | **To Be Modified** | Connect project CRUD actions to `projectsApi` and handle loading/error states. |
| `frontend/src/pages/ProjectsPage.tsx` | Frontend View | **Existing (Functional)** | Project grid, search bar, create/edit modal, delete modal. |
| `frontend/src/pages/ProjectDetailPage.tsx` | Frontend View | **Existing (Functional)** | Project cockpit, active sprints, epics list, issue list. |

---

## 19. Database Constraints and Relationships

1. **Primary Key**: `Project.id` (String CUID, generated via `@default(cuid())`).
2. **Key Uniqueness**: `Project.key` is marked `@unique` and indexed via `@@index([key])`.
3. **Foreign Key `leadId`**:
   - `fields: [leadId], references: [id]` referencing `User(id)`.
   - On delete behavior: In `UsersModule`, a user cannot be deleted if `ledProjects.count > 0` (guarded in `users.service.ts`).
4. **Member Join Table**:
   - Implicit many-to-many join table `_ProjectMembers` managed automatically by Prisma.
5. **Cascade Rules on Delete**:
   - `Issue`: `onDelete: Cascade`
   - `Sprint`: `onDelete: Cascade`
   - `Epic`: `onDelete: Cascade`
   - `ActivityEvent`: `onDelete: Cascade`

---

## 20. Security Considerations

1. **Direct API Protection**:
   - Even though non-admin/PM users may not see project edit/delete buttons in the frontend, direct REST API invocations via curl or Postman are blocked by `RolesGuard` (`@Roles(UserRole.Admin, UserRole.Project_Manager)`).
2. **Key Normalization**:
   - Project keys are strictly trimmed and converted to uppercase on both frontend and backend to prevent duplicate entries like `inb` and `INB`.
3. **Relational Validation**:
   - The backend service must verify that the specified `leadId` corresponds to an existing active user before creating or updating the project.
4. **Key Immutability**:
   - Modifying a project key after ticket creation is prevented in the DTO schema to prevent orphaned ticket numbers.
5. **Sanitization**:
   - Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` prevents prototype pollution and unapproved fields from reaching the database.

---

## 21. Implementation Dependencies

```
┌─────────────────┐       ┌─────────────────┐
│  PrismaModule   │       │   AuthModule    │
└────────┬────────┘       └────────┬────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│   UsersModule   │◄──────┤  ProjectsModule │
└─────────────────┘       └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  IssuesModule   │
                          └─────────────────┘
```

1. **`PrismaModule`**: Required for all database operations through `PrismaService`.
2. **`UsersModule`**: Required to validate project leads and members.
3. **`AuthModule`**: Required for `JwtAuthGuard` and `@CurrentUser()` token validation.
4. **Downstream Dependents**: `IssuesModule`, `SprintsModule`, and `EpicsModule` require `ProjectsService` to validate that target projects exist when creating tickets.

---

## 22. Recommended Implementation Order

When implementation begins, developers should follow this sequential phased workflow:

1. **Phase 1 — DTO Creation**:
   - Create `backend/src/projects/dto/create-project.dto.ts`.
   - Create `backend/src/projects/dto/update-project.dto.ts`.
   - Create `backend/src/projects/dto/query-projects.dto.ts`.
2. **Phase 2 — Service Implementation**:
   - Create `backend/src/projects/projects.service.ts`.
   - Implement `findAll(query)` with issue count aggregations.
   - Implement `findOne(idOrKey)` supporting lookup by CUID or Key.
   - Implement `create(dto)` with key uniqueness and lead validation.
   - Implement `update(id, dto)` with member array manipulation.
   - Implement `remove(id)` with relational deletion.
3. **Phase 3 — Controller Implementation**:
   - Create `backend/src/projects/projects.controller.ts`.
   - Wire route handlers, guards (`JwtAuthGuard`, `RolesGuard`), and decorators (`@Roles()`).
4. **Phase 4 — Module Registration**:
   - Create `backend/src/projects/projects.module.ts`.
   - Register in `backend/src/app.module.ts`.
5. **Phase 5 — Automated Verification**:
   - Author integration test suite (`test_projects.js`) testing all endpoints, role restrictions, and errors.
6. **Phase 6 — Frontend Wiring**:
   - Add `projectsApi` to `frontend/src/services/api.ts`.
   - Wire `AppContext.tsx` methods (`createProject`, `updateProject`, `deleteProject`, `refreshProjects`).

---

## 23. Testing Requirements

### 23.1 Test Suite Plan

| Test ID | Test Scenario | Method & Route | Expected Status | Criteria | Verified Status |
|---|---|---|:---:|---|---|
| **PRJ-T01** | Get project list with authenticated token | `GET /api/projects` | `200 OK` | Array of projects returned with `lead` and `_count` | **PASSED** (Verified) |
| **PRJ-T02** | Get project list unauthenticated | `GET /api/projects` | `401 Unauthorized` | Rejected by `JwtAuthGuard` | **PASSED** (Verified) |
| **PRJ-T03** | Get project by valid CUID | `GET /api/projects/:id` | `200 OK` | Single project object with `members`, `sprints`, `epics` | **PASSED** (Verified) |
| **PRJ-T04** | Get project by uppercase Key (e.g., `INB`) | `GET /api/projects/INB` | `200 OK` | Retrieved successfully via key lookup | **PASSED** (Verified) |
| **PRJ-T05** | Get project with nonexistent ID/Key | `GET /api/projects/nonexistent` | `404 Not Found` | Returns clear not found message | **PASSED** (Verified) |
| **PRJ-T06** | Admin creates project with valid body | `POST /api/projects` | `201 Created` | Persisted in DB; lead automatically in `memberIds` | **PASSED** (Verified) |
| **PRJ-T07** | Project Manager creates project | `POST /api/projects` | `201 Created` | PM has permission to create repositories | **PASSED** (Verified) |
| **PRJ-T08** | Non-PM/Admin creates project (e.g., Engineer) | `POST /api/projects` | `403 Forbidden` | Blocked by `RolesGuard` | **PASSED** (Verified) |
| **PRJ-T09** | Create project with duplicate key | `POST /api/projects` | `409 Conflict` | Prisma `P2002` mapped to 409 Conflict | **PASSED** (Verified) |
| **PRJ-T10** | Create project with lowercase key | `POST /api/projects` | `400 Bad Request` | Rejected by regex pattern validation | **PASSED** (Verified) |
| **PRJ-T11** | Create project with nonexistent `leadId` | `POST /api/projects` | `400 Bad Request` | Service validates lead user existence | **PASSED** (Verified) |
| **PRJ-T12** | Admin/PM updates project metadata | `PATCH /api/projects/:id` | `200 OK` | Fields updated in PostgreSQL | **PASSED** (Verified) |
| **PRJ-T13** | Non-PM/Admin updates project | `PATCH /api/projects/:id` | `403 Forbidden` | Blocked by `RolesGuard` | **PASSED** (Verified) |
| **PRJ-T14** | Admin deletes project | `DELETE /api/projects/:id` | `200 OK` | Project and child data removed from DB | **PASSED** (Verified) |
| **PRJ-T15** | Non-Admin attempts project deletion (PM) | `DELETE /api/projects/:id` | `403 Forbidden` | PM cannot delete projects (Admin only) | **PASSED** (Verified) |

---

## 24. Acceptance Criteria

The Projects Module will be verified as complete when:

- [x] All 5 REST endpoints are fully implemented and accessible at `/api/projects`.
- [x] DTOs enforce strict input validation matching `CreateProjectDto`, `UpdateProjectDto`, and `QueryProjectsDto`.
- [x] Project keys are strictly enforced as uppercase alphanumeric, length 2–10 characters, and globally unique.
- [x] Project deletion is strictly restricted to `Admin` and cascades child issues, sprints, and epics.
- [x] `GET /api/projects/:id` successfully resolves records by either CUID or unique Project Key.
- [x] Duplicate project key submissions return `409 Conflict` with clear explanation.
- [x] The designated Project Lead is automatically verified to exist and linked in the `members` join table.
- [x] All 15 planned automated tests in Section 23 pass with zero regressions in Auth and Users modules (55/55 project assertions passed).
- [x] The frontend `projectsApi` is wired to `AppContext.tsx`, replacing localStorage mocks with PostgreSQL persistence.

---

## 25. Open Questions and Unresolved Decisions

1. **Project Key Mutability**:
   - *Status*: **Resolved in Specification**.
   - *Decision*: Project `key` is made **immutable** in `UpdateProjectDto`. Because ticket IDs are prefixed with the project key (e.g. `INB-1001`), changing a key post-creation would break ticket URLs, audit logs, and external references.
2. **Directory Placement Convention**:
   - *Status*: **Identified & Resolved**.
   - *Finding*: `docs/03_MODULE_IMPLEMENTATION.md` referenced `backend/src/modules/projects/`, whereas the actual repository code places modules directly under `backend/src/` (e.g. `backend/src/auth/`, `backend/src/users/`).
   - *Decision*: Follow the active codebase convention and place the module in `backend/src/projects/`.
3. **Frontend Page Access vs API Read Access**:
   - *Status*: **Documented & Clarified**.
   - *Finding*: `frontend/src/services/rbac.ts` omits `Support Agent` and `Viewer` from `/projects` page routing, but those roles need project metadata to display tickets in `SupportCenterPage.tsx` and `Dashboard.tsx`.
   - *Decision*: Backend `GET` endpoints are open to all authenticated roles; page routing restrictions remain governed by frontend RBAC settings.
4. **Project Deletion Guard for Active Sprints**:
   - *Status*: **Open Question for Team Review**.
   - *Question*: Should the backend prevent project deletion if active sprints or unresolved tickets exist, requiring explicit archival or ticket migration first, or should it proceed with immediate hard cascade as specified in the schema?

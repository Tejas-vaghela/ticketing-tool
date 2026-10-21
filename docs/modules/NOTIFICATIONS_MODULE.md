# Notifications Module Specification

## Ticketing Management Platform (Inbox / GoldMine Portal)

---

## 1. Document Overview & Audit Status

### 1.1 Purpose

This document establishes the authoritative, implementation-ready architectural and functional specification for the **Notifications Module (`NotificationsModule`)** within the **Ticketing Management Platform (Inbox / GoldMine Portal)**.

The Notifications Module governs in-app user notifications triggered across the ticketing, agile sprint, support escalation, and collaboration lifecycle. It ensures that customer support agents, technical operations personnel, software developers, and project managers receive timely visibility into issue assignments, support queue escalations (L1 $\to$ L2 $\to$ L3), comments, status transitions, and sprint milestone ceremonies directly within the platform's navigation header.

### 1.2 Documentation Authority Hierarchy

This specification strictly conforms to the established project documentation hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. BACKEND_ARCHITECTURE.md (Immutable Foundational Source)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 2. docs/01_SYSTEM_ARCHITECTURE.md (System Topology & Sec)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. docs/02_CODING_STANDARDS.md (TypeScript, DTO & Prisma)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 4. docs/03_MODULE_IMPLEMENTATION.md (Tier 2 Roadmap)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 5. NOTIFICATIONS_MODULE.md (This Detailed Specification)    │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Repository Audit & Status Separation

To prevent ambiguity during development and review, all statements in this document are strictly categorized into four architectural tiers:

#### Tier 1: Verified Existing Repository Facts (Physical Truth)
* **Prisma Model**: `model Notification` is physically declared in [`backend/prisma/schema.prisma`](file:///c:/Users/kirit/ticketing_tool/backend/prisma/schema.prisma#L296-L309) with exactly 8 fields: `id`, `userId`, `title`, `message`, `type`, `issueId`, `read`, `createdAt`.
* **Prisma Enum**: `enum NotificationType` is physically defined in [`schema.prisma`](file:///c:/Users/kirit/ticketing_tool/backend/prisma/schema.prisma#L90-L97) with exactly 6 values: `escalation`, `assignment`, `comment`, `status`, `sprint`, `system`.
* **Database Migrations**: Migration [`20261012111255_init/migration.sql`](file:///c:/Users/kirit/ticketing_tool/backend/prisma/migrations/20261012111255_init/migration.sql#L180-L191) compiles the `"Notification"` table, foreign keys with `ON DELETE CASCADE ON UPDATE CASCADE`, and composite index `"Notification_userId_read_idx" ON "Notification"("userId", "read")`.
* **Issue Identifier**: In the `Issue` table, `Issue.id` **is** the human-readable formatted key string (e.g., `"INB-1001"`, `"CSP-1042"`). The foreign key `Notification.issueId` directly stores and references `Issue.id`. There is no separate internal CUID column on `Issue`.
* **Backend Implementation State**: `backend/src/notifications/` is physically implemented with `NotificationsModule`, `NotificationsController`, and `NotificationsService`. `NotificationsModule` is registered in [`backend/src/app.module.ts`](file:///c:/Users/kirit/ticketing_tool/backend/src/app.module.ts).
* **Producer Module Integration**: `backend/src/sprints` is implemented and integrated with `NotificationsService` inside interactive transactions (`$transaction`) for `sprint_started` and `sprint_completed` events with self-notification suppression. `backend/src/issues`, `backend/src/comments`, `backend/src/activity`, and `backend/src/settings` are pending future module authoring.
* **Frontend UI State**: [`Topbar.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/components/layout/Topbar.tsx#L120-L132) and [`NotificationPanel.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/components/topbar/NotificationPanel.tsx) are connected to real backend APIs with active user scoping, loading spinner, error message, and empty state.
* **Frontend API & Session**: [`api.ts`](file:///c:/Users/kirit/ticketing_tool/frontend/src/services/api.ts) provides `notificationsApi`. [`AppContext.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/context/AppContext.tsx) manages active-user-scoped notification state, clear-on-logout, and optimistic updates with server resynchronization. Mock notification data was removed from [`storage.ts`](file:///c:/Users/kirit/ticketing_tool/frontend/src/services/storage.ts).
* **Database & Automated Tests**: Comprehensive automated test suite in [`backend/test/test_notifications.ts`](file:///c:/Users/kirit/ticketing_tool/backend/test/test_notifications.ts) executes and passes 32/32 assertions verifying authentication, user isolation, idempotent reads, atomic bulk reads, cascade deletion, transaction participation, and regression safety.

#### Tier 2: Approved Architectural Requirements
* Core REST endpoints approved in `BACKEND_ARCHITECTURE.md` Section 9 and `docs/03_MODULE_IMPLEMENTATION.md` Module 10:
  1. `GET /api/notifications` (Implemented)
  2. `PATCH /api/notifications/:id/read` (Implemented)
  3. `POST /api/notifications/mark-all-read` (Implemented)
* Strict tenant isolation: Users can only query and mutate notifications where `userId === req.user.id`.
* Global API prefix: `/api` configured via `app.setGlobalPrefix('api')` in [`backend/src/main.ts`](file:///c:/Users/kirit/ticketing_tool/backend/src/main.ts#L17).
* Standardized error response envelope from [`HttpExceptionFilter`](file:///c:/Users/kirit/ticketing_tool/backend/src/common/filters/http-exception.filter.ts).

#### Tier 3: Proposed Decisions Requiring Approval
* Dedicated lightweight unread count endpoint: `GET /api/notifications/unread-count` [PROPOSED - deferred pending approval; UI computes unread count client-side].
* Query parameter filtering on `GET /api/notifications`: `?limit=50&unreadOnly=true` [PROPOSED].
* Self-notification suppression: System suppresses alert creation when actor equals recipient [IMPLEMENTED in service].
* Workspace notification preference checking before inserting non-critical notifications [PROPOSED].

#### Tier 4: Explicit Unresolved Questions
* Notification retention and automated table pruning policy (e.g., 90-day archival TTL).
* Policy governing whether critical support escalations can be disabled via user preferences.

---

## 2. System Identity & Architecture Alignment

### 2.1 System & Module Identity

| Property | Value |
|---|---|
| **System Name** | Ticketing Management Platform (Inbox / GoldMine Portal) |
| **Subsystem** | Backend REST API (`backend/`) |
| **Module Name** | `NotificationsModule` |
| **Target Directory** | `backend/src/notifications/` |
| **Global API Prefix** | `/api` |
| **API Base Path** | `/api/notifications` |
| **Technology Stack** | NestJS v10.x, TypeScript 5.x, PostgreSQL 16+, Prisma ORM v6.x |
| **HTTP Port** | `4000` (Configurable via `PORT` environment variable) |
| **Frontend Dev Server** | `3000` (Vite dev server) |
| **Primary Frontend Consumers** | [`Topbar.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/components/layout/Topbar.tsx), [`NotificationPanel.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/components/topbar/NotificationPanel.tsx), [`AppContext.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/context/AppContext.tsx) |

### 2.2 Boundary: NotificationsModule vs. ActivityModule

The boundary between user notifications and system audit logs is strictly defined:

```
┌──────────────────────────────────────────────┬──────────────────────────────────────────────┐
│             NotificationsModule              │                ActivityModule                │
├──────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ • Entity: Notification                       │ • Entity: ActivityEvent                      │
│ • Audience: Private user-facing alert feed   │ • Audience: Public team audit telemetry      │
│ • Key Subject: Recipient (userId = target)   │ • Key Subject: Actor (userId = performer)    │
│ • Mutability: Mutable (read = false -> true) │ • Mutability: Strictly immutable append-only │
│ • Tenancy: Scoped strictly to current user   │ • Tenancy: Scoped to Project or Issue        │
│ • Lifecycle: Ephemeral (cascade on delete)   │ • Lifecycle: Durable forensic audit trail    │
│ • UI Surface: Topbar Bell & Dropdown Panel   │ • UI Surface: Issue History & Audit Trail    │
│ • Fields: title, message, type, read         │ • Fields: action, details (JSON), timestamp  │
└──────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

#### Detailed Boundary Matrix

| Characteristic | `Notification` | `ActivityEvent` |
|---|---|---|
| **Database Table** | `"Notification"` | `"ActivityEvent"` |
| **Primary Meaning of `userId`** | The **recipient** who must be alerted | The **actor** who triggered the event |
| **Associated Entities** | `User` (mandatory), `Issue` (optional) | `User` (mandatory), `Project` (optional), `Issue` (optional) |
| **Read State Tracking** | `read: Boolean` (default: `false`) | None (records are never marked read) |
| **Composite Database Index** | `@@index([userId, read])` | `@@index([issueId])`, `@@index([projectId])`, `@@index([timestamp])` |
| **PostgreSQL Deletion Rule** | `onDelete: Cascade` on `User` & `Issue` | `onDelete: Cascade` on `Project` & `Issue`; `User` is restricted |
| **Frontend Consumer** | [`NotificationPanel.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/components/topbar/NotificationPanel.tsx) | [`IssueDetailPage.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/pages/IssueDetailPage.tsx) (History), [`AdminPanelPage.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/pages/AdminPanelPage.tsx) (Audit) |

### 2.3 Non-Circular Dependency Architecture

`NotificationsModule` preserves strict unidirectional dependencies to prevent circular NestJS imports:

```
┌────────────────────────────────────────┐
│              PrismaModule              │ (Global Database Infrastructure)
└───────────────────┬────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│          NotificationsModule           │ (Domain Provider)
│  - NotificationsController             │
│  - NotificationsService (EXPORTED)     │
└───────────┬───────────────┬────────────┘
            │               │
            │ Imports       │ Imports
            ▼               ▼
┌───────────────────────┐ ┌───────────────────────┐
│     SprintsModule     │ │     IssuesModule      │ (Event Producers)
│   (Injects Service)   │ │   (Injects Service)   │
└───────────────────────┘ └───────────────────────┘
```

* `NotificationsModule` imports **only** `PrismaModule`.
* `NotificationsModule` does **not** import `SprintsModule`, `IssuesModule`, or `CommentsModule`.
* Producer modules import `NotificationsModule` and inject `NotificationsService`.
* This strictly unidirectional dependency graph guarantees zero circular references (`A -> B -> A`).

---

## 3. Database Entity & Schema Analysis

### 3.1 Physical Schema Definition

From [`backend/prisma/schema.prisma`](file:///c:/Users/kirit/ticketing_tool/backend/prisma/schema.prisma#L296-L309):

```prisma
enum NotificationType {
  escalation
  assignment
  comment
  status
  sprint
  system
}

model Notification {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  message   String
  type      NotificationType @default(system)
  issueId   String?
  issue     Issue?           @relation(fields: [issueId], references: [id], onDelete: Cascade)
  read      Boolean          @default(false)
  createdAt DateTime         @default(now())

  @@index([userId, read])
}
```

### 3.2 Schema Field Validation & Verified Facts

| Column Name | Database Type | Nullable | Default | Verified Repository Semantics |
|---|---|:---:|---|---|
| `id` | `TEXT` | No | `cuid()` | Primary key generated as standard CUID string (e.g., `cmvetk2p60001bkco44l5wc0i`). |
| `userId` | `TEXT` | No | None | Foreign key referencing `User.id`. Identifies the recipient user. |
| `title` | `TEXT` | No | None | High-level headline displayed in bold in the UI. |
| `message` | `TEXT` | No | None | Explanatory message body displayed with two-line clamp. |
| `type` | `"NotificationType"` | No | `'system'` | PostgreSQL Enum: `escalation`, `assignment`, `comment`, `status`, `sprint`, `system`. |
| `issueId` | `TEXT` | Yes | `NULL` | Foreign key referencing `Issue.id`. In this repository, `Issue.id` is the key string (e.g., `"INB-1001"`). |
| `read` | `BOOLEAN` | No | `false` | Read acknowledgment flag. |
| `createdAt` | `TIMESTAMP(3)` | No | `CURRENT_TIMESTAMP` | Microsecond-accurate creation timestamp for chronological sorting. |

### 3.3 Foreign Key & Cascade Guarantees

1. **User Deletion Cascade**:
   `CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`
   * When a user is deleted via `UsersModule`, all personal notifications are automatically deleted by PostgreSQL.
2. **Issue Deletion Cascade**:
   `CONSTRAINT "Notification_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE`
   * When an issue is deleted, all notifications referencing that issue are automatically purged by PostgreSQL, preventing dead navigation links.

### 3.4 Issue ID Verification Note

> [!IMPORTANT]
> In [`backend/prisma/schema.prisma`](file:///c:/Users/kirit/ticketing_tool/backend/prisma/schema.prisma#L190-L192), the `Issue` model defines:
> ```prisma
> model Issue {
>   id String @id // Format: "INB-1001"
>   ...
> }
> ```
> `Issue.id` **is** the human-readable formatted ticket key (`"<PROJECT_KEY>-<COUNTER>"`). The foreign key `Notification.issueId` directly stores and references this string. When creating notifications for issues, services pass `issue.id` (e.g., `"INB-1001"`).

---

## 4. Functional & Business Requirements

### 4.1 Functional Requirements Matrix

| ID | Requirement | Classification | Target Route / Method |
|---|---|---|---|
| **NOTIF-F01** | Return chronologically sorted notifications feed (`createdAt DESC`) for calling user. | Approved Requirement | `GET /api/notifications` |
| **NOTIF-F02** | Enforce strict user scoping (`where: { userId: req.user.id }`). | Approved Requirement | `GET /api/notifications` |
| **NOTIF-F03** | Support unread-only filtering via query parameter. | Proposed Decision | `GET /api/notifications?unreadOnly=true` |
| **NOTIF-F04** | Support query limit capping (min 1, max 100, default 50). | Proposed Decision | `GET /api/notifications?limit=50` |
| **NOTIF-F05** | Provide low-overhead unread count endpoint via PostgreSQL index scan. | Proposed Decision | `GET /api/notifications/unread-count` |
| **NOTIF-F06** | Mark single notification as read by CUID for owning user. | Approved Requirement | `PATCH /api/notifications/:id/read` |
| **NOTIF-F07** | Return `404 Not Found` if notification does not exist or belongs to another user. | Approved Requirement | `PATCH /api/notifications/:id/read` |
| **NOTIF-F08** | Idempotent mark-as-read: re-marking read item returns `200 OK` with `read: true`. | Approved Requirement | `PATCH /api/notifications/:id/read` |
| **NOTIF-F09** | Mark all unread notifications for calling user read in a single atomic update. | Approved Requirement | `POST /api/notifications/mark-all-read` |
| **NOTIF-F10** | Export programmatic service method `createNotification()` accepting optional `tx`. | Approved Requirement | `NotificationsService.createNotification()` |
| **NOTIF-F11** | Suppress self-notifications when actor equals recipient. | Proposed Decision | `NotificationsService.createNotification()` |

### 4.2 Notification Event Triggers

| Event Trigger | Producer Module | Implementation Status | Recipient (`userId`) | `type` | Title Template | Content Template |
|---|---|:---:|---|---|---|---|
| **Issue Assigned** | `IssuesModule` | Planned (Phase 3) | `issue.assigneeId` | `assignment` | `"Issue Assigned"` | `"You were assigned to {issueId}: {title}"` |
| **Issue Reassigned** | `IssuesModule` | Planned (Phase 3) | New `issue.assigneeId` | `assignment` | `"Issue Reassigned"` | `"Assigned to you by {actorName}"` |
| **Support Escalation** | `IssuesModule` | Planned (Phase 3) | `toAgentId` or Project Lead | `escalation` | `"Ticket Escalated to {toLevel}"` | `"{issueId} has been escalated to your queue ({toLevel}). Reason: {reason}"` |
| **Comment Posted** | `CommentsModule` | Planned (Phase 4) | Assignee & Reporter | `comment` | `"New Comment on {issueId}"` | `"{authorName} commented on {issueId}: {snippet}"` |
| **Status Changed** | `IssuesModule` | Planned (Phase 3) | Assignee & Reporter | `status` | `"Status Changed: {issueId}"` | `"{issueId} moved from {oldStatus} to {newStatus}"` |
| **Sprint Started** | `SprintsModule` | **Implemented** | Project Lead & Members | `sprint` | `"Sprint Started: {sprintName}"` | `"{sprintName} has begun in project {projectKey}."` |
| **Sprint Completed** | `SprintsModule` | **Implemented** | Project Lead & Members | `sprint` | `"Sprint Completed: {sprintName}"` | `"{sprintName} has been closed. {count} tickets rolled over."` |

---

## 5. REST API Specification

### 5.1 Endpoint Summary Table

| Method | Route | Status | Auth | Roles | Success |
|---|---|---|:---:|:---:|---|
| `GET` | `/api/notifications` | Approved | JWT | All Roles | `200 OK` (`Notification[]`) |
| `GET` | `/api/notifications/unread-count` | Proposed | JWT | All Roles | `200 OK` (`{ count: number }`) |
| `PATCH` | `/api/notifications/:id/read` | Approved | JWT | All Roles (Owner) | `200 OK` (`Notification`) |
| `POST` | `/api/notifications/mark-all-read` | Approved | JWT | All Roles | `200 OK` (`{ success: boolean, count: number }`) |

---

### 5.2 Detailed Endpoint Contracts

#### 1. `GET /api/notifications` (Approved)
* **Description**: Retrieves recent notifications for the authenticated user.
* **Headers**: `Authorization: Bearer <token>`
* **Query Parameters (`QueryNotificationsDto`)**:
  * `limit` (optional, integer, min: 1, max: 100, default: 50): Page size.
  * `unreadOnly` (optional, boolean, default: false): Filter unread items.
* **Response (`200 OK`)**:
  ```json
  [
    {
      "id": "cmvetk2p60001bkco44l5wc0i",
      "userId": "user-2",
      "title": "Ticket Escalated to L2",
      "message": "INB-1002 \"Payment API returns 500\" has been escalated from L1 to L2.",
      "type": "escalation",
      "issueId": "INB-1002",
      "read": false,
      "createdAt": "2026-10-19T05:30:00.000Z"
    },
    {
      "id": "cmvetk2pl0005bkco8fbq16un",
      "userId": "user-2",
      "title": "Issue Assigned",
      "message": "You were assigned to INB-1005: Update SSL Certificates",
      "type": "assignment",
      "issueId": "INB-1005",
      "read": true,
      "createdAt": "2026-10-19T04:15:00.000Z"
    }
  ]
  ```

#### 2. `GET /api/notifications/unread-count` (Proposed)
* **Description**: Returns integer count of unread notifications for the calling user.
* **Headers**: `Authorization: Bearer <token>`
* **Response (`200 OK`)**:
  ```json
  {
    "count": 1
  }
  ```

#### 3. `PATCH /api/notifications/:id/read` (Approved)
* **Description**: Marks a single notification as read.
* **Headers**: `Authorization: Bearer <token>`
* **Path Parameters**:
  * `id`: CUID of the notification.
* **Response (`200 OK`)**:
  ```json
  {
    "id": "cmvetk2p60001bkco44l5wc0i",
    "userId": "user-2",
    "title": "Ticket Escalated to L2",
    "message": "INB-1002 \"Payment API returns 500\" has been escalated from L1 to L2.",
    "type": "escalation",
    "issueId": "INB-1002",
    "read": true,
    "createdAt": "2026-10-19T05:30:00.000Z"
  }
  ```
* **Error Responses**:
  * `401 Unauthorized`: Token missing or expired.
  * `404 Not Found`: Notification does not exist or belongs to another user.

#### 4. `POST /api/notifications/mark-all-read` (Approved)
* **Description**: Marks all unread notifications for the calling user as read.
* **Headers**: `Authorization: Bearer <token>`
* **Status Code**: `@HttpCode(HttpStatus.OK)` (`200 OK`).
* **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "count": 3
  }
  ```

---

## 6. Security, Isolation & Error Envelopes

### 6.1 Authentication via `JwtAuthGuard`

Controllers apply `@UseGuards(JwtAuthGuard)` at the class level. Requests lacking valid credentials return the verified repository error:

```json
{
  "statusCode": 401,
  "message": "Authentication required. Missing, invalid, or expired token.",
  "error": "UnauthorizedException",
  "timestamp": "2026-10-19T06:15:00.000Z",
  "path": "/api/notifications"
}
```

### 6.2 Cross-User Access & Enumeration Prevention

When User A attempts to mutate a notification belonging to User B:

```typescript
const notification = await this.prisma.notification.findUnique({
  where: { id },
});

if (!notification || notification.userId !== currentUserId) {
  // Always throw NotFoundException to prevent ID probing across users
  throw new NotFoundException(`Notification with identifier ${id} not found.`);
}
```

Response format generated by [`HttpExceptionFilter`](file:///c:/Users/kirit/ticketing_tool/backend/src/common/filters/http-exception.filter.ts):

```json
{
  "statusCode": 404,
  "message": "Notification with identifier cmvetk2p60001bkco44l5wc0i not found.",
  "error": "NotFoundException",
  "timestamp": "2026-10-19T06:15:00.000Z",
  "path": "/api/notifications/cmvetk2p60001bkco44l5wc0i/read"
}
```

---

## 7. Internal NestJS Implementation Blueprint

### 7.1 Target Folder Structure

```text
backend/src/notifications/
├── dto/
│   └── query-notifications.dto.ts
├── notifications.controller.ts
├── notifications.service.ts
└── notifications.module.ts
```

### 7.2 Service Implementation with Transaction Support

```typescript
// backend/src/notifications/notifications.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

export interface CreateNotificationDto {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  issueId?: string;
  actorId?: string; // Optional: used to suppress self-notifications
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string, query: QueryNotificationsDto): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = { userId };
    if (query.unreadOnly) {
      where.read = false;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit || 50,
    });
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
    return { count };
  }

  async markAsRead(id: string, currentUserId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== currentUserId) {
      throw new NotFoundException(`Notification with identifier ${id} not found.`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean; count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return {
      success: true,
      count: result.count,
    };
  }

  /**
   * Transaction-safe programmatic ingestion.
   * If tx is provided, inserts within caller's active database transaction.
   */
  async createNotification(
    data: CreateNotificationDto,
    tx?: Prisma.TransactionClient,
  ): Promise<Notification | null> {
    // Suppress self-notifications
    if (data.actorId && data.actorId === data.userId) {
      this.logger.debug(`Suppressed self-notification for user ${data.userId}`);
      return null;
    }

    const client = tx || this.prisma;
    return client.notification.create({
      data: {
        userId: data.userId,
        title: data.title.trim(),
        message: data.message.trim(),
        type: data.type || NotificationType.system,
        issueId: data.issueId || null,
        read: false,
      },
    });
  }
}
```

---

## 8. Frontend Integration Blueprint

### 8.1 API Client Implementation ([`frontend/src/services/api.ts`](file:///c:/Users/kirit/ticketing_tool/frontend/src/services/api.ts))

Add the type-safe API wrapper:

```typescript
export const notificationsApi = {
  /** Fetch notifications for authenticated user */
  listNotifications: async (params?: { limit?: number; unreadOnly?: boolean }): Promise<Notification[]> => {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.unreadOnly) query.append('unreadOnly', 'true');
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiRequest<Notification[]>(`/notifications${qs}`);
  },

  /** Get count of unread notifications */
  getUnreadCount: async (): Promise<{ count: number }> => {
    return apiRequest<{ count: number }>('/notifications/unread-count');
  },

  /** Mark single notification as read */
  markAsRead: async (id: string): Promise<Notification> => {
    return apiRequest<Notification>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    });
  },

  /** Mark all notifications as read */
  markAllAsRead: async (): Promise<{ success: boolean; count: number }> => {
    return apiRequest<{ success: boolean; count: number }>('/notifications/mark-all-read', {
      method: 'POST',
    });
  },
};
```

### 8.2 AppContext Lifecycle Connection & Session Safety ([`frontend/src/context/AppContext.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/context/AppContext.tsx))

1. **Session Bootstrapping & Multi-User Reset (`verifySession`)**:
   When the authenticated user changes, notifications must be purged and re-fetched to prevent data leaks between sessions:
   ```typescript
   try {
     const dbNotifications = await notificationsApi.listNotifications();
     if (Array.isArray(dbNotifications)) {
       setNotifications(dbNotifications);
       storage.saveNotifications(dbNotifications);
     }
   } catch (notifErr) {
     console.error('[Session Verification] Failed to fetch notifications from backend:', notifErr);
   }
   ```
2. **Optimistic Mutations with Rollback on Failure**:
   ```typescript
   const markNotificationRead = useCallback(async (id: string) => {
     const previous = [...notifications];
     // Optimistic update
     setNotifications(prev => {
       const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
       storage.saveNotifications(next);
       return next;
     });
     try {
       await notificationsApi.markAsRead(id);
     } catch (err) {
       console.error('Failed to sync notification read state, rolling back:', err);
       setNotifications(previous);
       storage.saveNotifications(previous);
       addToast('Update Failed', 'Could not mark notification as read.', 'error');
     }
   }, [notifications, addToast]);
   ```

---

## 9. Automated Testing Plan

When implementation begins, an automated test harness must be implemented at `backend/test/test_notifications.ts` adhering to the standard HTTP test pattern from [`backend/test/test_sprints.ts`](file:///c:/Users/kirit/ticketing_tool/backend/test/test_sprints.ts):

| Test ID | HTTP Method | Target Endpoint | Assertion Objective |
|---|---|---|---|
| **NOTIF-T01** | `GET` | `/api/notifications` | Rejects missing Bearer token with `401 Unauthorized`. |
| **NOTIF-T02** | `GET` | `/api/notifications` | Returns `200 OK` array for authenticated User A. |
| **NOTIF-T03** | `GET` | `/api/notifications` | User B receives zero records belonging to User A (Isolation). |
| **NOTIF-T04** | `GET` | `/api/notifications?unreadOnly=true` | Query parameter correctly filters only `read = false` items. |
| **NOTIF-T05** | `GET` | `/api/notifications/unread-count` | Returns accurate `{ count: N }`. |
| **NOTIF-T06** | `PATCH` | `/api/notifications/:id/read` | Owner marks item read; returns `200 OK` with `read: true`. |
| **NOTIF-T07** | `PATCH` | `/api/notifications/:id/read` | Idempotent mutation returns `200 OK` on already-read notification. |
| **NOTIF-T08** | `PATCH` | `/api/notifications/:id/read` | Non-owner receives `404 Not Found` (Anti-Enumeration). |
| **NOTIF-T09** | `POST` | `/api/notifications/mark-all-read` | Marks all unread items read; returns `{ success: true, count: N }`. |
| **NOTIF-T10** | `GET` | `/api/notifications/unread-count` | Returns `{ count: 0 }` following bulk mark-all-read. |
| **NOTIF-T11** | Database | Foreign Key Cascade | Deleting an `Issue` cascades and removes related notifications. |
| **NOTIF-T12** | Database | Transaction Safety | Transaction rollback leaves zero orphaned notifications. |

> [!NOTE]
> Testing Status: Automated tests were executed using `npx ts-node test/test_notifications.ts` against the live NestJS backend and PostgreSQL database. All 32/32 assertions passed successfully, including authentication rejections, user isolation, idempotent reads, bulk updates, cascade deletion, sprint event triggers, and self-notification suppression.

---

## 10. Implementation Sequence & Acceptance Criteria

### 10.1 Execution Order

1. **Step 1**: Create Service: `backend/src/notifications/notifications.service.ts` (Done).
2. **Step 2**: Create Controller: `backend/src/notifications/notifications.controller.ts` (Done).
3. **Step 3**: Create Module: `backend/src/notifications/notifications.module.ts` (Done).
4. **Step 4**: Register in `backend/src/app.module.ts` (Done).
5. **Step 5**: Integrate with `backend/src/sprints/sprints.service.ts` for sprint events (Done).
6. **Step 6**: Implement and run `backend/test/test_notifications.ts` (32/32 Passed).
7. **Step 7**: Extend `frontend/src/services/api.ts` with `notificationsApi` (Done).
8. **Step 8**: Connect `frontend/src/context/AppContext.tsx` and `NotificationPanel.tsx` (Done).

### 10.2 Acceptance Criteria Checklist

- [x] `GET /api/notifications` returns user-scoped feed sorted by `createdAt DESC`.
- [ ] `GET /api/notifications/unread-count` [Proposed - deferred pending approval; computed client-side in UI].
- [x] `PATCH /api/notifications/:id/read` updates read status and returns `200 OK`.
- [x] `POST /api/notifications/mark-all-read` updates all unread items and returns `200 OK`.
- [x] Cross-user access returns `404 Not Found` to prevent account probing.
- [x] Unauthenticated calls return `401 Unauthorized`.
- [x] `NotificationsService.createNotification()` is exported and accepts `Prisma.TransactionClient`.
- [x] PostgreSQL foreign keys cascade cleanly when parent `User` or `Issue` is deleted.
- [x] Frontend Topbar bell icon accurately reflects unread status with real database data.
- [x] TypeScript compilers (`backend` and `frontend`) pass with zero errors.

---

## 11. Unresolved Questions & Architectural Decisions

1. **Notification Retention & Archival**:
   * *Question*: Should notifications older than 90 days be automatically pruned to prevent unbounded database growth?
   * *Status*: Retain indefinitely for initial release with default pagination limit (`take: 50`). An automated archival job in `SystemModule` is recommended if table size exceeds 100,000 rows.
2. **Workspace Notification Preferences Enforcement**:
   * *Question*: Should `NotificationsService` check `Settings.notifications` preferences before persisting notifications?
   * *Status*: Recommended for non-critical alerts (sprint ceremonies, comments). Critical security and escalation alerts bypass preference filters.

---

*Specification Document Reference: `NOTIFICATIONS_MODULE.md`*  
*Author: Senior Systems Architect (Antigravity)*  
*Platform: Ticketing Management Platform (Inbox / GoldMine Portal)*

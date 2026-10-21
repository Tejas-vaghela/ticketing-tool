# Attachments Module Specification

## Ticketing Management Platform (Inbox / GoldMine Portal)

---

## 1. Module Overview and Purpose

### 1.1 Purpose

This document establishes the authoritative, verified architectural specification for the **Attachments Module (`AttachmentsModule`)** in the **Ticketing Management Platform** (*Inbox / GoldMine Portal*).

The Attachments Module provides secure, scalable, and auditable file attachment capabilities for tickets across the support and development lifecycle. It enables customer support agents, engineers, and project managers to attach diagnostic assets—including error screenshots, HTTP archive traces (`.har`), server stack trace logs (`.log`), reproduction payloads (`.json`), specifications, and patch archives—directly to issues.

This specification is authored and audited against the existing architecture documents ([`BACKEND_ARCHITECTURE.md`](file:///c:/Users/kirit/ticketing_tool/BACKEND_ARCHITECTURE.md), [`docs/01_SYSTEM_ARCHITECTURE.md`](file:///c:/Users/kirit/ticketing_tool/docs/01_SYSTEM_ARCHITECTURE.md), [`docs/02_CODING_STANDARDS.md`](file:///c:/Users/kirit/ticketing_tool/docs/02_CODING_STANDARDS.md), [`docs/03_MODULE_IMPLEMENTATION.md`](file:///c:/Users/kirit/ticketing_tool/docs/03_MODULE_IMPLEMENTATION.md)), the Prisma database schema ([`backend/prisma/schema.prisma`](file:///c:/Users/kirit/ticketing_tool/backend/prisma/schema.prisma)), the existing authentication, user, and project modules in `backend/src/`, and the React 19 frontend SPA in `frontend/src/`.

### 1.2 System & Module Identity

| Property | Value | Verification Status |
|---|---|:---:|
| **System Name** | Ticketing Management Platform (Inbox / GoldMine Portal) | Verified |
| **Subsystem** | Backend REST API (`backend/`) | Verified |
| **Module Name** | `AttachmentsModule` | Proposed |
| **Backend Directory** | `backend/src/attachments/` (canonical pattern matching `auth/`, `users/`, `projects/`) | Proposed |
| **API Base Paths** | `/api/issues/:issueId/attachments` and `/api/attachments` | Proposed |
| **Technology Stack** | NestJS v10.x, TypeScript 5.x, PostgreSQL 16+, Prisma ORM v6.x, Express Multer / Stream | Verified in `backend/package.json` |
| **Backend HTTP Port** | `4000` (configurable via `PORT` environment variable) | Verified in `backend/.env` |
| **Frontend Dev Server** | `3000` (Vite dev server) | Verified in `frontend/package.json` |
| **Primary Frontend Consumers** | [`IssueDetailPage.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/pages/IssueDetailPage.tsx) (Attachments dropzone & list) | Verified |
| **Existing Frontend API Utilities** | `tokenStorage`, `API_BASE_URL`, `apiRequest` in [`frontend/src/services/api.ts`](file:///c:/Users/kirit/ticketing_tool/frontend/src/services/api.ts) | Verified Implemented |
| **Storage Architecture** | Dual-tier: PostgreSQL for relational metadata, local disk / S3-compatible storage for physical file binaries | Architecture Standard |

### 1.3 Core Objectives

1. **Storage Decoupling**: Maintain strict architectural separation between relational attachment metadata (filename, MIME type, size, upload timestamp) stored in PostgreSQL and physical binary content stored in the configured file storage engine.
2. **Issue Binding Integrity**: Bind every attachment to an authoritative issue record (`issueId`) with relational foreign key constraints and synchronized cascade cleanup.
3. **Safe Multipart Handling & Content Validation**: Ingest single-file uploads via `multipart/form-data` with streaming validation of file size limits (25 MB), extension checking, binary magic-number signatures for binary files, UTF-8/structural validation for text files, and treating client-supplied MIME types as strictly untrusted.
4. **Immediate Temporary Cleanup**: Immediately delete temporary or partially written files whenever uploads are rejected, validation fails, or database operations fail.
5. **Secure Binary Streaming**: Deliver attachments via authenticated download endpoints with RFC-compliant `Content-Disposition`, `Content-Type`, and `X-Content-Type-Options: nosniff` headers, preventing unauthorized public file exposure.
6. **Audit Trail Synchronization**: Automatically record `attachment_added` and `attachment_deleted` events in the system-wide [`ActivityEvent`](file:///c:/Users/kirit/ticketing_tool/backend/prisma/schema.prisma#L279-L295) audit log in the same atomic database transaction as metadata persistence.
7. **Graceful Storage Boundary**: Encapsulate file system storage behind an abstract storage provider (`StorageService` interface) to enable seamless transition from local disk (`backend/uploads/attachments/`) in development to S3/MinIO in production without rewriting controller logic.

---

## 2. Scope and Responsibilities

### 2.1 In-Scope Functionality

- **Single-File Multipart Upload (`POST /api/issues/:issueId/attachments`)**:
  - Ingestion of single-file payloads attached to a specific issue identifier via multipart field name `file`.
  - Alignment with the frontend's per-file upload loop (where multiple dropped files are uploaded sequentially).
  - Verification of parent issue existence prior to persisting file binary.
  - Streaming validation against maximum file size (25 MB) and blocked executable extensions.
  - Content signature inspection (magic numbers for binary files, UTF-8 encoding and structural checks for text files) to verify authenticity rather than trusting client headers.
  - Immediate unlinking of temporary files if validation or database insertion fails.
  - Storage of file binary onto persistent disk with unique, collision-proof storage keys (`{attachmentId}_{sanitizedFilename}`).
  - Insertion of `Attachment` metadata row and `ActivityEvent` audit row into PostgreSQL via an atomic Prisma transaction.
  - Emission of `attachment_added` event to `ActivityEvent`.
- **Attachment List Retrieval (`GET /api/issues/:issueId/attachments`)**:
  - Retrieval of all attachment metadata records associated with an issue, ordered chronologically (`uploadDate ASC`).
- **Attachment Metadata Retrieval (`GET /api/attachments/:id`)**:
  - Retrieval of a single attachment's metadata by its CUID.
- **Attachment Binary Download (`GET /api/attachments/:id/download`)**:
  - Authenticated streaming of the raw file binary with proper MIME headers, `nosniff`, and attachment disposition.
- **Attachment Deletion (`DELETE /api/issues/:issueId/attachments/:attachmentId`)**:
  - Verification that the attachment belongs to the specified `issueId`.
  - Atomic database deletion of the `Attachment` record and creation of `ActivityEvent` (`attachment_deleted`).
  - Subsequent physical removal of the associated binary from file storage, with structured warning logging if unlinking fails.
- **Future Cross-Module Issue Deletion Coordination**:
  - Specification of the required cross-module contract for `IssuesService.delete(id)` to delete all physical attachment files before executing database issue deletion.

### 2.2 Out-of-Scope Functionality

- **Inline Image Processing & Thumbnails**: Generation of thumbnails or dynamic image resizing (handled on client side or via external CDN).
- **In-Browser Document Rendering / Preview**: PDF or Office document previews are handled by the client application using native browser viewer plugins.
- **Public CDN Hosting**: Direct unauthenticated public URLs to raw attachment storage (all downloads must pass through authenticated backend proxy for enterprise data security).
- **Direct Database Binary Storage (BLOBs)**: PostgreSQL `BYTEA` storage of file binaries is explicitly prohibited.
- **Background Garbage Collection Worker**: No cron, queue, or worker currently exists in the codebase; any automated asynchronous orphan sweeper is documented strictly as a proposed future enhancement.

---

## 3. Functional Requirements

| ID | Requirement | Priority | Target Endpoint |
|---|---|---|---|
| **ATT-F01** | Any authenticated user with non-Viewer role can upload an attachment file up to 25 MB to an existing issue. | MUST | `POST /api/issues/:issueId/attachments` |
| **ATT-F02** | The system must reject files exceeding 25 MB (`26,214,400 bytes`) with HTTP `413 Payload Too Large`. | MUST | `POST /api/issues/:issueId/attachments` |
| **ATT-F03** | The system must reject executable or dangerous extensions (`.exe`, `.bat`, `.cmd`, `.sh`, `.vbs`, `.msi`, `.scr`, `.jar`, `.ps1`) with HTTP `415 Unsupported Media Type`. | MUST | `POST /api/issues/:issueId/attachments` |
| **ATT-F04** | Client-provided MIME types (`file.mimetype`) must be treated as untrusted user input. The system must inspect magic numbers for binary files and UTF-8/structural rules for text files, returning HTTP `415 Unsupported Media Type` on mismatch or spoofing. | MUST | `POST /api/issues/:issueId/attachments` |
| **ATT-F05** | Any temporary or partially written file created during an upload that is subsequently rejected (size limit, extension blacklist, content validation, missing parent issue, or database failure) must be immediately and synchronously unlinked from disk storage. | MUST | Internal `StorageService` |
| **ATT-F06** | Uploaded files must be saved with randomized, unique storage identifiers to prevent disk filename collisions and directory traversal attacks (`{attachmentId}_{sanitizedFilename}`). | MUST | Internal `StorageService` |
| **ATT-F07** | Uploading an attachment must persist metadata (`id`, `issueId`, `filename`, `fileType`, `fileSize`, `uploadDate`) in PostgreSQL. | MUST | `POST /api/issues/:issueId/attachments` |
| **ATT-F08** | Uploading an attachment must atomically create an audit entry in `ActivityEvent` referencing `action: "attachment_added"` with structured JSON details. If audit event creation fails, the entire database transaction aborts and the physical file is rolled back. | MUST | `POST /api/issues/:issueId/attachments` |
| **ATT-F09** | Any authenticated user can list all attachment metadata records for an issue. | MUST | `GET /api/issues/:issueId/attachments` |
| **ATT-F10** | Any authenticated user can download the raw attachment binary with `Content-Disposition: attachment`, accurate `Content-Type`, and `X-Content-Type-Options: nosniff`. | MUST | `GET /api/attachments/:id/download` |
| **ATT-F11** | Deletion authorization in current pre-migration schema: restricted exclusively to `Admin` and `Project_Manager` roles. Non-admin deletion requires the proposed `uploaderId` schema migration. | MUST | `DELETE /api/issues/:issueId/attachments/:attachmentId` |
| **ATT-F12** | Deleting an attachment must execute an atomic database transaction (`Attachment` deleted and `ActivityEvent` recorded), followed by unlinking the physical file. If filesystem unlinking fails, a structured warning log is recorded and HTTP 200 is returned. | MUST | `DELETE /api/issues/:issueId/attachments/:attachmentId` |
| **ATT-F13** | Deleting an attachment must create an audit entry in `ActivityEvent` referencing `action: "attachment_deleted"`. | MUST | `DELETE /api/issues/:issueId/attachments/:attachmentId` |
| **ATT-F14** | When an issue is deleted via future `IssuesService`, all physical attachment files bound to that issue must be deleted from storage before the issue database row is deleted (preventing PostgreSQL cascade deletion from wiping attachment metadata before files can be unlinked). | MUST | `IssuesModule` (Future Cross-Module Contract) |

---

## 4. Non-Functional Requirements

| Category | Requirement | Criteria |
|---|---|---|
| **Performance** | Non-blocking file streaming | File upload and download operations must stream chunks directly to/from disk/storage without buffering entire large files in Node.js heap memory. |
| **Storage Scalability** | Pluggable storage interface | Storage layer must be encapsulated behind an abstract `StorageService` contract enabling seamless swap from local disk (`backend/uploads/attachments/`) to AWS S3 / MinIO. |
| **Security** | Path traversal prevention | Original client filenames must never be used directly as disk paths; filenames must be strictly sanitized using regex and prefixed with CUIDs. |
| **Security** | Zero unauthenticated ingress | No attachment endpoint (metadata or binary) may be accessible without a valid JWT bearer token. Unauthenticated requests return `401 Unauthorized`. |
| **Security** | Untrusted MIME handling | Download endpoints must emit `X-Content-Type-Options: nosniff` and `Content-Disposition: attachment` to prevent stored XSS attacks via browser script execution. |
| **Data Integrity** | Cascade foreign keys | `Attachment.issueId` is backed by PostgreSQL foreign key constraint with `ON DELETE CASCADE`. |
| **Auditability** | Complete file event logging | All file uploads and deletions are permanently recorded in `ActivityEvent` with timestamps and acting `userId`. |
| **Error Format** | Uniform NestJS JSON envelope | All validation and runtime errors return standardized JSON: `{ statusCode, message, error, timestamp, path }`. |

---

## 5. Existing Frontend Implementation and Alignment

### 5.1 Issue Detail Page (`frontend/src/pages/IssueDetailPage.tsx`)

The frontend application features an attachment user interface in [`frontend/src/pages/IssueDetailPage.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/pages/IssueDetailPage.tsx) (lines 169–196, 440–535):

1. **File Input & Drag-and-Drop Dropzone**:
   - Dashed border drop area with hover and drag-over transitions (`isDraggingFile`).
   - Hidden file input `<input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} />`.
   - **Per-File Ingestion Loop**:
     - In lines 169–181, `handleFileUpload` iterates over `e.target.files` and calls `addAttachment` sequentially for each file.
     - In lines 183–196, `handleDrop` iterates over `e.dataTransfer.files` and calls `addAttachment` sequentially for each file.
   - **Single-File API Contract Alignment**: The backend endpoint `POST /api/issues/:issueId/attachments` expects a single file payload under field `file`. This design aligns with the frontend's sequential loop, allowing individual progress tracking and independent error toasts per file.
2. **Attachment Card Grid**:
   - Responsive two-column grid (`grid-cols-1 sm:grid-cols-2`).
   - File icon badge (`FileText`).
   - Truncated filename display (`att.filename`).
   - File metadata subtitle: formatted file size in KB (`Math.round(att.fileSize / 1024) KB`) and formatted upload date (`toLocaleDateString()`).
   - **Download Button (`Download` icon)**: Currently triggers simulation toast: `addToast('Downloading simulated attachment', att.filename, 'info')`. Requires wiring to `GET /api/attachments/:id/download`.
   - **Delete Button (`Trash2` icon)**: Triggers `deleteAttachment(issue.id, att.id)` which removes the item and displays a notification toast.

### 5.2 Application Context State (`frontend/src/context/AppContext.tsx`)

In [`frontend/src/context/AppContext.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/context/AppContext.tsx) (lines 632–684):

- `addAttachment(issueId, file)`: Generates mock ID (`att-${Date.now()}`), appends metadata to `issue.attachments` array in memory, writes to `localStorage` via `storage.saveIssues(next)`, logs activity via `logActivity`, and adds a success toast.
- `deleteAttachment(issueId, attachmentId)`: Filters out the attachment from `issue.attachments`, updates `localStorage`, and displays a toast.

### 5.3 Type Definitions (`frontend/src/types/index.ts`)

In [`frontend/src/types/index.ts`](file:///c:/Users/kirit/ticketing_tool/frontend/src/types/index.ts) (lines 50–57):

```typescript
export interface Attachment {
  id: string;
  issueId: string;
  filename: string;
  fileType: string;
  fileSize: number; // in bytes
  uploadDate: string;
}
```

The frontend `Attachment` interface matches the PostgreSQL schema columns in `backend/prisma/schema.prisma`.

### 5.4 Verified Frontend Services (`frontend/src/services/api.ts`)

Inspection of [`frontend/src/services/api.ts`](file:///c:/Users/kirit/ticketing_tool/frontend/src/services/api.ts) confirms that the core API infrastructure is **already implemented**:
- **Base URL**: `API_BASE_URL` configured from `import.meta.env.VITE_API_BASE_URL` with fallback to `http://localhost:4000/api` (lines 3–4).
- **Token Storage**: `tokenStorage` object (`getToken`, `setToken`, `clearToken`) operating on `localStorage` key `inbox_auth_token` (lines 8–30).
- **Generic Request Client**: `apiRequest<T>(endpoint, options)` with automatic JWT header injection and error unwrapping (lines 58–96).
- **Attachments API Wrapper**: Currently **not implemented** in `api.ts`; proposed for addition in Phase 6.

---

## 6. Current Implementation Status

| Layer | Feature / Component | Status | Details |
|---|---|:---:|---|
| **Database** | Prisma Model `Attachment` | **Implemented** | Defined in `schema.prisma` lines 267–277 (`id`, `issueId`, `filename`, `fileType`, `fileSize`, `uploadDate`). Foreign key `Issue.id` with `onDelete: Cascade`. |
| **Database** | PostgreSQL Table Persistence | **Verified Empty** | Table `Attachment` exists in database with 0 records. |
| **Database** | `uploaderId` Column | **Not Implemented** | Does not exist in current Prisma schema; documented as a proposed schema migration. |
| **Backend** | `AttachmentsModule` | **Not Implemented** | Directory `backend/src/attachments/` does not exist. |
| **Backend** | Controllers & Routes | **Not Implemented** | No REST endpoints exist for attachment operations. |
| **Backend** | File Storage Service | **Not Implemented** | No storage provider or disk upload directory exists. |
| **Backend** | Multer Dependencies | **Not Implemented** | `@types/multer` is not installed; no interceptor configured. |
| **Backend** | `IssuesModule` & `IssuesService` | **Not Implemented** | Directory `backend/src/issues/` does not exist yet; cross-module cascade deletion contract is defined herein. |
| **Backend** | Background Cleanup Worker | **Not Implemented** | No queue or cron worker exists in backend; proposed as a future enhancement. |
| **Frontend** | Dropzone UI & Cards | **Implemented** | Interactive drag-and-drop dropzone and attachment card grid exist in `IssueDetailPage.tsx`. |
| **Frontend** | API Utilities & Token Storage | **Implemented** | `tokenStorage`, `API_BASE_URL`, and `apiRequest` are implemented in `frontend/src/services/api.ts`. |
| **Frontend** | `attachmentsApi` Client | **Not Implemented** | Proposed for implementation in `frontend/src/services/api.ts`. |
| **Frontend** | File Download Handler | **Simulated** | Displays info toast `"Downloading simulated attachment"`. |
| **Frontend** | State Persistence | **Simulated** | Stored in browser `localStorage` via `AppContext.tsx`. |
| **Integration** | End-to-End Flow | **Not Implemented** | Frontend and backend are not connected for attachments. |

---

## 7. Supported Attachment Operations

| Operation | Method & URI | Authorization Required | Primary Action |
|---|---|---|---|
| **Upload Attachment** | `POST /api/issues/:issueId/attachments` | Authenticated (non-Viewer) | Ingests single file binary, validates size/content, writes to disk, persists metadata in PostgreSQL, and logs `attachment_added`. |
| **List Attachments** | `GET /api/issues/:issueId/attachments` | Authenticated (all roles) | Queries PostgreSQL for all attachments belonging to `issueId` ordered by `uploadDate ASC`. |
| **Get Metadata** | `GET /api/attachments/:id` | Authenticated (all roles) | Retrieves single `Attachment` metadata record by CUID. |
| **Download Binary** | `GET /api/attachments/:id/download` | Authenticated (all roles) | Streams binary file with `Content-Disposition: attachment; filename="..."` and `nosniff`. |
| **Delete Attachment** | `DELETE /api/issues/:issueId/attachments/:attachmentId` | Admin / Project Manager (Pre-Migration) | Deletes DB record, unlinks physical file from storage, and logs `attachment_deleted`. |

---

## 8. Database Models and Relationships

### 8.1 Existing Prisma Schema Models

From [`backend/prisma/schema.prisma`](file:///c:/Users/kirit/ticketing_tool/backend/prisma/schema.prisma) (lines 48–57, 267–294):

```prisma
enum UserRole {
  Admin
  Project_Manager @map("Project Manager")
  Developer
  QA
  Support_Agent   @map("Support Agent")
  Technical
  Engineer
  Viewer
}

model Attachment {
  id         String   @id @default(cuid())
  issueId    String
  issue      Issue    @relation(fields: [issueId], references: [id], onDelete: Cascade)
  filename   String
  fileType   String
  fileSize   Int      // bytes
  uploadDate DateTime @default(now())

  @@index([issueId])
}

model ActivityEvent {
  id        String   @id @default(cuid())
  issueId   String?
  issue     Issue?   @relation(fields: [issueId], references: [id], onDelete: Cascade)
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  action    String
  details   String
  timestamp DateTime @default(now())

  @@index([issueId])
  @@index([projectId])
  @@index([timestamp])
}
```

### 8.2 Attachment Ownership Resolution

#### The Architectural Problem
The current `Attachment` table does **not** contain an `uploaderId` foreign key to `User`. The desired operational policy is that non-admin users should only be permitted to delete their own uploaded files.

#### Analysis of Alternative Solutions
1. **Relying on ActivityEvent string matching (REJECTED)**:
   - Querying `ActivityEvent` where `action = 'attachment_added'` and matching `details` or `filename` is non-authoritative and fragile:
     - Filenames are not unique across uploads.
     - The `details` field is freeform human-readable text.
     - Activity events can be pruned or archived independently of ticket records.
   - Therefore, filename string matching in `ActivityEvent` **MUST NOT** be used as an authoritative authorization mechanism.

2. **Proposed Schema Change (Target Architecture - Requires Approval)**:
   - When the next database migration is formally approved, add `uploaderId` directly to `model Attachment`:
     ```prisma
     model Attachment {
       id         String   @id @default(cuid())
       issueId    String
       issue      Issue    @relation(fields: [issueId], references: [id], onDelete: Cascade)
       uploaderId String
       uploader   User     @relation("UploadedAttachments", fields: [uploaderId], references: [id], onDelete: Restrict)
       filename   String
       fileType   String
       fileSize   Int      // bytes
       uploadDate DateTime @default(now())

       @@index([issueId])
       @@index([uploaderId])
     }
     ```
   - This change requires formal stakeholder sign-off and a database migration script prior to execution.

3. **Interim Enforcement Policy (Current Pre-Migration Baseline)**:
   - Until the proposed schema migration is approved and applied:
     - Attachment deletion is restricted exclusively to **`Admin`** and **`Project_Manager`** roles.
     - Non-admin team members (`Developer`, `QA`, `Support_Agent`, `Technical`, `Engineer`) cannot delete attachments directly.
     - During upload, an `ActivityEvent` is logged containing structured JSON details `{ "attachmentId": attachment.id, "filename": attachment.filename, "uploaderId": currentUser.id }` for administrative audit inspection.

### 8.3 Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    PROJECT ||--o{ ISSUE : contains
    USER ||--o{ ISSUE : reports_or_assigned
    ISSUE ||--o{ ATTACHMENT : has
    ISSUE ||--o{ COMMENT : has
    ISSUE ||--o{ ACTIVITY_EVENT : logs
    USER ||--o{ ACTIVITY_EVENT : initiates

    ATTACHMENT {
        string id PK
        string issueId FK
        string filename
        string fileType
        int fileSize
        DateTime uploadDate
    }

    ISSUE {
        string id PK
        string title
        string projectId FK
        string reporterId FK
        string assigneeId FK
        string status
    }

    ACTIVITY_EVENT {
        string id PK
        string issueId FK
        string userId FK
        string action
        string details
        DateTime timestamp
    }
```

---

## 9. File Storage Architecture & Cleanup Protocol

### 9.1 Storage Separation Principle

To guarantee system resilience, performance, and database scalability, binary files are **never** stored inside PostgreSQL. Relational tables store only metadata.

```mermaid
flowchart TD
    Client["Client Browser (React 19 SPA)"]
    Controller["NestJS AttachmentsController (Size and Ext Check)"]
    DiskStorage[("Local Disk Storage backend/uploads/attachments/")]
    Database[("PostgreSQL Database Attachment Table")]

    Client -->|"1. POST /api/issues/:issueId/attachments (multipart field: file)"| Controller
    Controller -->|"2. Stream Binary to Disk ({attachmentId}_{sanitizedFilename})"| DiskStorage
    Controller -->|"3. Persist Metadata Record (id, issueId, filename, fileType, fileSize)"| Database
```

### 9.2 Physical Storage Path & Key Convention

For local development and on-premise deployments:
- **Base Storage Directory**: `backend/uploads/attachments/` (relative to backend root, configurable via `ATTACHMENTS_STORAGE_DIR`).
- **Disk Filename Format**: `{attachmentId}_{sanitizedFilename}`
  - Example: `cmv81x9a0001bk09z8x7y6w5_error_traceback.log`
  - Sanitization rules: Replace any character matching `[^a-zA-Z0-9._-]` with an underscore (`_`), strip any leading path components (`../`, `/`, `\`), and truncate filename to 100 characters maximum.
- **Benefits**:
  - Eliminates filename collisions when multiple users upload files with identical names.
  - Eliminates directory traversal attacks (`../../etc/passwd`).
  - Preserves original human-readable extension for server-side inspection.

### 9.3 Failure Recovery & Storage Consistency

Maintaining consistency between PostgreSQL and physical storage requires addressing the fundamental architectural boundary between relational database transactions and filesystem operations:

#### 1. Limitations of Database Transactions vs. Filesystem Operations
- **PostgreSQL ACID Boundary**: Database transactions guarantee Atomicity, Consistency, Isolation, and Durability *within* PostgreSQL. Filesystem operations (`fs.promises.unlink`, `fs.promises.writeFile`) are completely external to the database engine.
- **Irreversible Filesystem Mutations**: If a physical file is deleted from the filesystem, it cannot be resurrected if a subsequent database statement fails. Conversely, once a database transaction commits, PostgreSQL cannot automatically roll back committed rows if an OS filesystem unlinking call throws an I/O error.
- **Chosen Sequence for Deletion ("Database First, Filesystem Second")**:
  - In `DELETE /api/issues/:issueId/attachments/:attachmentId`, the relational records (`Attachment` row and `ActivityEvent` audit entry) are committed inside an atomic Prisma transaction (`prisma.$transaction`) **before** physical unlinking is attempted.
  - *Rationale*: A metadata record pointing to a missing binary causes broken downloads and user-facing 500/404 errors. Conversely, an orphaned file on disk without a database record does not corrupt data integrity or break UI workflows; it represents minor storage overhead.
  - *Failure Handling*: If the subsequent `fs.promises.unlink()` fails (e.g., file lock, permissions, or pre-existing deletion), the service emits a structured administrative log entry:
    ```
    [STORAGE_ORPHAN_WARNING] Failed to unlink physical file after database deletion.
    Attachment ID: ${attachmentId}, Issue ID: ${issueId}, Path: ${filePath}, Reason: ${error.message}
    ```
  - The controller still returns HTTP `200 OK` (`{ message: "...", id: "..." }`) because relationally, the attachment has been completely removed from the issue.

#### 2. Upload Failure Recovery (Synchronous Rollback)
- **Upload Sequencing**:
  1. Multer streams the file to a temporary or final path on disk.
  2. Content and size validations are performed.
  3. Parent issue existence is verified.
  4. An atomic Prisma transaction commits both the `Attachment` row and the `ActivityEvent` row.
- **Failure Rollback**:
  - If content validation fails, the parent issue is not found, or `prisma.$transaction()` throws an error (e.g., unique constraint violation or database timeout):
  - The service `catch` block **MUST** immediately and synchronously unlink the file from disk using `fs.promises.unlink(filePath)`.
  - The controller rethrows the exception, returning the appropriate HTTP status code (`400`, `404`, `415`, or `500`).

#### 3. Audit Event Consistency
- Both metadata insertion (`prisma.attachment.create()`) and audit logging (`prisma.activityEvent.create()`) are enclosed within a single atomic database transaction:
  ```typescript
  const [attachment] = await this.prisma.$transaction([
    this.prisma.attachment.create({ data: attachmentData }),
    this.prisma.activityEvent.create({ data: auditData }),
  ]);
  ```
- If the audit event write fails, the entire database transaction rolls back, preventing dangling attachment rows without audit trails. The service catch block unlinks the physical binary, ensuring complete consistency across storage, relational data, and audit logs.

#### 4. Absence of Background Cleanup Worker
- Verification of `backend/package.json` confirms that **no background queue (e.g., BullMQ) or scheduler (`@nestjs/schedule`) exists** in the repository.
- Therefore, automatic background garbage collection does not exist today.
- *Proposed Recovery Mechanism*: A standalone storage reconciliation script or scheduled maintenance task is proposed for future architecture phases to sweep the uploads directory and purge files whose attachment IDs no longer exist in PostgreSQL.

### 9.4 Issue Deletion & Cross-Module Cleanup Contract

#### The Cross-Module Challenge
In `backend/prisma/schema.prisma`, the relation between `Issue` and `Attachment` is configured with `onDelete: Cascade`. When an issue is deleted via PostgreSQL, all associated `Attachment` database rows are deleted automatically by the database engine. However, **PostgreSQL cannot delete physical files on disk**. If `prisma.issue.delete()` is executed first, the attachment metadata is deleted before the file paths can be retrieved, leaving orphaned binaries on disk.

#### Required Cross-Module Workflow
When `IssuesModule` and `IssuesService` are implemented in `backend/src/`:
1. `IssuesService.delete(id)` **MUST NOT** directly execute `prisma.issue.delete()` without coordinating with storage.
2. Before deleting the issue record, `IssuesService` must query all attachments belonging to the issue:
   ```typescript
   const attachments = await this.prisma.attachment.findMany({
     where: { issueId: id },
     select: { id: true, filename: true },
   });
   ```
3. `IssuesService` must invoke `AttachmentsService.deleteFilesForIssue(attachments)` (or iterate and unlink each physical file via `StorageService`).
4. Once all physical files are unlinked (or logged on error), `IssuesService` executes `prisma.issue.delete({ where: { id } })`, triggering database cascade deletion cleanly.
5. **Boundary Note**: The Issues Module source code is not yet implemented in `backend/src/`. This contract constitutes a mandatory cross-module implementation requirement.

---

## 10. API Endpoint Specifications

All endpoints require a valid JWT Bearer token passed in the `Authorization: Bearer <token>` header.

| No. | Method | Endpoint | Purpose | Required Roles | Request Body / Params | Response Type | Status Codes | Status |
|---|---|---|---|---|---|---|:---:|:---:|
| 1 | `POST` | `/api/issues/:issueId/attachments` | Upload a single attachment to an issue | Admin, Project_Manager, Developer, QA, Support_Agent, Technical, Engineer | `multipart/form-data` (field: `file`) | `AttachmentResponseDto` | `201`, `400`, `401`, `403`, `404`, `413`, `415` | **Proposed** |
| 2 | `GET` | `/api/issues/:issueId/attachments` | List all attachments for an issue | All authenticated roles | None (Param: `issueId`) | `AttachmentResponseDto[]` | `200`, `401`, `404` | **Proposed** |
| 3 | `GET` | `/api/attachments/:id` | Get single attachment metadata | All authenticated roles | None (Param: `id`) | `AttachmentResponseDto` | `200`, `401`, `404` | **Proposed** |
| 4 | `GET` | `/api/attachments/:id/download` | Stream attachment binary for download | All authenticated roles | None (Param: `id`) | Binary Stream (`application/octet-stream`) | `200`, `401`, `404` | **Proposed** |
| 5 | `DELETE` | `/api/issues/:issueId/attachments/:attachmentId` | Delete attachment and physical binary | Admin, Project_Manager (Pre-Migration) | None (Params: `issueId`, `attachmentId`) | `{ message: string, id: string }` | `200`, `401`, `403`, `404` | **Proposed** |

---

## 11. Request and Response Examples

### 11.1 `POST /api/issues/:issueId/attachments` (Upload Single File)

#### Request
```http
POST /api/issues/INB-1001/attachments HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="file"; filename="traceback.log"
Content-Type: text/plain

[ERROR 2026-10-14 17:30:00] Stripe webhook signature mismatch at line 42...
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

#### Success Response (`201 Created`)
```json
{
  "id": "cmv81y01a0001bk09z8x7y6w5",
  "issueId": "INB-1001",
  "filename": "traceback.log",
  "fileType": "text/plain",
  "fileSize": 14200,
  "uploadDate": "2026-10-14T12:00:00.000Z"
}
```

#### Missing File Payload (`400 Bad Request`)
```json
{
  "statusCode": 400,
  "message": "File is required. Multipart field name must be 'file'.",
  "error": "Bad Request",
  "timestamp": "2026-10-14T12:00:00.000Z",
  "path": "/api/issues/INB-1001/attachments"
}
```

#### File Size Exceeded (`413 Payload Too Large`)
```json
{
  "statusCode": 413,
  "message": "File size exceeds maximum permitted limit of 25MB (26214400 bytes).",
  "error": "Payload Too Large",
  "timestamp": "2026-10-14T12:00:00.000Z",
  "path": "/api/issues/INB-1001/attachments"
}
```

#### Disallowed File Type or Content Mismatch (`415 Unsupported Media Type`)
```json
{
  "statusCode": 415,
  "message": "File extension .exe is disallowed for security policies.",
  "error": "Unsupported Media Type",
  "timestamp": "2026-10-14T12:00:00.000Z",
  "path": "/api/issues/INB-1001/attachments"
}
```

#### Target Issue Not Found (`404 Not Found`)
```json
{
  "statusCode": 404,
  "message": "Issue with identifier INB-9999 not found.",
  "error": "NotFoundException",
  "timestamp": "2026-10-14T12:00:00.000Z",
  "path": "/api/issues/INB-9999/attachments"
}
```

---

### 11.2 `GET /api/issues/:issueId/attachments` (List Attachments)

#### Request
```http
GET /api/issues/INB-1001/attachments HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Success Response (`200 OK`)
```json
[
  {
    "id": "cmv81y01a0001bk09z8x7y6w5",
    "issueId": "INB-1001",
    "filename": "traceback.log",
    "fileType": "text/plain",
    "fileSize": 14200,
    "uploadDate": "2026-10-14T12:00:00.000Z"
  },
  {
    "id": "cmv81y02b0002bk09z8x7y6w6",
    "issueId": "INB-1001",
    "filename": "error_screen.png",
    "fileType": "image/png",
    "fileSize": 384500,
    "uploadDate": "2026-10-14T12:05:00.000Z"
  }
]
```

---

### 11.3 `GET /api/attachments/:id` (Get Attachment Metadata)

#### Request
```http
GET /api/attachments/cmv81y01a0001bk09z8x7y6w5 HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Success Response (`200 OK`)
```json
{
  "id": "cmv81y01a0001bk09z8x7y6w5",
  "issueId": "INB-1001",
  "filename": "traceback.log",
  "fileType": "text/plain",
  "fileSize": 14200,
  "uploadDate": "2026-10-14T12:00:00.000Z"
}
```

---

### 11.4 `GET /api/attachments/:id/download` (Download Binary)

#### Request
```http
GET /api/attachments/cmv81y01a0001bk09z8x7y6w5/download HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Success Response (`200 OK`)
```http
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Disposition: attachment; filename="traceback.log"
Content-Length: 14200
X-Content-Type-Options: nosniff
Cache-Control: private, max-age=3600

[Binary Stream / Raw File Data]
```

---

### 11.5 `DELETE /api/issues/:issueId/attachments/:attachmentId` (Delete Attachment)

#### Request
```http
DELETE /api/issues/INB-1001/attachments/cmv81y01a0001bk09z8x7y6w5 HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Success Response (`200 OK`)
```json
{
  "message": "Attachment traceback.log permanently deleted.",
  "id": "cmv81y01a0001bk09z8x7y6w5"
}
```

---

## 12. DTOs and Validation Rules

All DTOs reside in `backend/src/attachments/dto/` and strictly use `class-validator` and `class-transformer` decorators per [`docs/02_CODING_STANDARDS.md`](file:///c:/Users/kirit/ticketing_tool/docs/02_CODING_STANDARDS.md).

### 12.1 `AttachmentResponseDto` (`backend/src/attachments/dto/attachment-response.dto.ts`)

```typescript
export class AttachmentResponseDto {
  id!: string;
  issueId!: string;
  filename!: string;
  fileType!: string;
  fileSize!: number;
  uploadDate!: Date;
}
```

### 12.2 `CreateAttachmentDto` (`backend/src/attachments/dto/create-attachment.dto.ts`)

Used for programmatic metadata verification prior to database insertion:

```typescript
import { IsString, IsNotEmpty, IsInt, Min, Max, MaxLength } from 'class-validator';

export class CreateAttachmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Filename must not be empty' })
  @MaxLength(255, { message: 'Filename must not exceed 255 characters' })
  filename!: string;

  @IsString()
  @IsNotEmpty({ message: 'fileType must not be empty' })
  @MaxLength(100, { message: 'fileType must not exceed 100 characters' })
  fileType!: string;

  @IsInt({ message: 'fileSize must be an integer' })
  @Min(1, { message: 'fileSize must be at least 1 byte' })
  @Max(26214400, { message: 'fileSize must not exceed 25MB (26214400 bytes)' })
  fileSize!: number;
}
```

---

## 13. Authentication and Authorization Architecture

1. **JWT Verification**: Every attachment route requires a valid Bearer token in the `Authorization` header.
2. **Guards Applied**: `@UseGuards(JwtAuthGuard, RolesGuard)` is configured on the controller or routes.
3. **Session Hydration**: The passport strategy extracts JWT claims (`sub`, `email`, `role`, `supportLevels`) and populates `request.user`.
4. **Current User Extraction**: In service operations (e.g., logging `ActivityEvent`), the acting user's ID is captured using `@CurrentUser()`.

---

## 14. Role-Based Access Control (RBAC) Matrix

The platform defines 8 user roles in `backend/prisma/schema.prisma` and `frontend/src/services/rbac.ts`. The table below specifies permitted operations per role:

| System Role (`UserRole`) | `GET` List | `GET` Metadata | `GET` Download | `POST` Upload | `DELETE` (Pre-Migration Policy) | `DELETE` (With Proposed Schema Migration) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Admin** | Allowed | Allowed | Allowed | Allowed | Allowed (Any) | Allowed (Any) |
| **Project Manager** (`Project_Manager`) | Allowed | Allowed | Allowed | Allowed | Allowed (Any) | Allowed (Any) |
| **Developer** | Allowed | Allowed | Allowed | Allowed | Denied (`403`)* | Allowed (Own attachment only) |
| **QA** | Allowed | Allowed | Allowed | Allowed | Denied (`403`)* | Allowed (Own attachment only) |
| **Support Agent** (`Support_Agent`) | Allowed | Allowed | Allowed | Allowed | Denied (`403`)* | Allowed (Own attachment only) |
| **Technical** | Allowed | Allowed | Allowed | Allowed | Denied (`403`)* | Allowed (Own attachment only) |
| **Engineer** | Allowed | Allowed | Allowed | Allowed | Denied (`403`)* | Allowed (Own attachment only) |
| **Viewer** | Allowed | Allowed | Allowed | Denied (`403`) | Denied (`403`) | Denied (`403`) |

> `*` **Pre-Migration Deletion Restriction**:
> Because the current PostgreSQL `Attachment` table lacks an `uploaderId` column, deletion is strictly restricted to `Admin` and `Project_Manager` until the proposed schema migration is approved and applied. Non-admin roles receive HTTP `403 Forbidden`.

---

## 15. File Validation and Security Policies

### 15.1 Maximum File Size
- **Single File Hard Limit**: **25 MB** (`26,214,400 bytes`) per individual file.
- Enforced at two layers:
  1. Multer streaming middleware (`limits: { fileSize: 25 * 1024 * 1024 }`).
  2. DTO validation rule (`@Max(26214400)`).

### 15.2 Blocked File Extensions (Blacklist)
To protect internal enterprise environments against executable malware and scripts, the following extensions are strictly forbidden:
- **Executable Binaries**: `.exe`, `.msi`, `.dll`, `.so`, `.dylib`, `.bin`, `.com`, `.scr`
- **Shell & Script Files**: `.sh`, `.bash`, `.bat`, `.cmd`, `.ps1`, `.vbs`, `.vbe`, `.js`, `.jse`, `.wsf`, `.wsh`
- **Package Archives with Executables**: `.jar`

### 15.3 Supported File Types & Content Validation Strategy

Client-supplied `Content-Type` headers (`file.mimetype`) are **untrusted user input**. Validation must inspect the actual content of the file. Because different file types have fundamentally different internal structures, the validation strategy is divided into two distinct methodologies:

#### Category 1: Binary Formats (Magic-Number Signature Inspection)
For binary formats, the initial byte sequence (magic number) must match the declared file extension:
- **PNG**: `89 50 4E 47 0D 0A 1A 0A` (8-byte signature)
- **JPEG / JPG**: `FF D8 FF`
- **GIF**: `47 49 46 38 37 61` (`GIF87a`) or `47 49 46 38 39 61` (`GIF89a`)
- **WebP**: `52 49 46 46` (`RIFF`) with offset 8 `57 45 42 50` (`WEBP`)
- **PDF**: `%PDF` (`25 50 44 46`)
- **ZIP / Office OpenXML (`.docx`, `.xlsx`, `.pptx`)**: `PK\x03\x04` (`50 4B 03 04`)
- **GZIP (`.gz`, `.tar.gz`)**: `1F 8B`
- **7-Zip (`.7z`)**: `37 7A BC AF 27 1C`
- **TAR**: POSIX tar header magic `ustar` (`75 73 74 61 72`) at byte offset 257

#### Category 2: Plain Text & Structured Data Formats (Encoding & Structural Inspection)
Plain text files (`.log`, `.txt`, `.json`, `.csv`, `.har`, `.md`, `.xml`) **do not have binary magic numbers**. They cannot be validated using byte signature checks. Instead, they must be validated through:
1. **Binary Header Exclusion**: Confirm that the file does **not** begin with known executable binary headers (e.g., `MZ` for Windows PE binaries or `\x7FELF` for Linux binaries) and contains no null bytes (`0x00`) in diagnostic log streams.
2. **UTF-8 Encoding Verification**: Verify that the byte stream conforms to valid UTF-8/ASCII character encoding.
3. **Format-Specific Structural Verification**:
   - `.json` and `.har`: Inspect that the file begins with `{` or `[` and forms valid JSON structure upon initial parsing.
   - `.csv`: Verify delimiter consistency and absence of executable formula injection prefixes (`=`, `+`, `-`, `@` at cell starts if parsed).
   - `.log` / `.txt` / `.md`: Verify printable character stream.

#### Content Mismatch & Rejection Handling
If a file's content fails signature inspection or encoding verification (e.g., an executable binary renamed to `.png` or binary payload inside `.log`), the upload is rejected with HTTP `415 Unsupported Media Type`, and the temporary file is unlinked immediately.

### 15.4 SVG Upload Security Policy

> [!WARNING]
> **SVG Upload Policy: Unresolved Security Decision (Requires Stakeholder Approval)**
>
> **Security Risk**: Scalable Vector Graphics (SVG) are XML-based files that can embed executable JavaScript (`<script>` tags, inline event handlers like `onload`, `onerror`), or external XML entity (XXE) definitions. If rendered inline by a browser, an SVG can execute arbitrary code within the user's browser session, resulting in Stored Cross-Site Scripting (XSS).
>
> **Proposed Phase 1 Default (Pending Formal Approval)**:
> - **Option B (Recommended Safe Baseline)**: **Block `.svg` uploads entirely** in Phase 1 by adding `.svg` to the blocked extensions blacklist. Because no automated SVG sanitization pipeline currently exists in the repository, blocking `.svg` represents the only zero-risk posture against Stored XSS.
>
> **Alternative Policy Options Requiring Approval**:
> - **Option A**: Permit SVG uploads, but strictly enforce `Content-Disposition: attachment; filename="..."` and `X-Content-Type-Options: nosniff` on all download responses, preventing browsers from rendering the file inline. (Note: users opening downloaded SVGs locally in a browser still face XSS risk).
> - **Option C**: Integrate a dedicated server-side XML/SVG sanitization library (e.g., `DOMPurify` / `svg-sanitizer`) to strip all script tags, external entities, and event handlers prior to storage.
>
> *Status*: Option B is proposed as the safe default until stakeholder review formally signs off on Option A or Option C.

### 15.5 Archive File Handling (`.zip`, `.tar.gz`, `.7z`)
- **No Server-Side Decompression**: The backend treats compressed archives strictly as opaque binary byte streams. The server **MUST NOT** unpack, extract, or decompress archives on the server filesystem. This completely eliminates decompression bombs ("zip bombs") and zip-slip path traversal attacks.
- **Antivirus Scanning Status**: Verification of `backend/package.json` confirms that **no antivirus integration (e.g., ClamAV) exists in the repository**. Virus scanning prior to download is documented strictly as a **Proposed Future Enhancement**.

---

## 16. Upload and Download Execution Flows

### 16.1 Upload Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client (React 19 SPA)
    participant Ctr as AttachmentsController
    participant Guards as JwtAuthGuard and RolesGuard
    participant Multer as MulterInterceptor (DiskStorage)
    participant Svc as AttachmentsService
    participant Prisma as PostgreSQL (Prisma)
    participant Disk as Local Disk Storage

    Client->>Ctr: POST /api/issues/INB-1001/attachments (multipart field: file)
    Ctr->>Guards: Check JWT Token and User Role
    alt Missing or Expired Token
        Guards-->>Client: 401 Unauthorized
    else Role is Viewer
        Guards-->>Client: 403 Forbidden
    end
    Guards-->>Ctr: Authorized

    Ctr->>Multer: Ingest Stream and Validate Size Limit (25MB)
    alt File Size exceeds 25MB
        Multer-->>Client: 413 Payload Too Large
    else Blocked Extension (.exe, .sh, .bat)
        Multer-->>Client: 415 Unsupported Media Type
    else No File Provided
        Multer-->>Client: 400 Bad Request
    end
    Multer->>Disk: Stream binary to backend/uploads/attachments/{cuid}_{filename}
    Disk-->>Multer: File written successfully

    Ctr->>Svc: uploadAttachment(issueId, file, currentUser)
    Svc->>Svc: Content Validation (Magic Numbers or Text Encoding)
    alt Content Validation Mismatch
        Svc->>Disk: Unlink temporary file
        Svc-->>Client: 415 Unsupported Media Type
    end

    Svc->>Prisma: Find parent issue (issueId: INB-1001)
    alt Parent Issue Not Found
        Svc->>Disk: Unlink temporary file
        Svc-->>Client: 404 Not Found
    end

    Note over Svc,Prisma: Atomic Prisma Transaction ($transaction)
    Svc->>Prisma: Insert Attachment record & Insert ActivityEvent ('attachment_added')
    alt Database Transaction Fails
        Svc->>Disk: Unlink physical file (rollback)
        Svc-->>Client: 500 Internal Server Error
    end

    Svc-->>Ctr: Return AttachmentResponseDto
    Ctr-->>Client: 201 Created (JSON metadata)
```

### 16.2 Download Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client (React 19 SPA)
    participant Ctr as AttachmentsController
    participant Guard as JwtAuthGuard
    participant Svc as AttachmentsService
    participant Prisma as PostgreSQL (Prisma)
    participant Disk as Local Disk Storage

    Client->>Ctr: GET /api/attachments/:id/download
    Ctr->>Guard: Validate JWT Token
    alt Invalid or Expired Token
        Guard-->>Client: 401 Unauthorized
    end
    Guard-->>Ctr: Authorized

    Ctr->>Svc: getDownloadStream(id)
    Svc->>Prisma: Find Attachment by id
    alt Attachment Record Not Found
        Svc-->>Client: 404 Not Found
    end

    Svc->>Disk: Check physical file existence on disk
    alt Physical File Missing
        Svc-->>Client: 404 Not Found ("Attachment file not found on server storage")
    end

    Svc->>Disk: Create ReadStream(filePath)
    Disk-->>Svc: Readable stream
    Svc-->>Ctr: StreamableFile and headers (Content-Disposition, Content-Type, Content-Length)
    Ctr-->>Client: 200 OK (Binary stream download)
```

---

## 17. Access Control and Permission Verification

1. **Issue Existence Verification**: Before returning, downloading, or deleting an attachment, the service confirms the parent issue exists in PostgreSQL.
2. **Download Access**: Every authenticated user who has access to view an issue may download its attachments.
3. **Deletion Rights (Pre-Migration Policy)**:
   - `Admin`: Unconditional deletion rights on any attachment.
   - `Project_Manager`: Unconditional deletion rights on any attachment.
   - Other roles: Denied (`403 Forbidden`) until the proposed `uploaderId` schema migration is implemented.

---

## 18. Error Handling and HTTP Status Codes

The module adheres strictly to NestJS exception filters (`HttpExceptionFilter` and `PrismaExceptionFilter`).

| Error Condition | Exception Class | Status Code | Standard Error Message Pattern |
|---|---|:---:|---|
| Missing or expired JWT token | `UnauthorizedException` | `401` | `"Authentication required. Missing, invalid, or expired token."` |
| Role lacks upload or delete permission | `ForbiddenException` | `403` | `"Forbidden resource. You do not have permission to perform this action."` |
| Parent issue not found | `NotFoundException` | `404` | `"Issue with identifier ${issueId} not found."` |
| Attachment metadata record not found | `NotFoundException` | `404` | `"Attachment with identifier ${id} not found."` |
| Physical file missing on server storage | `NotFoundException` | `404` | `"Attachment file ${filename} not found on server storage."` |
| File size exceeds 25 MB limit | `PayloadTooLargeException` | `413` | `"File size exceeds maximum permitted limit of 25MB (26214400 bytes)."` |
| Disallowed extension (.exe, .bat, .sh) | `UnsupportedMediaTypeException` | `415` | `"File extension .${ext} is disallowed for security policies."` |
| Content / magic number mismatch | `UnsupportedMediaTypeException` | `415` | `"File content does not match declared extension .${ext}."` |
| Missing file payload in multipart request | `BadRequestException` | `400` | `"File is required. Multipart field name must be 'file'."` |

---

## 19. Frontend-to-Backend Integration

### 19.1 Frontend API Service Proposal (`frontend/src/services/api.ts`)

The existing file [`frontend/src/services/api.ts`](file:///c:/Users/kirit/ticketing_tool/frontend/src/services/api.ts) already provides `tokenStorage`, `API_BASE_URL`, and `apiRequest`. The proposed `attachmentsApi` client can be added as follows:

```typescript
export const attachmentsApi = {
  /** Upload single attachment file via multipart/form-data */
  uploadAttachment: async (issueId: string, file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = tokenStorage.getToken();
    const response = await fetch(`${API_BASE_URL}/issues/${issueId}/attachments`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Failed to upload attachment (${response.status})`);
    }

    return response.json();
  },

  /** List all attachments for an issue */
  listAttachments: async (issueId: string): Promise<Attachment[]> => {
    return apiRequest<Attachment[]>(`/issues/${issueId}/attachments`);
  },

  /** Get attachment metadata by ID */
  getAttachment: async (id: string): Promise<Attachment> => {
    return apiRequest<Attachment>(`/attachments/${id}`);
  },

  /** Download attachment binary stream */
  downloadAttachment: async (id: string, filename: string): Promise<void> => {
    const token = tokenStorage.getToken();
    const response = await fetch(`${API_BASE_URL}/attachments/${id}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download attachment (${response.status})`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  /** Delete attachment by issueId and attachmentId */
  deleteAttachment: async (issueId: string, attachmentId: string): Promise<{ message: string; id: string }> => {
    return apiRequest<{ message: string; id: string }>(`/issues/${issueId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  },
};
```

### 19.2 Multi-Drop Handling in Frontend

In [`IssueDetailPage.tsx`](file:///c:/Users/kirit/ticketing_tool/frontend/src/pages/IssueDetailPage.tsx), users can drop or select multiple files simultaneously. The frontend handles this by dispatching individual upload requests:

```typescript
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      await uploadAttachment(issue.id, f);
      addToast('Attachment Uploaded', f.name, 'success');
    } catch (err: any) {
      addToast('Upload Failed', err.message || f.name, 'error');
    }
  }
  e.target.value = '';
};
```

This guarantees that each file upload succeeds or fails independently with clear error messaging, while adhering strictly to the single-file API contract (`POST /api/issues/:issueId/attachments`, field: `file`).

---

## 20. Deletion and Cleanup Flow Diagrams

### 20.1 Deletion & Physical Cleanup Flow

```mermaid
flowchart TD
    Start([User clicks Delete Attachment]) --> AuthCheck{"JWT Valid?"}
    AuthCheck -- No --> Ret401["Return 401 Unauthorized"]
    AuthCheck -- Yes --> RoleCheck{"Admin or Project Manager?"}
    RoleCheck -- No --> Ret403["Return 403 Forbidden"]
    RoleCheck -- Yes --> DBFind["Find Attachment in PostgreSQL"]
    DBFind --> FoundCheck{"Record exists and matches issueId?"}
    FoundCheck -- No --> Ret404["Return 404 Not Found"]
    FoundCheck -- Yes --> TxStart["Execute Prisma $transaction"]
    TxStart --> DeleteDB["DELETE row from Attachment table"]
    DeleteDB --> LogEvent["INSERT ActivityEvent 'attachment_deleted'"]
    LogEvent --> TxCommit{"Transaction Success?"}
    TxCommit -- No --> Ret500["Return 500 Server Error (Disk untouched)"]
    TxCommit -- Yes --> UnlinkDisk["Attempt fs.promises.unlink(filePath)"]
    UnlinkDisk --> UnlinkCheck{"Unlink Success?"}
    UnlinkCheck -- No --> LogWarning["Log STORAGE_ORPHAN_WARNING for admin"]
    UnlinkCheck -- Yes --> Ret200["Return 200 OK Success"]
    LogWarning --> Ret200
```

---

## 21. File Responsibility Matrix

| File Path | Component | Responsibilities | Current State |
|---|---|---|:---:|
| `backend/src/attachments/attachments.module.ts` | NestJS Module | Bundles controller, service, Multer configuration, and exports `AttachmentsService`. | Proposed |
| `backend/src/attachments/attachments.controller.ts` | REST Controller | Implements the 5 attachment endpoints with guards, route params, and interceptors. | Proposed |
| `backend/src/attachments/attachments.service.ts` | Domain Service | Executes Prisma operations, disk file streaming, orphan cleanup, and activity logging. | Proposed |
| `backend/src/attachments/storage/storage.service.ts` | Storage Provider | Abstract file persistence interface handling save, stream, and unlink operations. | Proposed |
| `backend/src/attachments/dto/attachment-response.dto.ts` | Response DTO | Defines standard serialized attachment metadata shape. | Proposed |
| `backend/src/attachments/dto/create-attachment.dto.ts` | Validation DTO | Enforces file metadata validation rules. | Proposed |
| `backend/src/common/guards/roles.guard.ts` | Shared RBAC Guard | Enforces role-based permissions (`RolesGuard`). | Implemented |
| `backend/src/common/guards/jwt-auth.guard.ts` | Shared Auth Guard | Enforces JWT authentication (`JwtAuthGuard`). | Implemented |
| `frontend/src/services/api.ts` | API Client | Contains `tokenStorage`, `apiRequest`, and proposed `attachmentsApi` wrapper. | Implemented (Wrapper Proposed) |
| `frontend/src/context/AppContext.tsx` | State Provider | Coordinates attachment state, toasts, and UI refreshes. | Implemented (Mock) |
| `frontend/src/pages/IssueDetailPage.tsx` | React View | Renders dropzone, attachment cards, download and delete buttons. | Implemented (UI) |

---

## 22. Security Considerations

1. **Path Traversal Protection**:
   - Client-provided filenames are never passed directly to `fs` or `path.join()`.
   - All saved files are prefixed with unique CUIDs: `{attachmentId}_{sanitizedFilename}`.
2. **Denial of Service (DoS) via Large Uploads**:
   - Multer streaming limits file sizes to 25 MB. Excess bytes trigger socket termination and HTTP `413 Payload Too Large`.
3. **Executable Execution Prevention**:
   - The uploads directory (`backend/uploads/`) must never be served as a static script execution root (e.g., no PHP/CGI execution).
   - In production, serving files through S3 with `Content-Disposition: attachment` forces browsers to download rather than execute scripts.
4. **MIME Sniffing Prevention**:
   - Download responses must include `X-Content-Type-Options: nosniff` header.
5. **Orphan File Leak Prevention**:
   - If a database transaction fails during upload, the temporary disk file must be immediately unlinked in a `catch` block.
6. **Untrusted MIME Type Defense**:
   - Client-provided `file.mimetype` is strictly treated as untrusted; binary header magic numbers and text stream encoding rules are inspected before file registration.

---

## 23. Implementation Dependencies and Sequencing

```mermaid
flowchart TD
    Prisma["PrismaModule (Active)"] --> AttachmentsMod["AttachmentsModule"]
    Auth["AuthModule and JwtAuthGuard (Active)"] --> AttachmentsMod
    Issues["IssuesModule (Future Cross-Module Contract)"] --> AttachmentsMod
    AttachmentsMod --> Storage["StorageService and Directory Setup"]
    AttachmentsMod --> DTOs["DTOs and Validation Pipes"]
    Storage --> Service["AttachmentsService"]
    DTOs --> Controller["AttachmentsController"]
    Service --> Controller
    Controller --> Frontend["Frontend attachmentsApi Integration"]
```

### Recommended Implementation Workflow:
1. **Phase 1 — Storage Infrastructure**: Create `backend/src/attachments/storage/` and configure disk storage directory (`backend/uploads/attachments/`).
2. **Phase 2 — DTO & Service**: Create DTOs and `AttachmentsService` with Prisma operations, magic-number inspection, text stream validation, file streaming, and two-phase failure recovery.
3. **Phase 3 — Controller**: Create `AttachmentsController` with `@UseInterceptors(FileInterceptor('file'))` and `@UseGuards(JwtAuthGuard, RolesGuard)`.
4. **Phase 4 — Module Registration**: Register `AttachmentsModule` in `app.module.ts`.
5. **Phase 5 — Automated Test Suite**: Author integration tests (`test_attachments.js`) testing upload, download, limits, and RBAC.
6. **Phase 6 — Frontend Wiring**: Add `attachmentsApi` in `frontend/src/services/api.ts` and connect `IssueDetailPage.tsx`.

---

## 24. Testing Requirements

### 24.1 Test Suite Plan

All 15 planned automated tests are specifications for future implementation verification. All tests remain strictly unexecuted in this documentation audit.

| Test ID | Test Scenario | Method & Route | Expected Status | Verified Status |
|---|---|---|:---:|---|
| **ATT-T01** | Upload valid file (`traceback.log`, text/plain, 14KB) | `POST /api/issues/:issueId/attachments` | `201 Created` | *Not Run (Documented Requirement)* |
| **ATT-T02** | Upload valid image (`screenshot.png`, image/png, 2MB) | `POST /api/issues/:issueId/attachments` | `201 Created` | *Not Run (Documented Requirement)* |
| **ATT-T03** | Upload file exceeding 25 MB limit | `POST /api/issues/:issueId/attachments` | `413 Payload Too Large` | *Not Run (Documented Requirement)* |
| **ATT-T04** | Upload dangerous executable (`malware.exe`, `.sh`, `.bat`) | `POST /api/issues/:issueId/attachments` | `415 Unsupported Media Type` | *Not Run (Documented Requirement)* |
| **ATT-T05** | Upload without file payload (missing `file` field) | `POST /api/issues/:issueId/attachments` | `400 Bad Request` | *Not Run (Documented Requirement)* |
| **ATT-T06** | Upload to nonexistent issue ID | `POST /api/issues/NONEXISTENT/attachments` | `404 Not Found` | *Not Run (Documented Requirement)* |
| **ATT-T07** | Upload unauthenticated (missing JWT) | `POST /api/issues/:issueId/attachments` | `401 Unauthorized` | *Not Run (Documented Requirement)* |
| **ATT-T08** | Viewer role attempts file upload | `POST /api/issues/:issueId/attachments` | `403 Forbidden` | *Not Run (Documented Requirement)* |
| **ATT-T09** | List attachments for existing issue | `GET /api/issues/:issueId/attachments` | `200 OK` | *Not Run (Documented Requirement)* |
| **ATT-T10** | Get attachment metadata by ID | `GET /api/attachments/:id` | `200 OK` | *Not Run (Documented Requirement)* |
| **ATT-T11** | Download attachment binary stream | `GET /api/attachments/:id/download` | `200 OK` | *Not Run (Documented Requirement)* |
| **ATT-T12** | Download nonexistent attachment | `GET /api/attachments/NONEXISTENT/download` | `404 Not Found` | *Not Run (Documented Requirement)* |
| **ATT-T13** | Admin deletes attachment | `DELETE /api/issues/:issueId/attachments/:attachmentId` | `200 OK` | *Not Run (Documented Requirement)* |
| **ATT-T14** | Delete unlinks physical file from storage | Verify disk path unlinked | File removed | *Not Run (Documented Requirement)* |
| **ATT-T15** | Non-admin attempts attachment deletion (Pre-Migration) | `DELETE /api/issues/:issueId/attachments/:attachmentId` | `403 Forbidden` | *Not Run (Documented Requirement)* |

---

## 25. Acceptance Criteria

The Attachments Module will be verified as implementation-ready when:

- [ ] All 5 REST endpoints are operational under `/api/issues/:issueId/attachments` and `/api/attachments`.
- [ ] Multipart file uploads strictly stream to persistent disk storage under `backend/uploads/attachments/`.
- [ ] Files larger than 25 MB are rejected with `413 Payload Too Large`.
- [ ] Executable files (`.exe`, `.bat`, `.cmd`, `.sh`, `.ps1`) are rejected with `415 Unsupported Media Type`.
- [ ] Content validation / magic numbers are checked for binary formats and text streams verified for UTF-8 encoding.
- [ ] Temporary files created for rejected uploads or failed database transactions are immediately unlinked.
- [ ] Uploaded attachment metadata is accurately persisted in PostgreSQL via Prisma.
- [ ] Activity events (`attachment_added`, `attachment_deleted`) are logged in `ActivityEvent` within atomic transactions.
- [ ] Binary download endpoint streams files with valid `Content-Disposition`, `Content-Type`, and `X-Content-Type-Options: nosniff`.
- [ ] Attachment deletion unlinks the file from disk storage and removes the database row.
- [ ] Deletion of parent issues coordinates physical file cleanup prior to database cascade deletion.
- [ ] Frontend `IssueDetailPage.tsx` connects to `attachmentsApi` for real upload and download.
- [ ] All 15 planned automated tests pass with zero regressions in Auth, Users, and Projects modules.

---

## 26. Architectural Decisions and Pending Sign-Offs

1. **Uploader Identity Tracking (`uploaderId`) Schema Migration**:
   - *Status*: **Proposed Architectural Change (Requires Approval)**.
   - *Description*: The current Prisma `Attachment` table lacks an `uploaderId` column.
   - *Proposed Resolution*: In the next migration cycle, add `uploaderId String` to `model Attachment` referencing `User.id` with `@relation("UploadedAttachments")`.
   - *Interim Policy*: Until approved, only `Admin` and `Project_Manager` may delete attachments.
2. **SVG Upload Security Policy**:
   - *Status*: **Unresolved Security Decision (Pending Approval)**.
   - *Description*: SVGs carry Stored XSS risks if rendered in browser contexts.
   - *Proposed Safe Phase 1 Baseline*: Option B (block SVGs by default in Phase 1) is documented as the proposed default, pending stakeholder review of Option A (download-only with forced headers) or Option C (server-side XML sanitization).
3. **Archive Deep Inspection & Antivirus**:
   - *Status*: **Unresolved Security Decision (Pending Approval)**.
   - *Description*: Compressed archives (`.zip`, `.tar.gz`) can harbor obfuscated executables or decompression bombs.
   - *Baseline*: Archives are treated as opaque streams without server extraction. Antivirus integration is proposed for future phases.
4. **Cloud Storage Engine Transition**:
   - *Status*: **Documented Boundary**.
   - *Description*: Local disk storage (`backend/uploads/attachments/`) is used for local development and CI testing. When deploying to containerized cloud environments (e.g., AWS ECS / Kubernetes), an S3-compatible provider (`S3StorageService`) must be configured via environment variables (`STORAGE_DRIVER=s3`, `AWS_S3_BUCKET`, `AWS_REGION`).
5. **Absence of Background Garbage Collector**:
   - *Status*: **Verified Fact & Proposed Future Enhancement**.
   - *Description*: No queue or cron scheduler currently exists in `backend/package.json`. Automatic asynchronous orphan sweeping is proposed for a subsequent architecture phase; synchronous failure cleanup is enforced in the interim.
6. **Cross-Module Issue Deletion Coordination**:
   - *Status*: **Required Future Cross-Module Contract**.
   - *Description*: `IssuesModule` is not yet implemented. When implemented, its deletion flow must invoke `AttachmentsService` file cleanup before deleting the issue record from Prisma.

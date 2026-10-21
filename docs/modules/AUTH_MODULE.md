# Authentication Module Specification

## Ticketing Management Platform (Inbox / GoldMine Portal)

---

## 1. Document Overview

### 1.1 Purpose
This document establishes the comprehensive, authoritative, implementation-ready specification for the **Authentication (`Auth`) Module** of the **Ticketing Management Platform** (known internally as the *Inbox / GoldMine Portal*). It provides exact architectural contracts, planned endpoint specifications, Data Transfer Object (DTO) schemas, data-access lifecycles, cryptographic standards, security controls, testing suites, and frontend integration contracts.

This specification is authored so that any backend engineer can implement the module on an isolated workstation without architectural ambiguity, contract drift, or incompatibility with the existing React 19 frontend single-page application (SPA).

### 1.2 System & Project Identity
* **System Name**: Ticketing Management Platform (Inbox / GoldMine Portal)
* **Subsystem**: Planned Backend REST API (`backend/`)
* **Module Name**: `AuthModule`
* **Planned Tech Stack**: NestJS (v10.x / v11.x), TypeScript 5.x, Passport JWT (`passport-jwt`), bcrypt, PostgreSQL 16+, Prisma ORM

### 1.3 Scope
This document covers:
* User credential verification via `bcrypt` against PostgreSQL via Prisma ORM.
* Stateless JSON Web Token (JWT) issuance, signing, and verification.
* Session hydration via `/api/auth/me` and logout confirmation via `/api/auth/logout`.
* The strict separation between **Authentication** (identity verification) and **Authorization** (Role-Based Access Control / RBAC).
* Password modification flows (administrative reset vs. authenticated self-service credential update).
* Validation error contracts, authentication failure responses, and security safeguards.
* Unit, integration, and end-to-end (E2E) testing requirements.
* Integration boundary with the existing React 19 frontend client.

### 1.4 Intended Audience
* **Backend Engineers**: For implementation of controllers, services, strategies, DTOs, and test suites.
* **Frontend Engineers**: For integration of authentication HTTP clients, session storage, and route guards.
* **Security & QA Engineers**: For verifying vulnerability mitigations, encryption standards, and automated test coverage.

### 1.5 Authoritative Documentation Hierarchy
This specification complies strictly with the approved project architecture documents:
1. [**`BACKEND_ARCHITECTURE.md`**](file:///c:/Users/kirit/ticketing_tool/BACKEND_ARCHITECTURE.md): The immutable system design baseline derived from the React prototype (specifically Phase 8.1, Phase 9.3, and Phase 10).
2. [**`docs/01_SYSTEM_ARCHITECTURE.md`**](file:///c:/Users/kirit/ticketing_tool/docs/01_SYSTEM_ARCHITECTURE.md): The macro architectural blueprint (Section 15 "Authentication Architecture" and Section 16 "Authorization and RBAC Architecture").
3. [**`docs/02_CODING_STANDARDS.md`**](file:///c:/Users/kirit/ticketing_tool/docs/02_CODING_STANDARDS.md): The micro engineering standards (Section 8 "Controller Coding Rules", Section 17 "Authentication and Authorization Conventions", and Section 20 "Security and Sensitive Data Handling").
4. [**`docs/03_MODULE_IMPLEMENTATION.md`**](file:///c:/Users/kirit/ticketing_tool/docs/03_MODULE_IMPLEMENTATION.md): The module implementation guide (Section 4 "Module 2: AuthModule").
5. [**`backend/README.md`**](file:///c:/Users/kirit/ticketing_tool/backend/README.md): Planned backend initialization guide and setup instructions.
6. [**`backend/.env.example`**](file:///c:/Users/kirit/ticketing_tool/backend/.env.example): Blueprint environment variables.

### 1.6 Core Architectural Definitions
* **Authentication answers**: *"Who is the user?"* It cryptographically proves the caller's identity through submitted credentials (email/password) and encodes that identity into a signed JWT.
* **Authorization answers**: *"What is the user allowed to do?"* It inspects the caller's verified role and attributes against route metadata (`@Roles()`) and workspace permissions.

---

## 2. Current Implementation Status

Before detailing the planned architecture, an inspection of the actual physical codebase establishes the baseline reality. The backend currently contains only `backend/.env.example` and `backend/README.md`. No backend NestJS implementation code exists yet.

### 2.1 Status Classifications Defined
Throughout this document, all components, endpoints, files, and requirements are classified using these five categories:
* **Existing**: Confirmed by inspecting an actual file or implementation currently present in the codebase.
* **Planned**: Defined in the approved project architecture documents, but not implemented in code yet.
* **Proposed**: A recommendation or architectural extension that still requires team approval.
* **Unresolved**: A decision where project documents conflict or where requirements cannot be confirmed.
* **Not Applicable**: A capability that is outside the approved authentication scope.

### 2.2 Physical Codebase Audit

| Architectural Area | Inspected Artifact Path | Current Status | Audit Findings & Evidence |
|---|---|---|---|
| **Frontend UI (Login View)** | `frontend/src/pages/LoginPage.tsx` | **Existing** | React 19 view supporting email input, user switcher preset selection, password validation, and redirection. |
| **Frontend State & Auth Context** | `frontend/src/context/AppContext.tsx` | **Existing** | Implements `login()`, `logout()`, `updateUserPassword()`, and `isAuthenticated` state. Persists via browser `localStorage`. |
| **Frontend Seed Data & Credentials** | `frontend/src/data/seedData.ts` | **Existing** | Seed dataset with accounts containing plaintext seed passwords (`admin123` for Admin, `password123` for staff). |
| **Frontend Route Guards** | `frontend/src/App.tsx` | **Existing** | Client routing using React Router DOM 7 with `PublicOnlyRoute`, `ProtectedRoute`, and `RoleRoute`. |
| **Frontend RBAC Logic** | `frontend/src/services/rbac.ts` | **Existing** | Defines 8 user roles and default page permission mappings. |
| **Frontend Storage Utility** | `frontend/src/services/storage.ts` | **Existing** | Manages local storage keys (`inbox_auth_session`, `inbox_current_user_id`, `inbox_users`). |
| **Frontend HTTP API Client** | `frontend/src/services/api.ts` | **Planned** | Not yet created in frontend. Frontend currently runs against mock local storage. |
| **Backend Environment Template** | `backend/.env.example` | **Existing** | Declares `PORT=4000`, `NODE_ENV=development`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRATION="7d"`, `CORS_ORIGIN="http://localhost:3000"`. |
| **Backend Setup Documentation** | `backend/README.md` | **Existing** | Instructions for bootstrapping NestJS, installing Prisma, and running migrations. |
| **Backend Source Tree** | `backend/src/` | **Planned** | Directory does not exist yet. No controllers, services, guards, strategies, DTOs, or modules exist on disk. |
| **Prisma Schema** | `backend/prisma/schema.prisma` | **Planned** | Fully specified in `BACKEND_ARCHITECTURE.md` Phase 5, but not yet generated on disk in `backend/prisma/`. |
| **Automated Backend Tests** | `backend/test/` | **Planned** | Test harnesses (Jest, Supertest) have not been initialized yet. |

---

## 3. Authentication Module Overview

The planned `AuthModule` is the security gateway of the NestJS backend application. It is engineered as a stateless provider within a modular monolith architecture.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              Client Tier                               │
│  React 19 SPA (LoginPage / Topbar UserSwitcher / AppLayout Hydration) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS JSON (Bearer Token / Credentials)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              Ingress Tier                              │
│       CORS Middleware (http://localhost:3000) -> Global ValidationPipe │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Planned AuthModule Tier                          │
│  AuthController -> AuthService -> JwtStrategy (Passport) <-> UsersSvc  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Type-Safe Query (PrismaClient)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            Persistence Tier                            │
│                 PostgreSQL 16 Relational DB ("User" Table)             │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Planned Responsibilities of `AuthModule`
1. **Credential Authentication (`POST /api/auth/login`)**:
   - Accepts login credentials (`emailOrId`, `password`).
   - Looks up the user account via `UsersService` or `PrismaService`.
   - Compares the submitted plaintext password with the stored bcrypt hash using constant-time comparison (`bcrypt.compare`).
   - Generates and signs a cryptographically secure JWT signed with `JWT_SECRET`.
   - Returns the signed token alongside the sanitized public `User` entity.
2. **Session Hydration (`GET /api/auth/me`)**:
   - Protects the session query using the planned global `JwtAuthGuard`.
   - Extracts the authenticated user identity (`request.user`) populated by `JwtStrategy`.
   - Resolves the fresh user record from the database to ensure deactivated accounts cannot persist.
3. **Session Invalidation (`POST /api/auth/logout`)**:
   - Acknowledges client-side token discard with an explicit `{ success: true }` confirmation payload.
4. **Token Verification (`JwtStrategy`)**:
   - Validates Bearer tokens extracted from incoming HTTP `Authorization` headers.
   - Enforces cryptographic signature verification and expiration bounds (`exp`).

### 3.2 Boundary Separation: What `AuthModule` Owns vs. Other Modules

| Domain Responsibility | Owning Component / Module | Status | Boundary Rationale |
|---|---|---|---|
| **Credential Verification & JWT Issuance** | **`AuthModule`** (`AuthService`) | **Planned** | Pure identity management and token generation. |
| **Token Verification Strategy** | **`AuthModule`** (`JwtStrategy`) | **Planned** | Implements the Passport JWT authentication strategy. |
| **User CRUD & Account Persistence** | **`UsersModule`** (`UsersService`) | **Planned** | Account creation, team directories, and profile updates belong to the user domain. |
| **Administrative Password Overwrite** | **`UsersModule`** (`PATCH /api/users/:id/password`) | **Planned** | Administrative governance feature on `AdminPanelPage` modifying target user records. |
| **Self-Service Password Change** | **`AuthModule`** (`POST /api/auth/change-password`) | **Proposed** | Optional self-service endpoint verifying current password before update. |
| **Endpoint Authorization Checks** | **Shared Infrastructure** (`RolesGuard`) | **Planned** | Applied across all business controllers via `@Roles()` metadata reflection. |
| **Database Connection & Pool** | **`PrismaModule`** (`PrismaService`) | **Planned** | Global database connection lifecycle management. |

---

## 4. Architecture and Component Responsibilities

### 4.1 Authentication Architecture Diagram

The following diagram illustrates the planned component relationships:

```mermaid
flowchart TB
    subgraph Client ["Client Browser (Existing React 19 Frontend)"]
        UI["LoginPage / HTTP Client"]
        LocalStore[("Token Storage: localStorage")]
    end

    subgraph Network ["Network & Middleware (Planned)"]
        CORS["CORS Middleware"]
        VPipe["ValidationPipe (class-validator)"]
    end

    subgraph AuthBoundary ["Planned AuthModule (backend/src/...)"]
        ACtrl["AuthController"]
        ASvc["AuthService"]
        JStrat["JwtStrategy (Passport)"]
    end

    subgraph SecurityInfrastructure ["Planned Common Security (backend/src/common/)"]
        JGuard["JwtAuthGuard"]
        RGuard["RolesGuard"]
        CUserDec["@CurrentUser() Decorator"]
    end

    subgraph UserBoundary ["Planned UsersModule (backend/src/...)"]
        USvc["UsersService"]
    end

    subgraph Persistence ["Planned Persistence Layer"]
        PSvc["PrismaService (Global)"]
        Postgres[("PostgreSQL 16: User Table")]
    end

    %% Login Pipeline
    UI -- "1. POST /api/auth/login" --> CORS
    CORS --> VPipe
    VPipe -- "Validated LoginDto" --> ACtrl
    ACtrl -- "login(emailOrId, password)" --> ASvc
    ASvc -- "findByEmailOrId(identifier)" --> USvc
    USvc -- "findUnique({ where: { email } })" --> PSvc
    PSvc --> Postgres
    Postgres -.-> PSvc
    PSvc -. "User (with password hash)" .-> USvc
    USvc -.-> ASvc
    ASvc -- "bcrypt.compare(password, hash)" --> ASvc
    ASvc -- "jwtService.sign(payload)" --> ASvc
    ASvc -. "Return { accessToken, user }" .-> ACtrl
    ACtrl -. "HTTP 200 OK JSON" .-> UI
    UI -- "Store Token" --> LocalStore

    %% Protected Pipeline
    UI -- "2. GET /api/protected (Bearer JWT)" --> JGuard
    JGuard -- "Validate Token" --> JStrat
    JStrat -- "Decode & Validate Claims" --> JStrat
    JStrat -- "findUnique({ where: { id: sub } })" --> PSvc
    JStrat -. "Attach user to req.user" .-> JGuard
    JGuard --> RGuard
    RGuard -- "Verify @Roles() Metadata" --> ACtrl
    ACtrl --> CUserDec
```

### 4.2 Component Responsibility Table

> [!NOTE]
> **Directory Path Inconsistency**: `BACKEND_ARCHITECTURE.md` (Phase 6 & 17) uses flat paths under `backend/src/auth/`, whereas `docs/01_SYSTEM_ARCHITECTURE.md` (Section 9) and `docs/03_MODULE_IMPLEMENTATION.md` (Section 4) use modular subfolder paths under `backend/src/modules/auth/`. Both planned paths are documented below; resolving this layout is noted in Section 15.

| Component Name | Planned File Path | Responsibility | Inputs | Outputs | Dependencies | Current Status | Relevant Architectural Reference |
|---|---|---|---|---|---|---|---|
| **`AuthModule`** | `backend/src/modules/auth/auth.module.ts`<br>*(or `backend/src/auth/auth.module.ts`)* | NestJS module wiring controllers, services, Passport, and JWT. | Module configuration | Configured NestJS module | `UsersModule`, `PassportModule`, `JwtModule` | **Planned** | `docs/01_SYSTEM_ARCHITECTURE.md` Section 9;<br>`BACKEND_ARCHITECTURE.md` Phase 6 |
| **`AuthController`** | `backend/src/modules/auth/auth.controller.ts`<br>*(or `backend/src/auth/auth.controller.ts`)* | Exposes HTTP routes for login, me, and logout. Handles HTTP status codes. | HTTP request bodies, headers | JSON responses (`accessToken`, `User`, `{ success: true }`) | `AuthService` | **Planned** | `BACKEND_ARCHITECTURE.md` Phase 8.1;<br>`docs/03_MODULE_IMPLEMENTATION.md` Section 4 |
| **`AuthService`** | `backend/src/modules/auth/auth.service.ts`<br>*(or `backend/src/auth/auth.service.ts`)* | Verifies credentials via bcrypt, generates signed JWTs, orchestrates user lookups. | `emailOrId: string`, `password: string` | `{ accessToken, user }` | `UsersService`, `JwtService`, `PrismaService` | **Planned** | `BACKEND_ARCHITECTURE.md` Phase 7 & 10;<br>`docs/03_MODULE_IMPLEMENTATION.md` Section 4 |
| **`LoginDto`** | `backend/src/modules/auth/dto/login.dto.ts`<br>*(or `backend/src/auth/dto/login.dto.ts`)* | Validates incoming login request payload. | Raw request body JSON | Strongly typed `LoginDto` | `class-validator`, `class-transformer` | **Planned** | `BACKEND_ARCHITECTURE.md` Phase 9.3;<br>`docs/02_CODING_STANDARDS.md` Section 10 |
| **`JwtStrategy`** | `backend/src/modules/auth/strategies/jwt.strategy.ts`<br>*(or `backend/src/auth/strategies/jwt.strategy.ts`)* | Passport JWT strategy extracting Bearer token and verifying cryptographic signature. | Bearer token from `Authorization` header | Authenticated `User` attached to `request.user` | `PassportStrategy`, `ConfigService`, `PrismaService` | **Planned** | `BACKEND_ARCHITECTURE.md` Phase 10.2;<br>`docs/01_SYSTEM_ARCHITECTURE.md` Section 15 |
| **`JwtAuthGuard`** | `backend/src/common/guards/jwt-auth.guard.ts` | Enforces authentication on routes. Bypasses routes decorated with `@Public()`. | ExecutionContext | `boolean` (allow / deny) | `AuthGuard('jwt')`, `Reflector` | **Planned** | `docs/01_SYSTEM_ARCHITECTURE.md` Section 11 & 15;<br>`docs/02_CODING_STANDARDS.md` Section 17 |
| **`CurrentUser`** | `backend/src/common/decorators/current-user.decorator.ts` | Custom parameter decorator extracting `request.user`. | ExecutionContext | Authenticated `User` entity | `createParamDecorator` | **Planned** | `docs/01_SYSTEM_ARCHITECTURE.md` Section 9;<br>`docs/02_CODING_STANDARDS.md` Section 8.2 |
| **`Public`** | `backend/src/common/decorators/public.decorator.ts` | Decorator marking endpoints that bypass `JwtAuthGuard`. | Metadata key | Metadata assignment | `SetMetadata` | **Planned** | `docs/01_SYSTEM_ARCHITECTURE.md` Section 9 & 16.3;<br>`docs/02_CODING_STANDARDS.md` Section 17.1 |
| **`RolesGuard`** | `backend/src/common/guards/roles.guard.ts` | Enforces Role-Based Access Control against `@Roles()` metadata. | ExecutionContext | `boolean` (allow / deny with 403) | `Reflector` | **Planned** | `docs/01_SYSTEM_ARCHITECTURE.md` Section 16;<br>`docs/02_CODING_STANDARDS.md` Section 17 |
| **`Roles`** | `backend/src/common/decorators/roles.decorator.ts` | Declares required `UserRole` enums for route access. | `UserRole[]` | Metadata assignment | `SetMetadata` | **Planned** | `docs/01_SYSTEM_ARCHITECTURE.md` Section 9 & 16;<br>`docs/02_CODING_STANDARDS.md` Section 17.1 |
| **`ValidationPipe`** | `backend/src/common/pipes/validation.pipe.ts` | Global pipe enforcing payload whitelisting and transformation. | Raw request payload | Validated DTO instance | NestJS `ValidationPipe` | **Planned** | `docs/01_SYSTEM_ARCHITECTURE.md` Section 18.1;<br>`docs/02_CODING_STANDARDS.md` Section 10.3 |
| **`HttpExceptionFilter`** | `backend/src/common/filters/http-exception.filter.ts` | Catches unhandled exceptions and formats uniform JSON error responses. | Thrown `HttpException` | Formatted JSON error envelope | NestJS `ExceptionFilter` | **Planned** | `docs/01_SYSTEM_ARCHITECTURE.md` Section 18.2;<br>`docs/02_CODING_STANDARDS.md` Section 16.1 |
| **`UsersService`** | `backend/src/modules/users/users.service.ts`<br>*(or `backend/src/users/users.service.ts`)* | Retrieves user records by email or ID; executes administrative password updates. | `identifier: string`, `password?: string` | `User` entity with password hash | `PrismaService` | **Planned** | `BACKEND_ARCHITECTURE.md` Phase 8.2;<br>`docs/03_MODULE_IMPLEMENTATION.md` Section 4 |
| **`PrismaService`** | `backend/src/prisma/prisma.service.ts` | Global database connector managing connection pooling to PostgreSQL. | Prisma queries | PostgreSQL database records | `PrismaClient` | **Planned** | `BACKEND_ARCHITECTURE.md` Phase 6;<br>`docs/01_SYSTEM_ARCHITECTURE.md` Section 14 |

---

## 5. Planned Authentication Endpoints

### 5.1 Endpoint Inventory Table

| HTTP Method | Endpoint Path | Purpose | Authentication Requirement | Authorization Requirement | Request DTO | Successful Response | Possible Errors | Implementation Status | Source / Architectural Reference |
|---|---|---|---|---|---|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate credentials and issue JWT | **No** (`@Public()`) | None (Public) | `LoginDto` | `200 OK`<br>`{ accessToken, user }` | `400 Bad Request`<br>`401 Unauthorized` | **Planned** | `BACKEND_ARCHITECTURE.md` Phase 8.1;<br>`docs/03_MODULE_IMPLEMENTATION.md` Module 2 |
| `GET` | `/api/auth/me` | Hydrate active user profile | **Yes** (`Bearer JWT`) | Any Authenticated Role | None | `200 OK`<br>`User` object | `401 Unauthorized` | **Planned** | `BACKEND_ARCHITECTURE.md` Phase 8.1;<br>`docs/03_MODULE_IMPLEMENTATION.md` Module 2 |
| `POST` | `/api/auth/logout` | Terminate client authentication session | **Yes** (`Bearer JWT`) | Any Authenticated Role | None | `200 OK`<br>`{ success: true }` | `401 Unauthorized` | **Planned** | `BACKEND_ARCHITECTURE.md` Phase 8.1;<br>`docs/03_MODULE_IMPLEMENTATION.md` Module 2 |
| `PATCH` | `/api/users/:id/password` | Administrative password overwrite or self-update | **Yes** (`Bearer JWT`) | `Admin` OR self (`id === user.id`) | `UpdatePasswordDto` | `200 OK`<br>`{ success: true }` | `400 Bad Request`<br>`403 Forbidden`<br>`404 Not Found` | **Planned** | `BACKEND_ARCHITECTURE.md` Phase 8.2;<br>`docs/03_MODULE_IMPLEMENTATION.md` Module 3 |
| `POST` | `/api/auth/change-password` | Authenticated self-service credential update with current-password check | **Yes** (`Bearer JWT`) | Any Authenticated Role | `ChangePasswordDto` | `200 OK`<br>`{ success: true }` | `400 Bad Request`<br>`401 Unauthorized` | **Proposed** | Architectural extension for self-service security |
| `POST` | `/api/auth/refresh` | Issue new access token using refresh token | N/A | N/A | N/A | N/A | N/A | **Not Applicable** | MVP specifies stateless 7d token; refresh token rotation planned for Phase 2 |
| `POST` | `/api/auth/forgot-password` | Self-service password reset email dispatch | N/A | N/A | N/A | N/A | N/A | **Unresolved** | Email reset workflows are unmodeled in current project specs |

---

### 5.2 Login API (`POST /api/auth/login`)
* **HTTP Method**: `POST`
* **Route**: `/api/auth/login`
* **Purpose**: Verifies user credentials and issues an authorization token.
* **Authentication**: Bypassed using `@Public()`.
* **HTTP Status Code**: Must explicitly return `200 OK` via `@HttpCode(HttpStatus.OK)` (this is an action endpoint, not a 201 entity creation).
* **Identifier Flexibility**: Supports either direct email address (e.g. `user@example.com`) or user ID identifier (e.g. `user-1`) to match the frontend `LoginPage` account switcher.
* **User Lookup**: Queries PostgreSQL where `email = identifier.toLowerCase()` OR `id = identifier`.

### 5.3 Login Request JSON Example
The following fictional placeholder demonstrates the expected request payload:
```json
{
  "emailOrId": "user@example.com",
  "password": "<PLACEHOLDER_PASSWORD>"
}
```

### 5.4 Successful Login Response JSON Example (`200 OK`)
```json
{
  "accessToken": "<PLACEHOLDER_JWT>",
  "user": {
    "id": "<USER_ID_PLACEHOLDER>",
    "name": "Jane Developer",
    "email": "user@example.com",
    "role": "Developer",
    "department": "Core Platform",
    "supportLevels": ["L1"],
    "avatar": "",
    "timezone": "UTC",
    "status": "Active"
  }
}
```
> [!IMPORTANT]
> The database `password` column is strictly stripped from the returned `user` object. It must never be serialized or returned over the wire.

### 5.5 Validation Failure Example (`400 Bad Request`)
If a request is submitted with missing or invalid fields, the planned global `ValidationPipe` formats the response:
```json
{
  "statusCode": 400,
  "message": [
    "emailOrId must be a string",
    "emailOrId should not be empty",
    "password should not be empty"
  ],
  "error": "Bad Request",
  "timestamp": "2026-10-12T12:00:00.000Z",
  "path": "/api/auth/login"
}
```

### 5.6 Authentication Failure Example (`401 Unauthorized`)
If the user account is not found or the bcrypt password check fails:
```json
{
  "statusCode": 401,
  "message": "Invalid email/userId or password",
  "error": "Unauthorized",
  "timestamp": "2026-10-12T12:00:00.000Z",
  "path": "/api/auth/login"
}
```
> [!SECURITY]
> The error message is intentionally identical whether the email does not exist or the password is incorrect. This prevents account enumeration attacks.

---

### 5.7 Password Management APIs

The project specifies two password management flows:

#### Flow A (Planned Baseline): Administrative & Direct User Update (`PATCH /api/users/:id/password`)
* **Specification Source**: `BACKEND_ARCHITECTURE.md` Phase 8.2 and `docs/03_MODULE_IMPLEMENTATION.md` Module 3.
* **HTTP Method & Route**: `PATCH /api/users/:id/password`
* **Authentication**: Required (`Bearer JWT`).
* **Authorization**: Permitted for `Admin` role (to reset any user password) OR self (`currentUserId === params.id`).
* **Request Body DTO**:
  ```json
  {
    "newPassword": "<NEW_PASSWORD_PLACEHOLDER>"
  }
  ```
* **Validation Rules**: `newPassword` must be a string with a minimum length of 4 characters (matching frontend `AppContext.tsx` line 781 validation).
* **Success Response (`200 OK`)**:
  ```json
  {
    "success": true
  }
  ```

#### Flow B (Proposed Secure Self-Service): Authenticated Credential Change (`POST /api/auth/change-password`)
* **Specification Source**: Proposed architectural extension for self-service credential updates.
* **HTTP Method & Route**: `POST /api/auth/change-password`
* **Authentication**: Required (`Bearer JWT`).
* **Authorization**: Any authenticated role.
* **Request Body DTO (`ChangePasswordDto`)**:
  ```json
  {
    "currentPassword": "<CURRENT_PASSWORD_PLACEHOLDER>",
    "newPassword": "<NEW_PASSWORD_PLACEHOLDER>"
  }
  ```
* **Validation & Execution**:
  1. Validates `currentPassword` against the database bcrypt hash. Throws `401 Unauthorized` if incorrect.
  2. Enforces password policy: minimum 6 characters.
  3. Hashes `newPassword` with bcrypt (10 rounds) and updates the database record.
* **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Password changed successfully"
  }
  ```

---

### 5.8 Endpoint Security Matrix

| Endpoint | Authentication | RBAC Guard Check | Input Validation | Sensitive Data Handling | Expected Failure Behavior |
|---|---|---|---|---|---|
| `POST /api/auth/login` | None (`@Public()`) | None | Whitelist inspection, non-empty validation | Constant-time bcrypt compare; password stripped from output | `400` on malformed shape; `401` on invalid credentials |
| `GET /api/auth/me` | Bearer JWT | None | None | Decoded identity hydrated from DB; password omitted | `401` on invalid, expired, or missing JWT |
| `POST /api/auth/logout` | Bearer JWT | None | None | Client clears token; server returns acknowledgment | `401` on invalid token |
| `PATCH /api/users/:id/password` | Bearer JWT | `Admin` OR self check | String length >= 4 | New password hashed via bcrypt before persistence | `400` on short password; `403` if non-admin attempts target update |
| `POST /api/auth/change-password` | Bearer JWT | None (operates on `req.user.id`) | Current password verified; new password >= 6 chars | Passwords hashed with bcrypt; hashes never logged | `400` on policy violation; `401` on incorrect current password |

---

## 6. Complete Planned Authentication Flows

### 6.1 Planned Login Flowchart

```mermaid
flowchart TD
    Start([User Initiates Login on LoginPage]) --> EnterCreds[User enters emailOrId and password]
    EnterCreds --> Submit[Frontend dispatches POST /api/auth/login]
    Submit --> Ingress[Ingress: CORS -> Express HTTP Adapter]
    Ingress --> Pipe[ValidationPipe: class-validator]
    
    Pipe -- Invalid Body (Missing Fields) --> Err400[Return HTTP 400 Bad Request]
    Pipe -- Valid Body --> Ctrl[AuthController.login]
    
    Ctrl --> Svc[AuthService.validateUser]
    Svc --> QueryUser[UsersService / PrismaService: Lookup User by email or id]
    
    QueryUser --> CheckUserExists{User Found in PostgreSQL?}
    CheckUserExists -- No --> Err401[Return HTTP 401 Unauthorized: Invalid credentials]
    
    CheckUserExists -- Yes --> CheckStatus{User Status Active?}
    CheckStatus -- Offline / Deactivated --> Err401Status[Return HTTP 401 Unauthorized: Account inactive]
    
    CheckStatus -- Active --> HashCompare[bcrypt.compare: Submitted password vs stored hash]
    HashCompare --> PasswordMatch{Hash Match?}
    PasswordMatch -- No --> Err401
    
    PasswordMatch -- Yes --> GenerateJWT[JwtService.sign: Generate signed JWT with sub, email, role]
    GenerateJWT --> Sanitize[Sanitize User: Delete password property]
    Sanitize --> Resp[AuthController returns HTTP 200 OK: accessToken and user]
    
    Resp --> ClientReceive[React Frontend receives JSON]
    ClientReceive --> Storage[Frontend stores accessToken in localStorage]
    Storage --> StateUpdate[AppContext updates isAuthenticated = true and currentUser]
    StateUpdate --> Redirect[Navigate to original route or / Dashboard]
    Redirect --> Finish([Login Completed])
    
    Err400 --> ClientErr[Display validation error message on LoginPage]
    Err401 --> ClientErr
    Err401Status --> ClientErr
```

### 6.2 Explanation of the Planned Login Flow
1. **User Action**: The user enters their email address (or user ID) and password into `LoginPage.tsx` and submits the form.
2. **HTTP Dispatch**: The React application sends a `POST` request to `/api/auth/login` with headers `Content-Type: application/json`.
3. **Ingress Filtering**: Express passes the request through CORS middleware into the global `ValidationPipe`.
4. **DTO Inspection**: `ValidationPipe` checks `LoginDto`. If any field is non-string or empty, execution halts with `400 Bad Request`.
5. **Controller Routing**: `AuthController.login()` receives the validated DTO and invokes `authService.login()`.
6. **User Lookup**: `AuthService` queries PostgreSQL via `PrismaClient` looking up `User` by `email` (lowercased) or `id`.
7. **Account Eligibility Check**: The user's `status` field is verified. Inactive accounts are denied.
8. **Constant-Time Verification**: `bcrypt.compare(dto.password, user.password)` compares the submitted plaintext password with the stored 60-character bcrypt hash.
9. **Token Signing**: If matching, `JwtService.sign()` encodes `{ sub: user.id, email: user.email, role: user.role }` into a signed JWT string using `JWT_SECRET` with the configured `JWT_EXPIRATION` (default `7d`).
10. **Data Sanitization**: The `password` property is completely deleted from the entity clone.
11. **Response Dispatch**: The controller sends `200 OK` with `{ accessToken, user }`.
12. **Client State Transition**: The React frontend caches the token in `localStorage` and updates `AppContext`, triggering a redirect to the originally requested route or the dashboard (`/`).

### 6.3 Successful Login Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant React as React 19 Frontend (Existing)
    participant Gateway as Planned ValidationPipe
    participant Ctrl as Planned AuthController
    participant Svc as Planned AuthService
    participant Prisma as Planned PrismaService
    participant DB as PostgreSQL 16 (Planned)
    participant JWT as Planned JwtService

    User->>React: Enters credentials & clicks Sign In
    React->>Gateway: POST /api/auth/login { emailOrId, password }
    Gateway->>Gateway: Validates LoginDto fields
    Gateway->>Ctrl: Passes validated LoginDto
    Ctrl->>Svc: login(LoginDto)
    Svc->>Prisma: user.findFirst({ where: { OR: [{ email }, { id }] } })
    Prisma->>DB: SELECT * FROM "User" WHERE email = $1 OR id = $2 LIMIT 1
    DB-->>Prisma: Returns User row (including bcrypt password hash)
    Prisma-->>Svc: User entity
    Svc->>Svc: bcrypt.compare(rawPassword, storedHash)
    Note over Svc: Constant-time hash verification succeeds
    Svc->>JWT: sign({ sub: user.id, email: user.email, role: user.role })
    JWT-->>Svc: Returns signed JWT access token string
    Svc->>Svc: Delete user.password
    Svc-->>Ctrl: { accessToken, user }
    Ctrl-->>Gateway: HTTP 200 OK Response
    Gateway-->>React: JSON { accessToken, user }
    React->>React: localStorage.setItem('inbox_auth_session', ...)
    React->>React: AppContext.setIsAuthenticated(true)
    React-->>User: Redirects to Dashboard (/)
```

### 6.4 Failed Login Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant React as React 19 Frontend (Existing)
    participant Gateway as Planned ValidationPipe
    participant Ctrl as Planned AuthController
    participant Svc as Planned AuthService
    participant Prisma as Planned PrismaService
    participant DB as PostgreSQL 16 (Planned)

    %% Case 1: Validation Failure
    User->>React: Leaves password blank & submits
    React->>Gateway: POST /api/auth/login { emailOrId: "user@example.com", password: "" }
    Gateway-->>React: HTTP 400 Bad Request { statusCode: 400, message: ["password should not be empty"] }
    React-->>User: Displays form field validation error

    %% Case 2: User Not Found
    User->>React: Enters non-existent email
    React->>Gateway: POST /api/auth/login { emailOrId: "unknown@example.com", password: "<PASSWORD>" }
    Gateway->>Ctrl: login(LoginDto)
    Ctrl->>Svc: login(LoginDto)
    Svc->>Prisma: user.findFirst(...)
    Prisma->>DB: Query user
    DB-->>Prisma: NULL (Record not found)
    Prisma-->>Svc: null
    Svc-->>Ctrl: Throws UnauthorizedException("Invalid email/userId or password")
    Ctrl-->>React: HTTP 401 Unauthorized { statusCode: 401, error: "Unauthorized" }
    React-->>User: Displays generic invalid credentials error

    %% Case 3: Wrong Password
    User->>React: Enters valid email with wrong password
    React->>Gateway: POST /api/auth/login { emailOrId: "user@example.com", password: "<WRONG_PASSWORD>" }
    Gateway->>Ctrl: login(LoginDto)
    Ctrl->>Svc: login(LoginDto)
    Svc->>Prisma: user.findFirst(...)
    Prisma-->>Svc: Valid User Record
    Svc->>Svc: bcrypt.compare("<WRONG_PASSWORD>", storedHash)
    Note over Svc: Verification returns false
    Svc-->>Ctrl: Throws UnauthorizedException("Invalid email/userId or password")
    Ctrl-->>React: HTTP 401 Unauthorized { statusCode: 401, error: "Unauthorized" }
    React-->>User: Displays generic invalid credentials error
```

---

## 7. Protected API Request Flow

### 7.1 Protected API Flowchart

```mermaid
flowchart TD
    ReqStart([Client initiates HTTP Request to Protected Route]) --> AddHeader[Client attaches header: Authorization: Bearer <token>]
    AddHeader --> Ingress[Express Server receives request]
    Ingress --> CheckRoute[NestJS Guard Pipeline: JwtAuthGuard]
    
    CheckRoute --> HasPublicDecorator{Decorated with @Public()?}
    HasPublicDecorator -- Yes --> SkipAuth[Bypass JWT check -> Forward to Handler]
    
    HasPublicDecorator -- No --> ExtractToken[Extract Bearer token from Authorization Header]
    ExtractToken --> HasToken{Bearer Token Present?}
    HasToken -- No --> Err401Missing[Throw 401 Unauthorized: Missing Bearer Token]
    
    HasToken -- Yes --> PassportStrategy[Invoke JwtStrategy.validate]
    PassportStrategy --> VerifySig{Cryptographic Signature Valid?}
    VerifySig -- No --> Err401Sig[Throw 401 Unauthorized: Invalid Token Signature]
    
    VerifySig -- Yes --> CheckExp{Token Expired?}
    CheckExp -- Yes --> Err401Exp[Throw 401 Unauthorized: Token Expired]
    
    CheckExp -- No --> FetchUser[Prisma: Find User by id = payload.sub]
    FetchUser --> UserExists{Active User in DB?}
    UserExists -- No --> Err401Revoked[Throw 401 Unauthorized: User no longer exists]
    
    UserExists -- Yes --> AttachUser[Attach hydrated user to request.user]
    AttachUser --> RolesCheck[RolesGuard: Inspect @Roles metadata]
    
    RolesCheck --> HasRolesMeta{Route has @Roles metadata?}
    HasRolesMeta -- No --> AllowExecution[Execute Controller Action]
    
    HasRolesMeta -- Yes --> RoleMatch{user.role matches @Roles OR user.role == Admin?}
    RoleMatch -- No --> Err403[Throw 403 Forbidden: Insufficient Role Permissions]
    RoleMatch -- Yes --> AllowExecution
    
    AllowExecution --> ServiceExec[Execute Service Domain Logic]
    ServiceExec --> DBExec[Prisma Query to PostgreSQL]
    DBExec --> Send200[Return HTTP 200/201 JSON Response to Client]
    
    Err401Missing --> ErrFilter[HttpExceptionFilter formats error JSON]
    Err401Sig --> ErrFilter
    Err401Exp --> ErrFilter
    Err401Revoked --> ErrFilter
    Err403 --> ErrFilter
    ErrFilter --> ClientErrorResp([Client receives Error Response])
```

### 7.2 Protected Request Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Client as React Client (Existing)
    participant Guard as Planned JwtAuthGuard
    participant Strategy as Planned JwtStrategy
    participant Prisma as Planned PrismaService
    participant RGuard as Planned RolesGuard
    participant Controller as Planned IssuesController
    participant Service as Planned IssuesService

    Client->>Guard: GET /api/issues/INB-1002 (Header: Authorization: Bearer <jwt>)
    Guard->>Guard: Inspects @Public() metadata -> Not public
    Guard->>Strategy: Validates token extraction
    Strategy->>Strategy: Verifies JWT signature against JWT_SECRET
    Strategy->>Strategy: Checks expiration claim (exp)
    Strategy->>Prisma: user.findUnique({ where: { id: payload.sub } })
    Prisma-->>Strategy: Returns active User record
    Strategy-->>Guard: Returns user object (attaches to request.user)
    Guard->>RGuard: Passes request to RolesGuard
    RGuard->>RGuard: Checks user.role against @Roles() decorator
    Note over RGuard: Role check passes
    RGuard->>Controller: Invokes getIssue(id, @CurrentUser() user)
    Controller->>Service: findOne("INB-1002")
    Service->>Prisma: Query Issue with relations
    Prisma-->>Service: Return issue data
    Service-->>Controller: Return Issue
    Controller-->>Client: HTTP 200 OK JSON (Issue Entity)
```

### 7.3 Token Failure Scenarios Table

| Scenario | Technical Cause | Expected HTTP Status | Expected JSON Error Response | Client Action |
|---|---|---|---|---|
| **Missing Token** | No `Authorization` header provided | `401 Unauthorized` | `{ "statusCode": 401, "message": "Unauthorized", "error": "Unauthorized" }` | Redirect to `/login` |
| **Malformed Token** | Header is not `Bearer <token>` (e.g. `Basic ...` or missing string) | `401 Unauthorized` | `{ "statusCode": 401, "message": "Unauthorized", "error": "Unauthorized" }` | Prompt login |
| **Invalid Signature** | Token signed with a different key or tampered with | `401 Unauthorized` | `{ "statusCode": 401, "message": "Unauthorized", "error": "Unauthorized" }` | Clear local storage & re-authenticate |
| **Expired Token** | Current timestamp > `payload.exp` | `401 Unauthorized` | `{ "statusCode": 401, "message": "Unauthorized", "error": "Unauthorized" }` | Clear session; display session expired toast |
| **Revoked / Deleted User** | Token signature valid, but `payload.sub` user deleted from database | `401 Unauthorized` | `{ "statusCode": 401, "message": "User account no longer exists", "error": "Unauthorized" }` | Invalidate local state; redirect to `/login` |
| **Insufficient Permission** | User authenticated, but lacks role specified in `@Roles()` | `403 Forbidden` | `{ "statusCode": 403, "message": "Forbidden resource", "error": "Forbidden" }` | Redirect to `/access-denied` (`AccessDeniedPage`) |

---

## 8. Authentication Versus Authorization

### 8.1 Conceptual Distinction
* **Authentication** answers: *"Who is calling this endpoint?"*
  - Handled by `AuthModule`, `JwtStrategy`, and `JwtAuthGuard`.
  - Produces a verified, authenticated principal (`request.user`).
* **Authorization** answers: *"Does this identified caller have permission to perform this specific action?"*
  - Handled by `RolesGuard` and dynamic settings policies (`Settings.rolePageAccess`).
  - Evaluates permissions only **after** authentication has completed successfully.

### 8.2 Authentication and Authorization Decision Flowchart

```mermaid
flowchart TD
    Req[Incoming HTTP Request] --> AuthCheck{Is Endpoint Authenticated?}
    AuthCheck -- No (@Public) --> Execute[Execute Action]
    
    AuthCheck -- Yes --> TokenCheck{Valid JWT Presented?}
    TokenCheck -- No --> Deny401[401 Unauthorized]
    
    TokenCheck -- Yes --> UserIdentity[Caller Identity Established in request.user]
    UserIdentity --> RoleCheck{Does Endpoint Require Specific Roles?}
    
    RoleCheck -- No Roles Defined --> Execute
    RoleCheck -- Roles Defined via @Roles --> IsAdmin{Is user.role == Admin?}
    
    IsAdmin -- Yes --> AdminBypass[Admin Satisfies Role Check]
    AdminBypass --> Execute
    
    IsAdmin -- No --> RoleMatch{user.role matches @Roles array?}
    RoleMatch -- Yes --> Execute
    RoleMatch -- No --> Deny403[403 Forbidden]
```

### 8.3 Supported Project Roles & Enum Identifiers

The system defines 8 user roles in `frontend/src/types/index.ts` and `BACKEND_ARCHITECTURE.md` Phase 5. In PostgreSQL, Prisma maps enum identifiers with spaces to database strings using `@map`:

| Display Name / TypeScript Union | Prisma PostgreSQL Enum Identifier | Primary Responsibilities & Workspace Scope |
|---|---|---|
| **Admin** | `UserRole.Admin` | Superuser governance, user management, password resets, system backups, full ticket and sprint control. |
| **Project Manager** | `UserRole.Project_Manager` (`@map("Project Manager")`) | Project portfolio administration, sprint planning, backlog ceremonies, sprint rollover, team assignments. |
| **Developer** | `UserRole.Developer` | Ticket status progression, sprint board Kanban updates, code fixes, public and internal comments. |
| **QA** | `UserRole.QA` | Issue verification, defect logging, status transitions (`Testing`, `Resolved`), test reports access. |
| **Support Agent** | `UserRole.Support_Agent` (`@map("Support Agent")`) | Frontline ticket triage, customer issue logging, L1 support queue execution, initiating tier escalations. |
| **Technical** | `UserRole.Technical` | Deep technical triage, environment verification, L2 queue execution, escalating to L3 engineering. |
| **Engineer** | `UserRole.Engineer` | Core codebase remediation, architecture fixes, L3 engineering queue execution, sprint backlog coordination. |
| **Viewer** | `UserRole.Viewer` | Read-only observation of dashboard telemetry, open issues, and team directories. Mutation forbidden. |

### 8.4 Scope of Admin Superuser Bypass
Per `docs/01_SYSTEM_ARCHITECTURE.md` Section 16.3 and `docs/02_CODING_STANDARDS.md` Section 17.2:
1. **Authentication is Mandatory**: Administrators MUST present a valid, unexpired Bearer token. `Admin` does not bypass `JwtAuthGuard`.
2. **Public Endpoints**: Endpoints decorated with `@Public()` bypass `JwtAuthGuard` and `RolesGuard` regardless of role.
3. **Role Check Bypass Only**: Within `RolesGuard`, if an authenticated user has `user.role === UserRole.Admin`, they satisfy the role check for that route.
4. **No Domain Validation Bypass**: Administrators cannot bypass DTO validation, foreign key constraints, or state machine rules.
5. **No Account Self-Lockout**: System safety constraints (such as preventing an administrator from deleting their own active account) cannot be bypassed.

### 8.5 RBAC Responsibility Table

| Component | Responsibility | What It Does NOT Do |
|---|---|---|
| **`JwtStrategy`** | Extracts Bearer token, verifies signature and expiration, populates `request.user`. | Does not check user roles or allow/deny route permissions. |
| **`JwtAuthGuard`** | Enforces that an incoming request possesses a valid JWT (unless decorated with `@Public()`). | Does not inspect user roles or evaluate operational permissions. |
| **`@Roles(...)` Decorator** | Attaches metadata array of allowed `UserRole` enums to a controller method or class via `SetMetadata`. | Does not enforce security checks on its own. |
| **`RolesGuard`** | Reads metadata via `Reflector`. Compares `user.role` to allowed roles. Allows `Admin` bypass. Throws `403 Forbidden` on mismatch. | Does not authenticate callers or parse JWT tokens. |
| **`Controller`** | Declares routing and applies decorators (`@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(...)`). | Does not implement authorization logic in method bodies. |
| **`Service`** | Executes business logic, SLA calculators, and transactions. | Does not inspect Express request headers or handle HTTP status codes. |

---

## 9. Planned Change-Password Flow

### 9.1 Change-Password Flowchart

```mermaid
flowchart TD
    Start([User Requests Password Change]) --> Submit[Submit POST /api/auth/change-password]
    Submit --> GuardCheck[JwtAuthGuard: Verify Bearer JWT]
    GuardCheck -- Invalid/Missing Token --> Err401Auth[HTTP 401 Unauthorized]
    
    GuardCheck -- Valid Token --> ValPipe[ValidationPipe: Validate ChangePasswordDto]
    ValPipe -- Missing fields or format error --> Err400Val[HTTP 400 Bad Request]
    
    ValPipe -- Valid DTO --> Svc[AuthService.changePassword]
    Svc --> FetchUser[Prisma: Fetch User by request.user.id]
    
    FetchUser --> VerifyCurrent[bcrypt.compare: currentPassword vs user.password hash]
    VerifyCurrent -- Mismatch --> Err401Pass[HTTP 401 Unauthorized: Current password incorrect]
    
    VerifyCurrent -- Match --> CheckPolicy{New Password meets policy? >= 6 chars}
    CheckPolicy -- No --> Err400Policy[HTTP 400 Bad Request: Password does not meet security criteria]
    
    CheckPolicy -- Yes --> CheckSame{New Password == Current Password?}
    CheckSame -- Yes --> Err400Same[HTTP 400 Bad Request: New password cannot be identical to current]
    
    CheckSame -- No --> HashNew[bcrypt.hash: Hash new password with 10 salt rounds]
    HashNew --> DBUpdate[Prisma: user.update with new password hash]
    DBUpdate --> SuccessResp[Return HTTP 200 OK: success = true]
    SuccessResp --> Finish([Password Update Complete])
```

### 9.2 Password Security & Policy Matrix

| Security Concern | Approved Architectural Behavior | Status | Notes |
|---|---|---|---|
| **Storage Mechanism** | PostgreSQL `User.password` column | **Planned** | Never store plaintext. Field length supports 60-character bcrypt hash strings. |
| **Hashing Algorithm** | `bcrypt` with 10 salt rounds | **Planned** | Constant-time comparison via `bcrypt.compare`. |
| **Current Password Verification** | Mandatory for self-service credential updates | **Planned** | Protects accounts against unauthorized changes from unattended sessions. |
| **Admin Reset Verification** | Current password NOT required for Admin | **Planned** | Admin superusers overwrite passwords directly via `PATCH /api/users/:id/password`. |
| **Minimum Length Policy** | Minimum 4 characters (baseline) / 6 characters (recommended) | **Planned** | Baseline frontend validates >= 4 characters; production security recommends >= 6. |
| **Response Sanitization** | Passwords excluded from all responses | **Planned** | Strip `password` property before returning entities. |
| **Token Invalidation on Password Change** | Unresolved / Planned for Phase 2 | **Unresolved** | Stateless JWTs remain valid until expiration (`7d`) unless a Redis token blocklist is introduced. |

---

## 10. JWT and Password Security Specification

### 10.1 JWT Configuration Table

| Parameter | Configuration Source | Value / Policy | Status | Security Rationale |
|---|---|---|---|---|
| **Signing Algorithm** | NestJS `JwtModule` | `HMAC-SHA256` (`HS256`) | **Planned** | Industry-standard symmetric signing algorithm. |
| **Secret Key** | `ConfigService.get('JWT_SECRET')` | `<JWT_SECRET_PLACEHOLDER>` | **Planned** | Must be a secure random 256-bit key in production. Never committed to version control. |
| **Access Token TTL** | `ConfigService.get('JWT_EXPIRATION')` | `"7d"` (MVP baseline) | **Planned** | Configured in `backend/.env.example`. Production recommendation: `"15m"`. |
| **Token Type** | HTTP Authorization Header | `Bearer` | **Planned** | Standard OAuth2 Bearer token scheme (`Authorization: Bearer <token>`). |
| **Revocation Mechanism** | Stateless token expiry | None in MVP | **Unresolved** | Stateless tokens cannot be revoked before `exp` without an external token blocklist. |

### 10.2 JWT Payload Fields Table

| Claim | Field Type | Purpose | Required? | Status | Security Constraints |
|---|---|---|---|---|---|
| **`sub`** | `string` | Subject identifier (User CUID, e.g. `user-1`) | **Yes** | **Planned** | Used to hydrate user record on protected routes. |
| **`email`** | `string` | User's primary email address | **Yes** | **Planned** | User display and identity context. |
| **`role`** | `string` | User's assigned `UserRole` enum string | **Yes** | **Planned** | Inspected by `RolesGuard` for RBAC checks. |
| **`iat`** | `number` | Issued-at Unix timestamp (seconds) | **Yes** | **Planned** | Injected automatically by `jsonwebtoken`. |
| **`exp`** | `number` | Expiration Unix timestamp (seconds) | **Yes** | **Planned** | Injected automatically based on `JWT_EXPIRATION`. |

> [!CAUTION]
> The JWT payload **MUST NOT** contain passwords, password hashes, secrets, API keys, or personally identifiable information (PII) beyond email.

### 10.3 Password Hashing and Verification Table

| Aspect | Approved Standard | Implementation Notes | Status |
|---|---|---|---|
| **Algorithm** | `bcrypt` | Hashing work factor: 10 salt rounds (`bcrypt.hash(password, 10)`). | **Planned** |
| **Verification Method** | `bcrypt.compare(plaintext, hash)` | Constant-time execution protects against timing attacks. | **Planned** |
| **Seed Data Passwords** | Seed script execution | Passwords from `seedData.ts` hashed with bcrypt before insertion into PostgreSQL. | **Planned** |
| **Database Column** | `User.password` | `String` type in Prisma schema, storing 60-character bcrypt hash strings. | **Planned** |
| **Leakage Prevention** | Query projections / field deletion | Passwords excluded from Prisma `findMany`/`findUnique` queries via `select`, or stripped before return. | **Planned** |

### 10.4 Environment Variables Specification

> [!WARNING]
> Real production secrets must never be placed in documentation or committed to version control. Actual secret values must remain exclusively in local `.env` files.

| Environment Variable | Inspected Source | Purpose | Required? | Secret? | Configuration Notes |
|---|---|---|---|---|---|
| **`PORT`** | `backend/.env.example` | Port on which the NestJS HTTP server listens | **Yes** | No | Default: `4000`. |
| **`NODE_ENV`** | `backend/.env.example` | Application execution environment | **Yes** | No | Values: `development`, `test`, `production`. |
| **`DATABASE_URL`** | `backend/.env.example` | PostgreSQL connection string for Prisma ORM | **Yes** | **Yes** | Example: `postgresql://username:password@localhost:5432/inbox_ticketing?schema=public`. |
| **`JWT_SECRET`** | `backend/.env.example` | HMAC-SHA256 secret key for signing JWTs | **Yes** | **Yes** | Placeholder: `<JWT_SECRET_PLACEHOLDER>`. Must be >= 256 bits in production. |
| **`JWT_EXPIRATION`** | `backend/.env.example` | Time-to-live string for issued access tokens | **Yes** | No | Default: `"7d"`. |
| **`CORS_ORIGIN`** | `backend/.env.example` | Whitelisted frontend origin for browser CORS | **Yes** | No | Default: `"http://localhost:3000"` (matching Vite dev server). |

---

## 11. Frontend Integration

### 11.1 Verified Existing Frontend Behavior
An inspection of the React 19 frontend codebase reveals the following existing implementation facts:

1. **Login Form (`frontend/src/pages/LoginPage.tsx`)**:
   - Collects credentials via email input or member dropdown selector (`selectedUserId`).
   - Validates that email and password fields are non-empty before submission.
   - Dispatches `login(emailInput.trim(), password)` from `AppContext`.
   - On success, navigates to the previous route (`location.state.from`) or the dashboard (`/`).
   - On failure, renders an inline error alert message.
2. **Authentication State (`frontend/src/context/AppContext.tsx`)**:
   - Maintains `isAuthenticated: boolean` and `currentUser: User` in React state.
   - Initializes `isAuthenticated` from `storage.getAuthSession().isAuthenticated`.
   - `login()` looks up the user in local state, checks `target.password || 'password123'`, and saves the session.
   - `logout()` clears the session and resets `isAuthenticated = false`.
3. **Local Persistence (`frontend/src/services/storage.ts`)**:
   - Persists state under `localStorage` keys: `inbox_auth_session`, `inbox_current_user_id`, `inbox_users`.
   - Stores mock users with password strings in browser storage.
4. **Client Route Guards (`frontend/src/App.tsx`)**:
   - `PublicOnlyRoute`: If user is authenticated, redirects from `/login` to `/`.
   - `ProtectedRoute`: If user is unauthenticated, redirects to `/login` with redirect state.
   - `RoleRoute`: Checks `currentUser.role` against dynamic permissions matrix; renders `AccessDeniedPage` if unauthorized.
5. **Network Connectivity**:
   - The frontend currently performs **zero network requests** to a backend API. It operates entirely against browser `localStorage`.

### 11.2 Planned Backend Integration
When the NestJS backend is deployed, the frontend will integrate through the planned `src/services/api.ts` HTTP client:
1. `login(emailOrId, password)` dispatches `POST /api/auth/login`.
2. On HTTP 200 response, stores `response.data.accessToken` in `localStorage` (or cookies).
3. Configures an HTTP request interceptor attaching `Authorization: Bearer <accessToken>` to all outgoing requests.
4. On HTTP 401 response, clears local authentication state and redirects to `/login`.
5. On mount, dispatches `GET /api/auth/me` to hydrate fresh user profile data from the server.

---

## 12. Request and Response Examples

### 12.1 Planned Login Request DTO (`LoginDto`)

| Field Name | Type | Required? | Validation Decorators | Description & Purpose |
|---|---|---|---|---|
| **`emailOrId`** | `string` | **Yes** | `@IsString()`, `@IsNotEmpty()` | User's registered email address (e.g. `user@example.com`) or unique identifier (e.g. `user-1`). |
| **`password`** | `string` | **Yes** | `@IsString()`, `@IsNotEmpty()` | Plaintext password to verify against stored bcrypt hash. |

### 12.2 Planned Login Request Example
```json
{
  "emailOrId": "user@example.com",
  "password": "<PLACEHOLDER_PASSWORD>"
}
```

### 12.3 Planned Successful Login Response Example (`200 OK`)
```json
{
  "accessToken": "<PLACEHOLDER_JWT>",
  "user": {
    "id": "<USER_ID_PLACEHOLDER>",
    "name": "Jane Developer",
    "email": "user@example.com",
    "role": "Developer",
    "department": "Core Platform",
    "supportLevels": ["L1"],
    "avatar": "",
    "timezone": "UTC",
    "status": "Active"
  }
}
```

### 12.4 Planned User Hydration Response Example (`GET /api/auth/me` -> `200 OK`)
```json
{
  "id": "<USER_ID_PLACEHOLDER>",
  "name": "Jane Developer",
  "email": "user@example.com",
  "role": "Developer",
  "department": "Core Platform",
  "supportLevels": ["L1"],
  "avatar": "",
  "timezone": "UTC",
  "status": "Active"
}
```

### 12.5 Planned Logout Response Example (`POST /api/auth/logout` -> `200 OK`)
```json
{
  "success": true
}
```

### 12.6 Proposed Change-Password Request DTO (`ChangePasswordDto`)

| Field Name | Type | Required? | Validation Decorators | Description & Purpose |
|---|---|---|---|---|
| **`currentPassword`** | `string` | **Yes** | `@IsString()`, `@IsNotEmpty()` | Caller's existing password to verify before authorizing change. |
| **`newPassword`** | `string` | **Yes** | `@IsString()`, `@IsNotEmpty()`, `@MinLength(6)` | Desired new password meeting security policy. |

```json
{
  "currentPassword": "<CURRENT_PASSWORD_PLACEHOLDER>",
  "newPassword": "<NEW_PASSWORD_PLACEHOLDER>"
}
```

---

## 13. Error Handling and Exception Contracts

### 13.1 Standard JSON Error Envelope
Per `docs/02_CODING_STANDARDS.md` Section 16.1, all backend exceptions must return the uniform JSON contract formatted by `HttpExceptionFilter`:
```json
{
  "statusCode": 401,
  "message": "Invalid email/userId or password",
  "error": "Unauthorized",
  "timestamp": "2026-10-12T12:00:00.000Z",
  "path": "/api/auth/login"
}
```

### 13.2 Authentication Error Matrix

| Error Scenario | HTTP Status Code | Error Code / Exception Type | Safe Client-Facing Message | Expected Behavior | Implementation Status |
|---|---|---|---|---|---|
| **Missing Request Fields** | `400 Bad Request` | `BadRequestException` | `["emailOrId should not be empty", "password should not be empty"]` | `ValidationPipe` halts execution; returns array of field errors. | **Planned** |
| **Invalid Email / User ID** | `401 Unauthorized` | `UnauthorizedException` | `"Invalid email/userId or password"` | Generic error returned. Prevents account-enumeration attacks. | **Planned** |
| **Incorrect Password** | `401 Unauthorized` | `UnauthorizedException` | `"Invalid email/userId or password"` | Generic error returned. Prevents account-enumeration attacks. | **Planned** |
| **Deactivated Account** | `401 Unauthorized` | `UnauthorizedException` | `"Account is inactive"` | Denies login to offline or deactivated staff members. | **Planned** |
| **Missing Bearer Header** | `401 Unauthorized` | `UnauthorizedException` | `"Unauthorized"` | Emitted by Passport `JwtAuthGuard` when header is absent. | **Planned** |
| **Expired Access Token** | `401 Unauthorized` | `UnauthorizedException` | `"Unauthorized"` | Token timestamp exceeds `exp` claim. | **Planned** |
| **Tampered / Bad Signature** | `401 Unauthorized` | `UnauthorizedException` | `"Unauthorized"` | Signature verification fails against `JWT_SECRET`. | **Planned** |
| **Forbidden Role** | `403 Forbidden` | `ForbiddenException` | `"Forbidden resource"` | Emitted by `RolesGuard` when user role lacks route permissions. | **Planned** |
| **Database Unavailable** | `500 Internal Error` | `InternalServerErrorException` | `"Internal server error"` | Raw PostgreSQL driver details suppressed by exception filter. | **Planned** |

---

## 14. File Responsibility Matrix

The following matrix defines the planned ownership boundaries across the backend codebase:

| File / Planned Component Path | Primary Responsibility | What It Owns | What It Must NOT Own | Collaborating Components | Status |
|---|---|---|---|---|---|
| **`backend/src/modules/auth/auth.module.ts`**<br>*(or `backend/src/auth/auth.module.ts`)* | NestJS dependency wiring for authentication. | Registration of `PassportModule`, `JwtModule`, `AuthController`, `AuthService`, `JwtStrategy`. | Business logic or controller actions. | `UsersModule`, `PrismaModule` | **Planned** |
| **`backend/src/modules/auth/auth.controller.ts`**<br>*(or `backend/src/auth/auth.controller.ts`)* | Exposes HTTP routes for login, me, and logout. | Route decorators, HTTP status code bindings, DTO parameter extraction. | Database queries, bcrypt operations, JWT generation. | `AuthService`, `CurrentUser` | **Planned** |
| **`backend/src/modules/auth/auth.service.ts`**<br>*(or `backend/src/auth/auth.service.ts`)* | Core credential verification and token creation. | Verification logic, calling `bcrypt.compare`, calling `jwtService.sign()`. | Express request/response manipulation, direct SQL queries. | `UsersService`, `JwtService`, `PrismaService` | **Planned** |
| **`backend/src/modules/auth/strategies/jwt.strategy.ts`**<br>*(or `backend/src/auth/strategies/jwt.strategy.ts`)* | Passport JWT authentication strategy. | Token extraction from `Authorization` header, signature validation, user hydration. | Route protection decisions, role authorization. | `ConfigService`, `PrismaService`, `PassportStrategy` | **Planned** |
| **`backend/src/modules/auth/dto/login.dto.ts`**<br>*(or `backend/src/auth/dto/login.dto.ts`)* | Defines and validates login request shape. | `emailOrId` and `password` properties with `class-validator` rules. | Runtime database access or hashing. | `class-validator`, `ValidationPipe` | **Planned** |
| **`backend/src/common/guards/jwt-auth.guard.ts`** | Route guard executing authentication. | Inspecting `@Public()` metadata, invoking Passport `jwt` strategy. | Role inspection or permission evaluation. | `Reflector`, `AuthGuard` | **Planned** |
| **`backend/src/common/guards/roles.guard.ts`** | Route guard executing RBAC authorization. | Reading `@Roles()` metadata, comparing against `user.role`, Admin bypass. | JWT parsing or password verification. | `Reflector`, `UserRole` | **Planned** |
| **`backend/src/common/decorators/current-user.decorator.ts`** | Parameter decorator extracting user. | Reading `request.user` from execution context. | Authentication enforcement. | `ExecutionContext` | **Planned** |
| **`backend/src/common/decorators/roles.decorator.ts`** | Metadata decorator declaring required roles. | Binding `ROLES_KEY` metadata to route handler functions. | Authorization enforcement logic. | `SetMetadata` | **Planned** |
| **`backend/src/common/pipes/validation.pipe.ts`** | Global payload sanitation and validation. | Whitelisting, transforming primitives, throwing 400 Bad Request. | Domain business logic. | NestJS `ValidationPipe` | **Planned** |
| **`backend/src/modules/users/users.service.ts`**<br>*(or `backend/src/users/users.service.ts`)* | User database operations and user lookup. | `User` queries, administrative password updates (`updatePassword`). | JWT token issuance. | `PrismaService` | **Planned** |
| **`backend/src/prisma/prisma.service.ts`** | Global database connection client. | Connection lifecycle hooks, `$transaction`, query execution. | HTTP or authentication logic. | PostgreSQL, `PrismaClient` | **Planned** |

---

## 15. Implementation Order

Developers must execute backend implementation in the following sequence once development begins:

| Step | Component to Author | Prerequisites | Deliverable & Verification Criteria | Status |
|---|---|---|---|---|
| **1** | **`backend/.env` & Config** | Copy `backend/.env.example` | Configure `PORT=4000`, `DATABASE_URL`, and `JWT_SECRET`. Server reads variables cleanly. | **Planned** |
| **2** | **Prisma Schema & Migrations** | `backend/prisma/schema.prisma` | Generate migration `init` creating PostgreSQL `User` table with `password` column and `UserRole` enum. | **Planned** |
| **3** | **Database Seed Script** | `backend/prisma/seed.ts` | Populate seed users with passwords hashed via `bcrypt.hash(password, 10)` (matching `seedData.ts`). | **Planned** |
| **4** | **`PrismaModule` & `PrismaService`** | Prisma Client installed | Global module connecting to PostgreSQL on `onModuleInit` and disconnecting on `onModuleDestroy`. | **Planned** |
| **5** | **Common Filters & ValidationPipe** | `backend/src/common/` | Implement `HttpExceptionFilter`, `PrismaExceptionFilter`, and configure global `ValidationPipe` in `main.ts`. | **Planned** |
| **6** | **`UsersModule` (Lookup Provider)** | `PrismaModule` | Implement `UsersService.findByEmailOrId()` and `UsersService.findById()` with password hash inclusion. | **Planned** |
| **7** | **`LoginDto`** | `class-validator` | Author `LoginDto` with `@IsString()` and `@IsNotEmpty()` on `emailOrId` and `password`. | **Planned** |
| **8** | **`JwtStrategy`** | `@nestjs/jwt`, `passport-jwt` | Implement Passport strategy extracting Bearer JWT, validating against `JWT_SECRET`, returning hydrated user. | **Planned** |
| **9** | **`AuthService`** | `UsersService`, `JwtModule` | Implement `login()` (bcrypt verification + JWT signing) and `validateUser()`. | **Planned** |
| **10** | **`AuthController`** | `AuthService` | Expose `POST /api/auth/login` (200 OK), `GET /api/auth/me` (200 OK), and `POST /api/auth/logout` (200 OK). | **Planned** |
| **11** | **`JwtAuthGuard` & `@Public()`** | NestJS Core, `Reflector` | Implement guard registered globally or per controller; bypasses routes decorated with `@Public()`. | **Planned** |
| **12** | **`RolesGuard` & `@Roles()`** | `Reflector` | Implement RBAC guard comparing `request.user.role` with route metadata; allows Admin superuser bypass. | **Planned** |
| **13** | **`CurrentUser` Decorator** | NestJS Core | Implement parameter decorator extracting `request.user`. | **Planned** |
| **14** | **Unit & Integration Tests** | Jest test suite | Author unit tests for `AuthService` and `JwtStrategy`; verify coverage >= 80%. | **Planned** |
| **15** | **E2E Contract Verification** | Supertest | Verify `POST /api/auth/login` returns valid JWT and authenticates protected endpoints. | **Planned** |

---

## 16. Testing Requirements and Acceptance Criteria

### 16.1 Planned Test Checklist

> [!NOTE]
> All test items below represent **Planned** test specifications. No backend automated tests currently exist or have been executed.

#### DTO Validation Tests (`login.dto.spec.ts`)
- [ ] **Planned**: Verify validation passes when valid `emailOrId` and `password` strings are provided.
- [ ] **Planned**: Verify validation fails with HTTP 400 when `emailOrId` is missing or empty.
- [ ] **Planned**: Verify validation fails with HTTP 400 when `password` is missing or empty.
- [ ] **Planned**: Verify unwhitelisted properties (e.g. `role: "Admin"`) are stripped by `ValidationPipe`.

#### Authentication Service Tests (`auth.service.spec.ts`)
- [ ] **Planned**: Verify successful login returns `accessToken` and user object with `password` omitted.
- [ ] **Planned**: Verify `UnauthorizedException` (401) is thrown when user lookup returns `null`.
- [ ] **Planned**: Verify `UnauthorizedException` (401) is thrown when `bcrypt.compare` returns `false`.
- [ ] **Planned**: Verify `UnauthorizedException` (401) is thrown when user account status is inactive or offline.
- [ ] **Planned**: Verify `jwtService.sign` is called with `{ sub, email, role }` claims.

#### JWT Strategy & Guard Tests (`jwt.strategy.spec.ts`, `jwt-auth.guard.spec.ts`)
- [ ] **Planned**: Verify valid Bearer token extracts claims and resolves user from database.
- [ ] **Planned**: Verify missing `Authorization` header throws `401 Unauthorized`.
- [ ] **Planned**: Verify token with invalid signature throws `401 Unauthorized`.
- [ ] **Planned**: Verify expired token throws `401 Unauthorized`.
- [ ] **Planned**: Verify routes decorated with `@Public()` execute without requiring an `Authorization` header.

#### Authorization Tests (`roles.guard.spec.ts`)
- [ ] **Planned**: Verify user with role `Developer` accessing route with `@Roles(UserRole.Developer)` is permitted.
- [ ] **Planned**: Verify user with role `Viewer` accessing route with `@Roles(UserRole.Admin)` throws `403 Forbidden`.
- [ ] **Planned**: Verify user with role `Admin` accessing route with `@Roles(UserRole.Project_Manager)` is permitted (Admin bypass).
- [ ] **Planned**: Verify route without `@Roles()` metadata permits any authenticated user.

#### Change-Password Tests (`change-password.spec.ts`)
- [ ] **Planned**: Verify correct current password updates database with newly hashed bcrypt password.
- [ ] **Planned**: Verify incorrect current password throws `401 Unauthorized`.
- [ ] **Planned**: Verify new password violating minimum length policy throws `400 Bad Request`.
- [ ] **Planned**: Verify plaintext password is never written to database.

#### End-to-End Tests (`auth.e2e-spec.ts`)
- [ ] **Planned**: `POST /api/auth/login` with valid credentials returns HTTP 200 with JWT.
- [ ] **Planned**: `GET /api/auth/me` with Bearer token returned from login returns authenticated user profile.
- [ ] **Planned**: `GET /api/auth/me` without Bearer token returns HTTP 401 Unauthorized.
- [ ] **Planned**: `POST /api/auth/logout` returns HTTP 200 `{ success: true }`.

---

### 16.2 Acceptance Criteria Matrix

| Criterion | Target Behavior | Status | Verification Method |
|---|---|---|---|
| **Login Endpoint Contract** | `POST /api/auth/login` accepts `emailOrId` and `password`, returns 200 OK | **Planned** | Supertest E2E test |
| **Password Verification** | Plaintext verified against bcrypt hash using constant-time comparison | **Planned** | Unit test on `AuthService` |
| **Error Message Safety** | Invalid credentials return generic message without revealing user existence | **Planned** | E2E test verifying response envelope |
| **Password Sanitization** | `password` column strictly excluded from all HTTP responses | **Planned** | JSON assertion on response body |
| **JWT Claims Shape** | Payload contains `sub`, `email`, `role`, `iat`, `exp` | **Planned** | `jwt.decode()` assertion |
| **Route Protection** | Protected routes reject requests lacking valid Bearer token | **Planned** | E2E test verifying 401 Unauthorized |
| **Public Route Bypass** | `@Public()` endpoints execute without Bearer token | **Planned** | E2E test on `/api/auth/login` |
| **RBAC Enforcement** | Users lacking required role receive 403 Forbidden | **Planned** | E2E test on role-guarded route |
| **Admin Superuser Scope** | Admin satisfies role checks in `RolesGuard` but requires valid JWT | **Planned** | Unit test on `RolesGuard` and `JwtAuthGuard` |
| **Logout Contract** | `POST /api/auth/logout` returns `{ success: true }` with 200 OK | **Planned** | Supertest E2E test |
| **Test Coverage** | Unit tests achieve >= 80% code coverage on service logic | **Planned** | `npm run test -- --coverage` |
| **Documentation Integrity** | No application source code or config modified during documentation task | **Existing** | Git status verification |

---

## 17. Open Questions and Unresolved Decisions

The following architectural trade-offs, inconsistencies, and unresolved decisions are documented for future engineering alignment:

| Question / Decision | Architectural Evidence & Conflict | Impact | Status | Recommended Next Step |
|---|---|---|---|---|
| **Module Directory Path Structure** | `BACKEND_ARCHITECTURE.md` uses flat paths (`backend/src/auth/`). `docs/01_SYSTEM_ARCHITECTURE.md` and `docs/03_MODULE_IMPLEMENTATION.md` use nested paths (`backend/src/modules/auth/`). | Inconsistent import paths across future modules. | **Unresolved** | Standardize on `backend/src/modules/auth/` (modular subfolder structure) prior to backend initialization. |
| **Token Storage Mechanism** | Frontend currently uses `localStorage` (`storage.ts`). `docs/01_SYSTEM_ARCHITECTURE.md` Section 15.2 identifies production roadmap for `HttpOnly, Secure, SameSite=Lax` cookies. | `localStorage` is accessible to JavaScript, presenting an XSS exposure risk. | **Unresolved** | Maintain `localStorage` for initial MVP cutover; transition to `HttpOnly` cookies during Phase 2 security hardening. |
| **Stateless Token Revocation** | Stateless JWT uses a `7d` expiration without a revocation blocklist. | Compromised tokens or tokens of deactivated users remain valid until expiration unless DB lookup occurs per request. | **Unresolved** | Verify user existence in `JwtStrategy.validate()` on every request; introduce Redis blocklist or short-lived tokens (15m) + refresh tokens in Phase 2. |
| **Self-Service Forgot Password Flow** | Direct overwrite exists for Admin (`PATCH /api/users/:id/password`), but public forgot-password email token flow is unmodeled. | Non-admin users who forget passwords must contact an Administrator. | **Unresolved** | Design time-limited signed email reset tokens in a subsequent authentication update sprint. |
| **Password Length Policy Inconsistency** | Frontend `AppContext.tsx` (line 781) validates password length >= 4. Production security recommends >= 6 or >= 8 characters. | Weak passwords permitted by frontend validation. | **Unresolved** | Align frontend and backend validation to enforce a minimum length of 6 characters. |
| **Brute-Force Rate Limiting** | Rate-limiting on `/api/auth/login` is not currently specified in architecture documents. | Potential vulnerability to brute-force credential stuffing. | **Proposed** | Integrate `@nestjs/throttler` on `/api/auth/login` limiting requests to 5 attempts per minute per IP. |

---
*End of Authentication Module Specification.*

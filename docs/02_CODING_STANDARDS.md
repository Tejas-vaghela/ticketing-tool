# Backend Coding Standards & Engineering Guidelines
## Ticketing Management Platform (Inbox / GoldMine Portal)

---

## 1. Purpose and Scope

### 1.1 Purpose
This document establishes the official, comprehensive coding standards, naming conventions, architectural idioms, validation rules, error handling policies, and testing guidelines for the **Ticketing Management Platform** backend. 

In a distributed engineering environment where multiple developers build modules independently across different machines, adhering to a shared standard is essential. This document guarantees that all backend code—regardless of author—shares identical semantics, type safety rigor, layered boundaries, error contracts, and database interaction patterns.

### 1.2 Scope
This standard applies to:
- All TypeScript source files, modules, controllers, services, DTOs, guards, interceptors, filters, and pipes within the NestJS backend application.
- All Prisma schema definitions, migrations, queries, and transaction blocks.
- All unit, integration, and end-to-end (E2E) automated tests.
- Code review criteria, Git commit conventions, and definition of done (DoD) verification.

---

## 2. Relationship to the System Architecture Document

This document is the second component of the project's centralized three-part technical documentation suite:

1. [**`docs/01_SYSTEM_ARCHITECTURE.md`**](01_SYSTEM_ARCHITECTURE.md):
   **The Macro Architectural Blueprint.** Governs high-level system topology, module catalog, relational database schema, SLA engine indexing, network ingress, and cross-tier responsibilities.
2. [**`docs/02_CODING_STANDARDS.md` (This Document)**](02_CODING_STANDARDS.md):
   **The Micro Engineering Standard.** Governs line-level TypeScript rules, NestJS patterns, DTO validation syntax, Prisma query safety, naming conventions, testing conventions, and code review checklists.
3. **`docs/03_MODULE_IMPLEMENTATION.md` (Planned Companion Guide)**:
   **The Detailed Module Specification.** Governs exact REST route signatures, DTO field tables, Prisma query recipes, and implementation checklists for each of the 15 backend business modules.

### Reference Document Preservation
The repository contains [**`BACKEND_ARCHITECTURE.md`**](../BACKEND_ARCHITECTURE.md) at the root level. That document represents the original system design analysis derived from the React prototype. It remains **strictly immutable**. Whenever this coding standard references an API contract, DTO shape, or Prisma relation, it preserves full compatibility with `BACKEND_ARCHITECTURE.md` and `docs/01_SYSTEM_ARCHITECTURE.md`.

---

## 3. Mandatory Rules Versus Recommendations

Standards in this document are categorized using RFC 2119 terminology:

* **MANDATORY (`MUST`, `MUST NOT`)**:
  Strict engineering rules. Non-compliance blocks pull request approval and causes automated CI pipeline failures.
* **RECOMMENDED (`SHOULD`, `SHOULD NOT`)**:
  Strong engineering best practices. Exceptions require technical rationale articulated and approved during code review.
* **OPTIONAL (`MAY`)**:
  Permissible design alternatives depending on module complexity.

| Category | Keyword | Enforcement Mechanism |
|---|---|---|
| **Mandatory** | `MUST` / `MUST NOT` | TypeScript compiler (`strict: true`), CI validation, mandatory PR block. |
| **Recommended** | `SHOULD` / `SHOULD NOT` | Peer code review, linter warnings, architecture review. |
| **Optional** | `MAY` | Developer discretion based on module ergonomics. |

---

## 4. General TypeScript Principles

### 4.1 Strict Type Safety
- **`MUST` enable strict mode**: The backend `tsconfig.json` MUST enforce `"strict": true`, `"noImplicitAny": true`, and `"strictNullChecks": true`.
- **Property Initialization in DTOs**: Because DTO classes rely on runtime decorator reflection and are instantiated dynamically by `class-transformer` without constructor arguments, developers SHOULD either:
  1. Set `"strictPropertyInitialization": false` in the backend `tsconfig.json`, OR
  2. Use the TypeScript definite assignment assertion operator (`!`) on non-optional DTO fields (e.g., `title!: string;`).
- **`MUST NOT` use `any`**: The `any` type is strictly forbidden in all application code, service methods, controllers, and DTOs. If a type is unknown or dynamic, use `unknown` with type narrowing, or `Record<string, unknown>`.
- **`MUST` explicitly type public API returns**: All controller actions and public service methods MUST declare explicit return types (e.g., `Promise<Issue>`, `Promise<User[]>`). Do not rely on compiler type inference for public interfaces.

### 4.2 Type Declarations vs Interfaces
- **`MUST` use `interface` for structural object definitions**: Domain entities, service contracts, and configuration options MUST use `interface`.
- **`MUST` use `type` for unions, intersections, and mapped types**: Enum aliases, status unions, and utility transformations MUST use `type`.

### 4.3 Nullability and Undefined
- **`MUST` distinguish between `null` and `undefined`**:
  - In Prisma queries and database entities, database `NULL` translates to `null`.
  - In DTOs and optional request parameters, omitted fields are `undefined` (use `?` optional marker and `@IsOptional()`).
  - Never equate `null` with `undefined` using loose equality (`==`). Always use strict equality (`===`).

---

## 5. File and Folder Naming

To ensure cross-platform compatibility across Windows, macOS, and Linux environments, all file and folder names MUST use lowercase alphanumeric characters with hyphens (kebab-case).

### 5.1 File Naming Conventions

| Component Type | Naming Pattern | Example File Name |
|---|---|---|
| **Module** | `<domain>.module.ts` | `issues.module.ts`, `saved-filters.module.ts` |
| **Controller** | `<domain>.controller.ts` | `issues.controller.ts`, `auth.controller.ts` |
| **Service** | `<domain>.service.ts` | `issues.service.ts`, `users.service.ts` |
| **DTO** | `<action>-<domain>.dto.ts` | `create-issue.dto.ts`, `escalate-issue.dto.ts` |
| **Query DTO** | `query-<domain>.dto.ts` | `query-issues.dto.ts`, `query-users.dto.ts` |
| **Entity / Model** | `<domain>.entity.ts` | `issue.entity.ts`, `project.entity.ts` |
| **Guard** | `<purpose>.guard.ts` | `jwt-auth.guard.ts`, `roles.guard.ts` |
| **Decorator** | `<purpose>.decorator.ts` | `current-user.decorator.ts`, `roles.decorator.ts` |
| **Filter** | `<purpose>.filter.ts` | `http-exception.filter.ts`, `prisma-exception.filter.ts` |
| **Pipe** | `<purpose>.pipe.ts` | `validation.pipe.ts` |
| **Strategy** | `<protocol>.strategy.ts` | `jwt.strategy.ts` |
| **Unit Test** | `<target>.spec.ts` | `issues.service.spec.ts`, `auth.controller.spec.ts` |
| **E2E Test** | `<target>.e2e-spec.ts` | `issues.e2e-spec.ts`, `auth.e2e-spec.ts` |

### 5.2 Directory Structure
- All domain modules MUST reside in dedicated kebab-case directories (e.g., `backend/src/modules/saved-filters/` or `backend/src/saved-filters/`).
- Sub-elements within a module MUST be categorized into dedicated folders:
  - `dto/` — All Request/Response DTO classes.
  - `interfaces/` — Local module interfaces and type contracts.
  - `strategies/` — Passport and authentication strategies.

---

## 6. Class, Interface, Type, Enum, Variable, and Function Naming

### 6.1 Casing Matrix

| Construct | Casing | Rule / Pattern | Example |
|---|---|---|---|
| **Classes** | `PascalCase` | Noun phrase with component suffix | `IssuesService`, `JwtAuthGuard` |
| **Controllers** | `PascalCase` | Entity + `Controller` | `IssuesController`, `UsersController` |
| **Services** | `PascalCase` | Entity + `Service` | `IssuesService`, `PrismaService` |
| **DTOs** | `PascalCase` | Verb + Entity + `Dto` | `CreateIssueDto`, `UpdateStatusDto` |
| **Interfaces** | `PascalCase` | Descriptive noun phrase (no `I` prefix) | `AuthenticatedUser`, `SLAConfig` |
| **Type Aliases** | `PascalCase` | Descriptive noun phrase | `AppPageId`, `NotificationType` |
| **Enums** | `PascalCase` | Singular noun phrase | `IssueStatus`, `Priority`, `UserRole` |
| **Enum Members** | `PascalCase` / `@map` | Matches frontend union string | `IssueStatus.In_Progress`, `Priority.Highest` |
| **Functions / Methods**| `camelCase` | Verb or verb phrase | `escalateIssue()`, `calculateSLADeadline()` |
| **Variables / Properties**| `camelCase` | Descriptive noun phrase | `issueId`, `responseSLAHours` |
| **Boolean Variables** | `camelCase` | Prefixed with `is`, `has`, `should`, `can` | `isEscalated`, `hasAccess`, `canManage` |
| **Constants** | `UPPER_SNAKE_CASE`| Static immutable global values | `ROLES_KEY`, `DEFAULT_PAGE_SIZE` |

### 6.2 Prisma Enum Mapping Rules
The existing React frontend types (`src/types/index.ts`) contain union strings with spaces and hyphens (e.g., `'In Progress'`, `'Sub-task'`, `'Project Manager'`). 
In the PostgreSQL Prisma schema, valid enum identifiers MUST use explicit `@map` attributes so generated Prisma types map directly to the frontend's expected string values:

```prisma
enum IssueType {
  Task
  Bug
  Story
  Epic
  Sub_task @map("Sub-task")
}

enum IssueStatus {
  Open
  To_Do       @map("To Do")
  In_Progress @map("In Progress")
  In_Review   @map("In Review")
  Testing
  Blocked
  Resolved
  Closed
}

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

enum ProjectStatus {
  Active
  Planning
  Completed
  On_Hold @map("On Hold")
}
```

In TypeScript code:
- **`MUST` reference enum members via enum object**: `IssueStatus.In_Progress`, `UserRole.Support_Agent`.
- **`MUST NOT` hardcode loose string literals** in backend business logic comparisons.

---

## 7. NestJS Module Conventions

### 7.1 Module Encapsulation Rules
- **`MUST` explicitly declare `imports`, `controllers`, `providers`, and `exports`**: Every module MUST declare its boundaries explicitly.
- **`MUST` export only reusable services**: Never export controllers or internal repositories. Export only services intended for consumption by other domain modules (e.g., `UsersService`, `NotificationsService`).
- **`MUST NOT` use global modules for domain logic**: `@Global()` is strictly reserved for the core infrastructure module (`PrismaModule`). Domain modules (`IssuesModule`, `UsersModule`) MUST NOT be decorated with `@Global()`.

```typescript
// Correct Module Declaration
@Module({
  imports: [PrismaModule, NotificationsModule, ActivityModule],
  controllers: [IssuesController],
  providers: [IssuesService],
  exports: [IssuesService],
})
export class IssuesModule {}
```

---

## 8. Controller Coding Rules

### 8.1 Single Responsibility Principle
Controllers are HTTP adapters. Their sole responsibility is to translate incoming HTTP requests into domain service calls, apply HTTP-level decorators, and return HTTP responses.

### 8.2 Mandatory Controller Rules
1. **`MUST NOT` contain business logic**: Controllers MUST NOT contain `if/else` domain workflows, calculation loops, or database queries.
2. **`MUST NOT` inject `PrismaService` directly**: Controllers MUST NOT access the database directly. All database access occurs in the service layer.
3. **`MUST` use explicit HTTP method decorators**: `@Get()`, `@Post()`, `@Patch()`, `@Delete()`.
4. **`MUST` use `@Patch()` for partial updates**: Standard resource updates MUST use `@Patch()`, not `@Put()`.
5. **`MUST` extract authenticated user via `@CurrentUser()`**: Never parse `req.user` directly from an untyped Express request object.

### 8.3 HTTP Status Code Rules
Controllers MUST return appropriate HTTP status codes based on the nature of the operation:

* **Resource Creation (`POST`)**:
  Endpoints that create a new persistent database entity (e.g., `POST /api/issues`, `POST /api/projects`, `POST /api/sprints`, `POST /api/comments`) return `201 Created` with the newly created resource. (This is the default for `@Post()` in NestJS).
* **Action & Workflow Operations (`POST`)**:
  Endpoints that execute an action, workflow transition, authentication, or bulk update rather than a simple entity creation MUST explicitly use `@HttpCode(HttpStatus.OK)` to return `200 OK`:
  - `POST /api/auth/login` -> `@HttpCode(HttpStatus.OK)` (returns `{ accessToken, user }`)
  - `POST /api/auth/logout` -> `@HttpCode(HttpStatus.OK)` (returns `{ success: true }`)
  - `POST /api/issues/:id/escalate` -> `@HttpCode(HttpStatus.OK)` (returns updated `Issue`)
  - `POST /api/sprints/:id/start` -> `@HttpCode(HttpStatus.OK)` (returns updated `Sprint`)
  - `POST /api/sprints/:id/complete` -> `@HttpCode(HttpStatus.OK)` (returns `{ sprint, rolledOverCount }`)
  - `POST /api/notifications/mark-all-read` -> `@HttpCode(HttpStatus.OK)` (returns `{ success: true }`)
  - `POST /api/system/reset` -> `@HttpCode(HttpStatus.OK)` (returns `{ success: true }`)
* **Retrieval & Partial Update (`GET`, `PATCH`)**:
  Return `200 OK` (default) with the requested entity or list.
* **Deletion (`DELETE`)**:
  Per the existing API contracts in `BACKEND_ARCHITECTURE.md`, deletion endpoints MUST return `200 OK` with `{ success: true }` (or `{ success: true, id }`).
  > [!WARNING]
  > Do **NOT** return `204 No Content` for deletions. The React frontend relies on parsing JSON confirmations (`await response.json()`). Returning `204 No Content` without a body will cause client-side JSON parsing errors.

### 8.4 Controller Pattern Example
```typescript
// Correct Controller Pattern
@Controller('issues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  // Default status: 201 Created
  async createIssue(
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Issue> {
    return this.issuesService.create(dto, user.id);
  }

  @Post(':id/escalate')
  @HttpCode(HttpStatus.OK) // Explicit 200 OK for workflow action
  @Roles(UserRole.Admin, UserRole.Support_Agent, UserRole.Technical)
  async escalateIssue(
    @Param('id') id: string,
    @Body() dto: EscalateIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Issue> {
    return this.issuesService.escalate(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK) // Explicit 200 OK returning confirmation payload
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  async deleteIssue(@Param('id') id: string): Promise<{ success: boolean; id: string }> {
    return this.issuesService.delete(id);
  }
}
```

---

## 9. Service Coding Rules

### 9.1 Domain Logic Ownership
Services own all business logic, workflow sequencing, SLA computations, permission checks, and transaction coordination.

### 9.2 Mandatory Service Rules
1. **`MUST` be decorated with `@Injectable()`**.
2. **`MUST` handle missing entities explicitly**: Use `findUniqueOrThrow()` or check for `null` and throw `NotFoundException`:
   ```typescript
   const issue = await this.prisma.issue.findUnique({ where: { id } });
   if (!issue) {
     throw new NotFoundException(`Ticket ${id} was not found.`);
   }
   ```
3. **`MUST NOT` leak database errors directly**: Translate unique constraint failures or invalid references to clean HTTP exceptions.
4. **`MUST` keep methods focused**: A service method should perform one logical operation. Break complex algorithms (e.g., SLA deadline calculators) into private helper functions.

---

## 10. DTO and Validation Rules

### 10.1 Validation Boundary
All request validation occurs at the perimeter using `class-validator` decorators before request data reaches the controller handler.

### 10.2 Mandatory DTO Rules
1. **`MUST` decorate every property**: Every property on a DTO MUST have at least one validation decorator (`@IsString()`, `@IsInt()`, `@IsEnum89 etc.).
2. **`MUST` declare optional fields explicitly**: If a field is optional, decorate it with `@IsOptional()` AND use TypeScript's optional operator `?`.
3. **`MUST` validate array items**: For array properties, use `@IsArray()` and provide `{ each: true }` on inner validators (e.g., `@IsString({ each: true })`).
4. **`MUST` use `@Type()` for nested objects**: Nested DTO classes MUST be decorated with `@ValidateNested()` and `@Type(() => NestedDto)` from `class-transformer`.
5. **`MUST NOT` use interfaces for DTOs**: DTOs MUST be TypeScript `class` definitions, because classes survive compilation to runtime metadata required by `class-validator`.
6. **Partial Update DTOs**: For update operations (`PATCH`), use `PartialType` from `@nestjs/mapped-types` to avoid duplicating field declarations from the creation DTO.

### 10.3 Global ValidationPipe Configuration
In `main.ts`, the global `ValidationPipe` MUST be registered with suitable options:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Strips unexpected fields not defined in DTO
    forbidNonWhitelisted: true,    // Throws 400 Bad Request if unexpected fields are sent
    transform: true,              // Automatically coerces payloads to DTO class instances
    transformOptions: {
      enableImplicitConversion: true, // Automatically converts primitive query strings (e.g. limit="50" to 50)
    },
  }),
);
```

### 10.4 DTO Examples

```typescript
// backend/src/modules/issues/dto/create-issue.dto.ts
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray, IsInt, Min, IsDateString } from 'class-validator';
import { IssueType, Priority, SupportLevel } from '@prisma/client';

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(IssueType)
  type!: IssueType;

  @IsEnum(Priority)
  priority!: Priority;

  @IsEnum(SupportLevel)
  supportLevel!: SupportLevel;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  sprintId?: string;

  @IsString()
  @IsOptional()
  epicId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  labels?: string[];

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  storyPoints?: number;

  @IsString()
  @IsOptional()
  estimatedTime?: string;
}
```

```typescript
// backend/src/modules/issues/dto/update-issue.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateIssueDto } from './create-issue.dto';

export class UpdateIssueDto extends PartialType(CreateIssueDto) {}
```

---

## 11. Dependency Injection Rules

1. **`MUST` use constructor injection**: All dependencies MUST be injected via constructor parameters using `private readonly`:
   ```typescript
   constructor(
     private readonly prisma: PrismaService,
     private readonly notificationsService: NotificationsService,
   ) {}
   ```
2. **`MUST NOT` instantiate services with `new`**: Never manually instantiate an `@Injectable()` service using `new ServiceName()`. Let the NestJS IoC container resolve instances.
3. **`MUST NOT` create circular dependencies**: Modules MUST NOT import each other in a cycle (`Module A -> Module B -> Module A`). If two modules need each other:
   - Extract the shared provider into a third shared module, OR
   - Decouple using `@nestjs/event-emitter`.
   - Use `forwardRef()` only as a last resort with explicit code review approval.

---

## 12. Prisma and Database Access Rules

### 12.1 Query Organization
1. **`MUST` use `PrismaService` as primary data access layer**: Standard CRUD operations MUST use Prisma Client typed methods (`findMany`, `findUnique`, `create`, `update`, `delete`).
2. **`MUST NOT` perform N+1 queries**: Never execute secondary queries inside a `.map()` or `for` loop. Use Prisma relation queries with `include` or `select`:
   ```typescript
   // INCORRECT (N+1 query anti-pattern):
   const issues = await this.prisma.issue.findMany();
   for (const issue of issues) {
     issue.comments = await this.prisma.comment.findMany({ where: { issueId: issue.id } });
   }

   // CORRECT (Single optimized query):
   const issues = await this.prisma.issue.findMany({
     include: { comments: { include: { author: true } } },
   });
   ```
3. **`MUST` use selective field queries for large lists**: On list endpoints (e.g., `GET /api/issues`), avoid pulling large text fields or full relation trees. Use `select` to project only required fields and relational counts (`_count`).
4. **`MUST` enforce pagination on unrestricted lists**: All list queries MUST support `take` (limit, default 50, maximum 100) and `skip` (offset).

### 12.2 Raw SQL Policy
Raw SQL (`prisma.$queryRaw` or `prisma.$executeRaw`) is **permitted when justified**, such as:
1. Complex analytical or reporting queries that Prisma Client cannot express efficiently.
2. Performance-critical queries requiring native PostgreSQL interval math or computed expressions (e.g., SLA deadline intervals).
3. Full-text search ranking using PostgreSQL `tsvector` and `tsquery`.

**Mandatory Raw SQL Rules**:
- **`MUST` use parameterized queries**: Raw queries MUST use tagged template literals (`Prisma.sql` or tagged `$queryRaw` template string) to guarantee parameterization.
- **`MUST NOT` use string concatenation**: Never concatenate unvalidated user input into raw SQL queries (e.g., `$queryRawUnsafe` with string interpolation is strictly FORBIDDEN).
- **`MUST` declare return types**: All raw queries MUST be typed with an explicit TypeScript interface (e.g., `prisma.$queryRaw<IssueReportRow[]>`)...
- **`MUST` encapsulate in service layer**: Raw SQL must reside exclusively inside service methods, accompanied by a comment explaining why Prisma Client was insufficient.

---

## 13. Database Transaction Guidelines

### 13.1 Mandatory Transaction Scenarios
A database transaction (`prisma.$transaction`) MUST be used whenever an operation modifies multiple database tables or requires atomic consistency:

1. **Ticket Escalation**:
   - Creating `EscalationRecord`
   - Updating `Issue` support tier and assignee
   - Creating automated internal `Comment`
   - Inserting `ActivityEvent` audit record
2. **Sprint Completion & Rollover**:
   - Updating completed `Sprint` status to `completed`
   - Updating unresolved `Issue` records to target sprint or `null` (backlog)
3. **Project Creation**:
   - Creating `Project` record
   - Adding lead user as project member
   - Inserting initial `ActivityEvent`

### 13.2 Transactions vs External Notifications
> [!IMPORTANT]
> **Database transactions guarantee database consistency, NOT external message delivery.**

* **`MUST NOT` perform external I/O inside database transactions**:
  Never execute network requests, SMTP email delivery, push notification services, or third-party webhooks inside `prisma.$transaction`. 
  - Holding database connections open while awaiting external HTTP/SMTP responses exhausts the connection pool under load.
  - If the external network call fails or times out, it causes unnecessary database rollbacks.
  - If the database transaction rolls back *after* an external email is dispatched, the email cannot be un-sent.
* **Recommended Two-Phase Pattern**:
  1. **Phase 1 (Atomic Database Mutation)**: Execute and commit all relational updates within `prisma.$transaction`.
  2. **Phase 2 (Post-Commit Event Dispatch)**: Upon successful transaction completion, emit an asynchronous domain event via `@nestjs/event-emitter` (`EventEmitter2`) or queue a background job:
     ```typescript
     // 1. Atomic Database Transaction
     const updatedIssue = await this.prisma.$transaction(async (tx) => {
       const issue = await tx.issue.findUniqueOrThrow({ where: { id } });
       
       await tx.escalationRecord.create({ ... });
       await tx.comment.create({ ... });
       await tx.activityEvent.create({ ... });
       // Create in-app database notification record
       if (dto.assignedToUserId) {
         await tx.notification.create({ ... });
       }
       
       return tx.issue.update({ ... });
     });

     // 2. Post-Commit External Notification Dispatch (Safe outside transaction)
     this.eventEmitter.emit('issue.escalated', new IssueEscalatedEvent(updatedIssue, dto));
     ```

---

## 14. API Naming and HTTP Method Conventions

### 14.1 Resource Paths
- **`MUST` use plural nouns**: `/api/issues`, `/api/projects`, `/api/sprints`, `/api/users`.
- **`MUST` use kebab-case for multi-word paths**: `/api/saved-filters`, `/api/auth/change-password`.
- **`MUST NOT` use verbs in resource paths**: Use `POST /api/sprints/:id/start`, not `/api/startSprint`.

### 14.2 HTTP Method Mapping

| Method | Idempotent? | Purpose | Success Status | Return Body |
|---|---|---|---|---|
| `GET` | Yes | Retrieve resource or list | `200 OK` | `Resource` or `Resource[]` |
| `POST` (Creation) | No | Create persistent resource | `201 Created` | Created `Resource` |
| `POST` (Action) | No | Execute action / workflow / auth | `200 OK` | Updated `Resource` or `{ success: true }` |
| `PATCH` | No | Partial update of fields | `200 OK` | Updated `Resource` |
| `DELETE` | Yes | Remove resource | `200 OK` | `{ success: true }` |

---

## 15. Request and Response Conventions

### 15.1 Response Envelope Rule
**`MUST NOT` introduce custom wrapper envelopes**:
The React 19 frontend expects direct model responses (`Issue`, `Issue[]`, `Project[]`, `User`) as specified in [**`BACKEND_ARCHITECTURE.md`**](../BACKEND_ARCHITECTURE.md#phase-8--api-endpoints-specification). Do NOT wrap successful responses in `{ data: ..., meta: ... }`.

### 15.2 Date and Time Serialization
All dates returned via JSON MUST be serialized as UTC ISO-8601 strings (e.g., `"2026-10-10T12:00:00.000Z"`).

---

## 16. Error Handling and Exception Conventions

### 16.1 Standard JSON Error Envelope
All errors returned by the backend MUST conform to this exact contract:

```json
{
  "statusCode": 404,
  "message": "Ticket INB-1002 was not found.",
  "error": "Not Found",
  "timestamp": "2026-10-10T12:00:00.000Z",
  "path": "/api/issues/INB-1002"
}
```

### 16.2 Standard Exception Mapping

| Scenario | Thrown Exception | HTTP Code |
|---|---|---|
| Missing entity | `NotFoundException` | `404 Not Found` |
| Validation failure | Handled by `ValidationPipe` | `400 Bad Request` |
| Invalid credentials | `UnauthorizedException` | `401 Unauthorized` |
| Insufficient role / permission | `ForbiddenException` (or `RolesGuard`) | `403 Forbidden` |
| Duplicate key (email, project key) | `ConflictException` (or Prisma P2002) | `409 Conflict` |
| Unhandled runtime error | Intercepted by `HttpExceptionFilter` | `500 Internal Server Error` |

### 16.3 Client Security Rule
**`MUST NOT` leak stack traces or driver details**: In production (`NODE_ENV === 'production'`), error responses MUST NOT include stack traces, internal IP addresses, database schemas, or raw SQL queries.

---

## 17. Authentication and Authorization Conventions

### 17.1 Route Protection Standard
- All routes require authentication by default unless explicitly decorated with `@Public()`.
- Endpoints requiring specific roles MUST use the `@Roles(...)` decorator:
  ```typescript
  @Post()
  @Roles(UserRole.Admin, UserRole.Project_Manager)
  async createProject(@Body() dto: CreateProjectDto) { ... }
  ```

### 17.2 Clarified Superuser & RBAC Rules
- **Authentication is mandatory**: The `Admin` role does NOT bypass authentication. An administrator must present a valid, unexpired Bearer token on all protected endpoints.
- **Public endpoints**: Endpoints decorated with `@Public()` (such as `POST /api/auth/login`) bypass both `JwtAuthGuard` and `RolesGuard`.
- **Role check bypass**: Inside `RolesGuard`, if an authenticated user possesses `user.role === UserRole.Admin`, they satisfy the role requirement.
- **Scope of Admin bypass**:
  - Admin bypass applies ONLY to role checks in `RolesGuard`.
  - Admin does NOT bypass resource validation rules, state machine transitions, or database constraints.
  - Admin does NOT bypass self-protection constraints (e.g., an administrator cannot delete their own active account).

---

## 18. Logging and Audit-Logging Rules

### 18.1 Technical Logging
- Use NestJS `Logger` within services:
  ```typescript
  private readonly logger = new Logger(IssuesService.name);
  this.logger.log(`Ticket ${id} escalated to ${dto.toLevel}`);
  ```
- **`MUST NOT` log sensitive data**: Passwords, JWT secrets, authorization headers, and personal identifiable information (PII) MUST NEVER be logged.

### 18.2 Business Audit Trail (`ActivityEvent`)
Every significant state mutation (ticket created, escalated, resolved, comment posted) MUST insert an `ActivityEvent` record. Audit events are append-only; they MUST NOT be updated or deleted.

---

## 19. Configuration and Environment Variables

### 19.1 Accessing Environment Variables
- **`MUST NOT` access `process.env` directly in services**: Always inject `ConfigService` from `@nestjs/config`:
  ```typescript
  constructor(private readonly configService: ConfigService) {
    const port = this.configService.get<number>('PORT', 4000);
  }
  ```
- **Startup Validation**: Environment variables MUST be validated at application startup using a Joi or class-validator schema. If required variables (`DATABASE_URL`, `JWT_SECRET`) are missing, the server MUST fail to boot immediately.
- **No Insecure Defaults in Production**: Never provide fallback default secrets (e.g., `'secret'`) in production mode.

---

## 20. Security and Sensitive Data Handling

### 20.1 Password Hashing
- **`MUST` hash passwords with bcrypt**:
  ```typescript
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  ```
- **`MUST NOT` return password hashes in responses**: Always exclude the `password` field from user database queries using Prisma `select`, or delete the field before returning the object.

### 20.2 Secret Management
- **`MUST NOT` commit `.env` files**: Only `.env.example` with dummy values may be checked into Git.
- **`MUST NOT` hardcode fallback secrets** in source code.

---

## 21. Async/Await and Promise Handling

1. **`MUST` use async/await**: Do not use raw `.then()` / `.catch()` callback chains.
2. **`MUST` await all asynchronous calls**: Never invoke an asynchronous Prisma query without `await`. Floating promises cause uncaught rejections and silent transaction failures.
3. **`MUST` use `Promise.all()` for independent queries**:
   ```typescript
   // Correct: Parallel execution
   const [issues, totalCount] = await Promise.all([
     this.prisma.issue.findMany({ where, skip, take }),
     this.prisma.issue.count({ where }),
   ]);
   ```

---

## 22. Import Organization

Imports MUST be grouped in this exact order with an empty line separating each group:

1. **NestJS and Framework packages**: `@nestjs/common`, `@nestjs/core`, `@nestjs/jwt`
2. **Third-party libraries**: `class-validator`, `bcrypt`, `passport`
3. **Prisma Client**: `@prisma/client`
4. **Common module imports**: `../../common/guards`, `../../common/decorators`
5. **Sibling module imports**: `../notifications/notifications.service`
6. **Local module imports**: `./dto/create-issue.dto`, `./issues.service`

```typescript
// Correct Import Order
import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IssueStatus, Priority } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateIssueDto } from './dto/create-issue.dto';
```

---

## 23. Comments and Documentation

1. **`MUST` use JSDoc for public service methods**: Document the method's purpose, parameters, return value, and possible thrown exceptions.
2. **`MUST NOT` write redundant comments**: Comments like `// get the issue by id` above `this.getIssueById(id)` are forbidden.
3. **`MUST` document complex business logic**: Explain *why* a particular business decision was made (e.g., SLA warning calculation logic).

---

## 24. Unit Testing Standards

### 24.1 Scope & Isolation
- Unit tests (`*.service.spec.ts`) test domain service logic in isolation.
- **`MUST` mock `PrismaService`**: Unit tests MUST NOT connect to a real database. Use Jest mocks for all database operations.

### 24.2 Unit Test Pattern
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { PrismaService } from '../prisma/prisma.service';

describe('IssuesService', () => {
  let service: IssuesService;
  let prisma: {
    issue: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      issue: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssuesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<IssuesService>(IssuesService);
  });

  it('should throw NotFoundException when issue does not exist', async () => {
    prisma.issue.findUnique.mockResolvedValue(null);
    await expect(service.findOne('INB-9999')).rejects.toThrow(NotFoundException);
  });
});
```

---

## 25. Integration Testing Standards

- Integration tests verify that controllers, services, validation pipes, and error filters work together properly.
- External dependencies (email delivery, external third-party APIs) are mocked, while Prisma can use a dedicated test PostgreSQL instance or transaction rollback runner.

---

## 26. End-to-End Testing Standards

- E2E tests (`test/*.e2e-spec.ts`) execute full HTTP user flows using `supertest`.
- Test cases MUST cover:
  1. Successful authentication (`POST /api/auth/login` -> 200 with JWT).
  2. Guard enforcement (`GET /api/issues` without token -> 401 Unauthorized).
  3. RBAC enforcement (User role `Viewer` calling `POST /api/projects` -> 403 Forbidden).
  4. Validation rejection (Invalid body -> 400 Bad Request with field details).

---

## 27. Code Formatting and Linting

1. **Indentation**: 2 spaces (no tabs).
2. **Quotes**: Single quotes (`'`) for strings in TypeScript; double quotes (`"`) in JSON.
3. **Semicolons**: Required at the end of every statement.
4. **Line Length**: Maximum 100 characters per line.
5. **Trailing Commas**: ES5 multi-line trailing commas enabled.
6. **Code Quality Targets**:
   - Coverage targets (e.g., >= 80% on domain service logic) represent **project quality goals** to be configured in Jest configuration once the backend test suite is initialized.
   - Code must pass TypeScript compilation (`tsc --noEmit`) with zero errors.

---

## 28. Git Branching and Commit Conventions

### 28.1 Branch Naming
- `feature/<module-name>-<short-description>` (e.g., `feature/issues-escalation-workflow`)
- `fix/<module-name>-<short-description>` (e.g., `fix/auth-bcrypt-compare-error`)
- `chore/<short-description>` (e.g., `chore/setup-prisma-migrations`)

### 28.2 Conventional Commits
All commit messages MUST adhere to the Conventional Commits specification:
- `feat(issues): implement ticket escalation endpoint`
- `fix(users): exclude password hash from user query response`
- `test(sprints): add unit tests for sprint rollover service`
- `docs(api): document query parameters for issue listing`
- `refactor(common): extract reusable pagination DTO`

---

## 29. Code Review Checklist

Reviewers MUST verify the following before approving any pull request:

- [ ] **Type Safety**: No `any` types. All return types explicitly declared.
- [ ] **Boundary Compliance**: Controller contains no business logic or Prisma calls.
- [ ] **HTTP Status Codes**: Creation endpoints return 201; actions/deletions return 200 with JSON payload.
- [ ] **Validation**: All incoming request fields have `class-validator` decorators.
- [ ] **Database Safety**: No N+1 queries. Selective fields used for list endpoints.
- [ ] **Transactions**: Multi-table database mutations wrapped in `prisma.$transaction`.
- [ ] **No Network Calls in Transactions**: External notifications/emails dispatched *after* database commit.
- [ ] **Security**: Passwords hashed with bcrypt. Password field excluded from responses.
- [ ] **Guards**: Proper `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(...)` applied.
- [ ] **Error Handling**: Standard NestJS HTTP exceptions used (`NotFoundException`, etc.).
- [ ] **Tests**: Unit tests provided for new service methods with mocked database calls.
- [ ] **Linting**: Code passes TypeScript check cleanly.

---

## 30. Common Mistakes to Avoid

| Anti-Pattern | Why It Is Harmful | Correct Alternative |
|---|---|---|
| **Calling Prisma in Controllers** | Breaks layered architecture; makes unit testing impossible. | Delegate to Service; Service calls Prisma. |
| **Using `any` for DTOs or Entities** | Defeats TypeScript compile-time safety. | Use typed DTO classes and Prisma generated types. |
| **N+1 queries in loops** | Degrades database performance exponentially under load. | Use Prisma `include` or batch `findMany` queries. |
| **External I/O inside DB transactions** | Holds database locks; risks connection pool starvation. | Commit DB transaction first; emit domain event for notifications. |
| **Returning 204 No Content on delete** | Breaks React frontend JSON parser (`response.json()`). | Return `200 OK` with `{ success: true }`. |
| **Loose string status comparisons** | Typos cause silent runtime bugs. | Compare against enum constants (`IssueStatus.In_Progress`). |
| **Returning raw database exceptions** | Leaks database schema details and gives 500 errors. | Catch and translate to `NotFoundException` or `ConflictException`. |
| **Forgetting `@Injectable()`** | NestJS IoC container cannot resolve the provider. | Always decorate services with `@Injectable()`. |
| **Committing `.env` with real credentials** | Severe security vulnerability. | Keep real credentials in local `.env` only; commit `.env.example`. |

---

## 31. Examples of Correct and Incorrect Patterns

### 31.1 Controller Delegation & Status Codes

```typescript
// ❌ INCORRECT: Controller executes business logic, uses any, and returns wrong status
@Controller('issues')
export class IssuesController {
  constructor(private prisma: PrismaService) {}

  @Post(':id/escalate') // Returns default 201 Created for a workflow action!
  async escalateIssue(@Param('id') id: string, @Body() body: any) {
    if (!body.reason) throw new BadRequestException('Reason required');
    return this.prisma.issue.update({
      where: { id },
      data: { supportLevel: body.toLevel },
    });
  }
}

// ✅ CORRECT: Controller is thin, returns 200 OK for action, uses typed DTO
@Controller('issues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post(':id/escalate')
  @HttpCode(HttpStatus.OK) // Explicit 200 OK for workflow operation
  @Roles(UserRole.Admin, UserRole.Support_Agent, UserRole.Technical)
  async escalateIssue(
    @Param('id') id: string,
    @Body() dto: EscalateIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Issue> {
    return this.issuesService.escalate(id, dto, user.id);
  }
}
```

### 31.2 Database Querying and N+1 Prevention

```typescript
// ❌ INCORRECT: Inefficient N+1 query loop
async getProjectSummary(projectId: string) {
  const issues = await this.prisma.issue.findMany({ where: { projectId } });
  for (const issue of issues) {
    const comments = await this.prisma.comment.findMany({ where: { issueId: issue.id } });
    issue.commentCount = comments.length;
  }
  return issues;
}

// ✅ CORRECT: Single round-trip with Prisma relation counts
async getProjectSummary(projectId: string) {
  return this.prisma.issue.findMany({
    where: { projectId },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      assignee: { select: { id: true, name: true, avatar: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  });
}
```

---

## 32. Definition of Done (DoD)

A module or feature is considered **Done** and ready for merge into `main` only when:

1. **Architecture Compliance**: The implementation matches the domain boundaries defined in [**`docs/01_SYSTEM_ARCHITECTURE.md`**](01_SYSTEM_ARCHITECTURE.md).
2. **Coding Standards Compliance**: The code adheres strictly to all mandatory rules in this document (`docs/02_CODING_STANDARDS.md`).
3. **Type Safety**: TypeScript compiles with zero errors under `"strict": true`. Zero uses of `any`.
4. **Validation**: All endpoints validate request payloads via `class-validator` DTOs.
5. **Authorization**: All endpoints enforce authentication and proper RBAC roles.
6. **Tests**: Unit tests pass for service business logic with mocked database calls.
7. **No Secrets**: No private credentials or secrets are present in code or commit history.
8. **Code Review**: At least one senior peer review approval obtained.

---
*End of Coding Standards Specification.*
*Refer to [docs/01_SYSTEM_ARCHITECTURE.md](01_SYSTEM_ARCHITECTURE.md) for macro-architecture and docs/03_MODULE_IMPLEMENTATION.md (planned) for module-by-module contracts.*

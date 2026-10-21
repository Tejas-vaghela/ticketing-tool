# Users Module — Ticketing Management Platform

**Module path**: `backend/src/users/`
**API base**: `http://localhost:4000/api/users`
**Status**: Implemented and build-verified

---

## Folder Structure

```
backend/src/users/
├── users.module.ts           # NestJS module declaration
├── users.controller.ts       # REST controller — 6 endpoints
├── users.service.ts          # Business logic, RBAC, bcrypt, Prisma queries
├── dto/
│   ├── create-user.dto.ts    # POST /users body
│   ├── update-user.dto.ts    # PATCH /users/:id body
│   ├── change-password.dto.ts  # PATCH /users/:id/password body
│   └── query-users.dto.ts    # GET /users query params
└── README.md                 # This file
```

---

## API Endpoints

| Method | URL | Auth | Roles |
|--------|-----|------|-------|
| GET | /api/users | JWT | All |
| GET | /api/users/:id | JWT | All |
| POST | /api/users | JWT | Admin only |
| PATCH | /api/users/:id | JWT | Admin / PM / Self |
| DELETE | /api/users/:id | JWT | Admin only |
| PATCH | /api/users/:id/password | JWT | Admin / Self |

---

## Request & Response Examples

### GET /api/users — List Users

Query params (all optional):
- `page` (integer, default 1)
- `limit` (integer, default 20, max 100)
- `search` (string, case-insensitive match on name and email)
- `role` (UserRole enum, e.g. `Support_Agent`)
- `status` (UserStatus enum, e.g. `Active`)
- `supportLevel` (SupportLevel enum, e.g. `L1`)
- `department` (string, case-insensitive contains)

Response (200):
```json
{
  "data": [
    {
      "id": "clxyz1234abc",
      "name": "Rahul Sharma",
      "email": "rahul.s@inbox.goldmine.io",
      "role": "Support Agent",
      "department": "Customer Support",
      "supportLevels": ["L1"],
      "avatar": "https://...",
      "timezone": "UTC+05:30 (IST)",
      "status": "Active",
      "createdAt": "2026-01-15T09:00:00.000Z",
      "updatedAt": "2026-10-01T12:30:00.000Z"
    }
  ],
  "total": 14,
  "page": 1,
  "limit": 10,
  "totalPages": 2
}
```

### POST /api/users — Create User (Admin only)

Request body:
```json
{
  "name": "Ananya Kapoor",
  "email": "ananya.k@inbox.goldmine.io",
  "password": "secure@Pass1",
  "role": "Support_Agent",
  "department": "Customer Support",
  "supportLevels": ["L1"],
  "avatar": "https://images.unsplash.com/photo-...?w=150",
  "timezone": "UTC+05:30 (IST)",
  "status": "Active"
}
```

Response (201): SafeUser object (no password field)
Response (409): Duplicate email conflict

### PATCH /api/users/:id — Update User

Request body (partial, all fields optional):
```json
{
  "department": "Technical Operations",
  "supportLevels": ["L1", "L2"],
  "status": "Away"
}
```

Response (200): Updated SafeUser object
Response (403): Not authorized to update another user

### DELETE /api/users/:id

Response (200):
```json
{ "message": "User clxyz1234abc has been permanently deleted." }
```

### PATCH /api/users/:id/password — Change Password

Admin reset (newPassword only):
```json
{ "newPassword": "adminReset@Pass3" }
```

Self-service change (currentPassword required):
```json
{
  "newPassword": "newSecure@Pass2",
  "confirmPassword": "newSecure@Pass2",
  "currentPassword": "oldPassword@1"
}
```

Response (200): `{ "message": "Password updated successfully." }`
Response (400): `{ "message": "Current password is incorrect." }`

---

## RBAC Permission Matrix

| Endpoint | Admin | Project Mgr | Others |
|----------|:-----:|:-----------:|:------:|
| GET /users | Yes | Yes | Yes |
| GET /users/:id | Yes | Yes | Yes |
| POST /users | Yes | No | No |
| PATCH /users/:id (any) | Yes | Yes | No |
| PATCH /users/:id (self) | Yes | Yes | Yes |
| DELETE /users/:id | Yes | No | No |
| PATCH /:id/password (any) | Yes | No | No |
| PATCH /:id/password (self) | Yes | Yes | Yes |

---

## UserRole Enum Values

Use these exact values in API requests:

| Value | DB Display |
|-------|-----------|
| Admin | Admin |
| Project_Manager | Project Manager |
| Developer | Developer |
| QA | QA |
| Support_Agent | Support Agent |
| Technical | Technical |
| Engineer | Engineer |
| Viewer | Viewer |

---

## Validation Rules

| Field | Rule |
|-------|------|
| name | Required on create, max 100 chars |
| email | Valid RFC 5322 format, globally unique |
| password | Create: required, min 8, max 128 chars |
| newPassword | Min 8, max 128 chars |
| confirmPassword | If provided, must match newPassword |
| role | Must be valid UserRole enum value |
| department | Required on create, max 100 chars |
| supportLevels | Array, 1-3 items, each L1/L2/L3 |
| avatar | Optional string, max 500 chars |
| timezone | Optional string, max 100 chars |
| status | Must be Active/Away/Offline |
| page | Integer, min 1 |
| limit | Integer, min 1, max 100 |

---

## Password Security

- All passwords hashed with bcrypt at 10 salt rounds
- Password field is NEVER returned in any API response
- Self-service change requires currentPassword for verification
- Admin password reset does NOT require Admin's own password
- JWT tokens remain valid after password change until expiry (stateless JWT)

---

## Business Rules

| Rule | HTTP Response |
|------|---------------|
| Self-delete | 400 Bad Request |
| Last Admin deletion | 400 Bad Request |
| Delete user who is project lead | 400 Bad Request |
| Non-Admin editing another user | 403 Forbidden |
| Self role escalation to Admin | 403 Forbidden |
| Non-Admin changing own role | 403 Forbidden |
| Duplicate email | 409 Conflict |

---

## Cascading Behavior on User Delete

| Related Data | Behavior |
|---|---|
| Notification[] | Deleted (CASCADE) |
| SavedFilter[] | Deleted (CASCADE) |
| Project[] (memberProjects) | Removed from M:M join table |
| Issue[] (assignedIssues) | assigneeId set to NULL |
| EscalationRecord[] (EscalatedTo) | assignedToUserId set to NULL |
| Issue[] (reportedIssues) | Preserved (audit trail) |
| Comment[] | Preserved (audit trail) |
| ActivityEvent[] | Preserved (audit trail) |
| Project[] (ledProjects) | BLOCKED - pre-checked by service |

---

## Postman Testing Guide

Environment variables:
- base_url = http://localhost:4000/api
- admin_token = JWT from POST /api/auth/login (Admin credentials)
- user_token = JWT from POST /api/auth/login (non-Admin credentials)
- test_user_id = ID of a created test user

25 Test Cases:

1. GET /users with admin_token -> 200, array returned, no password field
2. GET /users with no token -> 401
3. GET /users?role=Support_Agent with admin_token -> 200, only Support Agent users
4. GET /users?search=tejas with admin_token -> 200, matches on name
5. GET /users?page=1&limit=5 with admin_token -> 200, 5 records, totalPages populated
6. GET /users/:valid_id with any token -> 200, SafeUser object
7. GET /users/nonexistent999 with admin_token -> 404
8. POST /users with admin_token (valid body) -> 201, SafeUser, no password
9. POST /users with user_token -> 403
10. POST /users with duplicate email (admin_token) -> 409
11. POST /users missing name field -> 400 validation error
12. POST /users with password shorter than 8 chars -> 400
13. POST /users with invalid role value -> 400
14. PATCH /users/:own_id with user_token -> 200, updated SafeUser
15. PATCH /users/:other_id with admin_token -> 200, updated SafeUser
16. PATCH /users/:other_id with user_token -> 403
17. PATCH /users/:own_id {"role":"Admin"} with user_token -> 403
18. DELETE /users/:test_id with admin_token -> 200, success message
19. DELETE /users/:test_id with user_token -> 403
20. DELETE /users/:own_admin_id with admin_token -> 400
21. PATCH /users/:id/password {"newPassword":"Admin@NewPass1"} with admin_token -> 200
22. PATCH /users/:own_id/password (correct currentPassword) with user_token -> 200
23. PATCH /users/:own_id/password (wrong currentPassword) with user_token -> 400
24. GET /users with admin_token - verify response body has no "password" key
25. GET /users with expired token -> 401

---

## Frontend Compatibility Notes

| Conflict | Frontend | Backend |
|----------|----------|---------|
| Password minimum length | AdminPanel enforces min 4 chars | Backend enforces min 8 chars |
| Role input | TeamPage uses free-text input | Backend validates against UserRole enum |
| Missing department | TeamPage hardcodes 'Customer Operations' | Backend requires department field |
| User IDs | Frontend generates 'user-' + timestamp | Backend uses Prisma CUID |
| Password in response | AdminPanel shows plaintext from localStorage | Backend never returns password |

---

## Environment Requirements

backend/.env:
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_EXPIRATION=7d
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

---

Module implemented: 2026-10-13
TypeScript: Zero errors (tsc --noEmit)
NestJS build: Passed (nest build)

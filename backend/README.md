# Backend Service — Ticketing Management Platform

This directory contains the NestJS modular backend for the Ticketing Management Platform.

## Planned Technology Stack
- **Framework**: NestJS (v10.x / v11.x) with Express adapter
- **Language**: TypeScript 5.x+
- **ORM**: Prisma ORM
- **Database**: PostgreSQL 16+
- **Authentication**: Stateless JWT with Passport

## Architectural Blueprint & Coding Standards
- Refer to [docs/01_SYSTEM_ARCHITECTURE.md](../docs/01_SYSTEM_ARCHITECTURE.md) for macro architecture, module organization, and data pipeline.
- Refer to [docs/02_CODING_STANDARDS.md](../docs/02_CODING_STANDARDS.md) for line-level coding standards, DTO validation, and testing rules.
- Refer to [BACKEND_ARCHITECTURE.md](../BACKEND_ARCHITECTURE.md) for complete entity specifications and endpoint schemas.

## Quick Setup Guide (When Initializing)
1. Initialize the NestJS application:
   ```bash
   npx -y @nestjs/cli new . --package-manager npm --skip-git
   ```
2. Install dependencies:
   ```bash
   npm install @prisma/client @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer dotenv
   npm install -D prisma @types/passport-jwt @types/bcrypt @types/node
   ```
3. Initialize and configure Prisma:
   ```bash
   npx prisma init
   ```
4. Copy schema from `BACKEND_ARCHITECTURE.md` Phase 5 to `prisma/schema.prisma`.
5. Run migrations & start dev server:
   ```bash
   npx prisma migrate dev --name init
   npm run start:dev
   ```

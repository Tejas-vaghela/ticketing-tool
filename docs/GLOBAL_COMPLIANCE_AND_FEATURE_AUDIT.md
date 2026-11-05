# Global Compliance, Feature, and Policy Audit Report

**Application:** Ticketing Management Platform ("Inbox")  
**Target Markets:** United States (USA) & United Kingdom (UK)  
**Audit Conducted By:** Senior DevOps, Security, and Compliance Specialist  
**Inspection Scope:** React Frontend, NestJS Backend, PostgreSQL Prisma Schema, RBAC, REST APIs, System Controls, Storage, and Telemetry  
**Date of Audit:** November 4, 2026  
**Document Status:** Official Production Readiness Assessment  

---

## A. Executive Summary

### Overall Audit Findings
An exhaustive, code-level inspection was performed on the Ticketing Management Platform across its React 19 frontend, NestJS 10.4 backend, and PostgreSQL database managed via Prisma 6.19. All 15 functional application modules—including Authentication, RBAC, Issues, Kanban Board, Attachments, Notifications, Epics, Sprints, Global Search, Activity Telemetry, Saved Filters, System Administration, Workspace Settings, and Reports—are **functionally implemented and integrated**. 

However, from a **regulatory compliance, privacy governance, enterprise security, and accessibility** perspective, the platform currently operates as an **early-stage internal/MVP system** rather than a production-ready enterprise product for the commercial USA and UK markets. While the operational workflows (ticket routing, L1/L2/L3 escalation, SLA timers) work as designed, the platform lacks critical legal notices, automated data subject request (DSR) workflows, secure session handling, data retention controls, accessibility attributes, and internationalization mechanisms.

### USA Market Readiness: NOT READY (High Legal & Operational Risk)
The platform is currently **NOT READY** for commercial deployment in the United States. 
- **Privacy Gaps:** There is no customer-facing Privacy Policy, no Terms of Service, and no consent collection mechanism at registration or login. For businesses subject to the **California Consumer Privacy Act (CCPA/CPRA)** or emerging state privacy laws (Virginia CDPA, Colorado CPA, Connecticut CTDPA, etc.), there is no "Notice at Collection", no "Do Not Sell or Share My Personal Information" mechanism, and no automated data export or deletion workflow for consumer requests.
- **Accessibility & ADA Risk:** The web interface lacks essential Web Content Accessibility Guidelines (**WCAG 2.2 AA**) attributes—including ARIA modal dialog tags, focus-trapping, and accessible names on icon buttons—exposing the operating company to digital accessibility lawsuits under **Title III of the Americans with Disabilities Act (ADA)**.
- **Security Deficiencies:** Passwords lack enforced entropy/complexity rules, there is no Multi-Factor Authentication (MFA), no login rate limiting (vulnerable to brute-force credential stuffing), and JWT access tokens are stored in browser `localStorage` with a 7-day lifetime.

### UK Market Readiness: NOT READY (Severe Regulatory Risk under UK GDPR & DPA 2018)
The platform is currently **NOT READY** for deployment to UK data subjects or UK corporate customers.
- **UK GDPR / Data Protection Act 2018 Violations:**
  - **Article 17 (Right to Erasure / "Right to be Forgotten"):** The application explicitly prevents user deletion if the user is associated with any ticket (`reporterId`) or comment. There is no pseudonymization/anonymization pipeline (e.g., reassigning historical tickets to `[Deleted User]`). Furthermore, end-users cannot self-delete or request deletion via their profile.
  - **Article 15 & 20 (Right of Access & Data Portability):** End-users cannot download or export an archive of their own personal data. Only root administrators can download a full, unsegregated PostgreSQL JSON database dump (`/api/system/export`), which commingles all users' data.
  - **Article 13 & 14 (Transparency & Privacy Notices):** No privacy notice disclosing the Data Controller's identity, lawful basis for processing, international transfer safeguards, or the UK Information Commissioner's Office (ICO) complaint process is provided.
  - **Article 32 (Security of Processing):** The administrative endpoint `/api/system/reset` executes `await tx.activityEvent.deleteMany()`, allowing administrators to wipe the entire immutable audit trail.
- **PECR & Cookies:** Although no tracking cookies are currently set, third-party Unsplash profile avatars are directly loaded from external US CDNs without user consent or local proxy caching.
- **Equality Act 2010:** Inaccessible web forms and dialogs breach public-sector and commercial digital accessibility expectations.

### Major Risks Summary
1. **Unprotected Credential Brute-Forcing:** `/api/auth/login` has no rate limiting or account lockout, allowing automated credential stuffing.
2. **Plaintext Reset Token Logging:** In `backend/src/auth/auth.service.ts`, password reset tokens are logged to server output (`this.logger.log(...)`), creating credential leakage risks in cloud logging environments.
3. **Audit Trail Destruction:** The administrative factory reset feature physically deletes all historical `ActivityEvent` records from PostgreSQL, failing audit integrity requirements.
4. **Token Theft via XSS:** Long-lived 7-day bearer JWTs stored in `localStorage` without server-side revocation on logout allow session hijacking if any client injection occurs.
5. **No Data Loss Prevention (DLP):** Support tickets and comments can store unencrypted customer personal data, payment info, or secrets with no masking, regex detection, or redaction tools.

### Critical Missing Features and Policies
- Privacy Policy, Terms of Service, and explicit consent tracking.
- Self-service Data Subject Rights portal (Export My Data, Delete My Account / Anonymize Me).
- Role-scoped data isolation (preventing cross-project ticket enumeration).
- Multi-Factor Authentication (TOTP / SMS).
- Session security hardening (HttpOnly SameSite cookies, 15-minute token expiry, refresh token rotation).
- Malware/antivirus scanning for file attachments.
- Regional date/time formatting (US `MM/DD/YYYY` vs. UK `DD/MM/YYYY`).

---

## B. Compliance Matrix

| Regulation / Standard | Region | Requirement | Current Implementation | Status | Evidence | Required Changes |
|---|---|---|---|---|---|---|
| **CCPA / CPRA** (Cal. Civ. Code § 1798.100 et seq.) | United States (California) | Notice at Collection & transparent disclosure of categories of personal info collected. | Login screen (`LoginPage.tsx`) and application pages contain no privacy notice, terms, or link to disclosure. | **Not Implemented** | `frontend/src/pages/LoginPage.tsx` (Lines 290–325). No privacy links or disclosures present. | Add persistent footer and pre-login privacy notice detailing data categories, purposes, and retention periods. |
| **CCPA / CPRA** (Cal. Civ. Code § 1798.105, 1798.110) | United States (California) | Consumer Right to Know (Access) & Right to Delete personal information. | System only provides full database export for Admins (`/api/system/export`). Self-service deletion is blocked; admin deletion of users who reported tickets is blocked by FK constraints. | **Not Implemented** | `backend/src/users/users.service.ts` (Lines 260–297): throws `BadRequestException` when user attempts self-delete or if user has reported issues. | Implement `/api/users/me/export` (scoped to user's personal data) and `/api/users/me/anonymize` (replaces user identity with pseudonym `[Deleted User]`). |
| **CCPA / CPRA** (Cal. Civ. Code § 1798.120) | United States (California) | "Do Not Sell or Share My Personal Information" link / opt-out. | Platform does not sell data, but lacks the affirmative statutory declaration or opt-out mechanism. | **Partially Implemented** | No third-party ad trackers present in `index.html`. No statutory link or policy present. | Add policy statement confirming personal data is not sold/shared, and provide opt-out link if third-party analytics are added. |
| **US State Breach Laws** (e.g., Cal. Civ. Code § 1798.82, NY SHIELD Act) | United States | Notify affected individuals and state AGs without unreasonable delay upon breach of unencrypted personal info. | No automated breach-detection, security-incident response plan, or bulk-export alerting exists in platform. | **Not Implemented** | `backend/src/system/system.service.ts`: allows bulk data dump without rate limits, audit notifications, or multi-admin quorum. | Create formal Incident Response Policy (IRP), implement alert webhooks when `/api/system/export` is invoked, and restrict export with MFA. |
| **CAN-SPAM Act** (15 U.S.C. 7701) | United States | Commercial email requirements (accurate headers, opt-out, physical postal address). | Platform sends no external marketing or commercial emails. Notifications are strictly in-app records. | **Not Applicable** | `backend/src/notifications/notifications.service.ts` only writes to PostgreSQL `Notification` table; no SMTP/SES/SendGrid client exists. | If external email notifications or digests are added, include physical postal address and one-click unsubscribe links. |
| **ADA Title III / Section 508** | United States | Auxiliary aids and accessible web design for public accommodations (WCAG 2.1/2.2 AA). | Frontend lacks essential ARIA attributes, focus trapping in modal overlays, and accessible labels on icon-only buttons. | **Partially Implemented** | `frontend/src/components/common/ConfirmModal.tsx` (Lines 36–41): close button has no `aria-label`; missing `role="dialog"` and `aria-modal="true"`. | Refactor modal components with Radix UI / headless primitives or add complete ARIA dialog roles, focus traps, and keyboard listeners. |
| **UK GDPR** (Article 5(1)(c), (e)) | United Kingdom | Data Minimisation & Storage Limitation (retain data only as long as necessary). | Ticket descriptions, comments, and attachments are retained indefinitely. No automated TTL or purge schedule exists. | **Not Implemented** | `backend/prisma/schema.prisma` and cron schedules: no archival or retention purge logic exists in any backend service. | Implement configurable data retention policies in `Settings` (e.g., auto-archive closed tickets after 365 days; delete raw attachments after retention window). |
| **UK GDPR** (Article 6 & 7) | United Kingdom | Lawful Basis for Processing & Conditions for Consent. | No consent recording table or mechanism exists. Platform relies implicitly on contract performance without documentation. | **Requires Legal Review** | Database schema lacks consent logs (`consentGivenAt`, `policyVersion`). | Establish and document formal Record of Processing Activities (ROPA). Add consent tracking for optional processing. |
| **UK GDPR** (Article 12, 13, 14) | United Kingdom | Transparent Information, Communication and Modalities (Privacy Notice). | No Privacy Policy or Data Controller contact details available to users. | **Not Implemented** | No privacy policy document or route exists in `frontend/src/App.tsx`. | Draft and publish comprehensive UK GDPR-compliant Privacy Notice identifying Controller, DPO, lawful basis, retention, and ICO complaint rights. |
| **UK GDPR** (Article 15, 20) | United Kingdom | Right of Access & Data Portability (machine-readable personal data export). | Individual users cannot export their personal data. Admin export commingles company-wide relational tables. | **Not Implemented** | `backend/src/system/system.controller.ts`: `GET /api/system/export` is restricted strictly to `Admin` and dumps entire DB. | Build `/api/users/me/export` returning JSON containing only user profile, assigned tickets, authored comments, and audit events. |
| **UK GDPR** (Article 17) | United Kingdom | Right to Erasure ("Right to be Forgotten"). | User self-deletion is rejected with `400 Bad Request`. Admin deletion fails if user has authored tickets or comments. | **Not Implemented** | `backend/src/users/users.service.ts` (Lines 260–305): explicit blocks prevent deleting users with associated issues/comments. | Add User Anonymization workflow: reassign `reporterId`, `authorId`, and `assigneeId` to system ghost account `[Deleted User]` and delete credentials/PII. |
| **UK GDPR** (Article 32) | United Kingdom | Security of Processing (appropriate technical & organisational measures). | Passwords hashed with bcrypt (salt 10). However, JWT tokens lack revocation, reset tokens are logged in plaintext, and audit logs can be wiped. | **Partially Implemented** | `backend/src/auth/auth.service.ts` (Lines 326–331) logs raw reset token; `system.service.ts` (Lines 231, 470) deletes `activityEvent`. | Remove plaintext token logging, enforce short-lived JWTs with HttpOnly cookies, and prevent deletion of `ActivityEvent` table records. |
| **UK GDPR** (Article 33, 34) | United Kingdom | Notification of Personal Data Breach to ICO within 72 hours. | No breach monitoring, anomaly detection, or breach reporting runbook exists in codebase or documentation. | **Not Implemented** | No intrusion detection or exfiltration alerting implemented. | Draft Data Breach Incident Response Plan. Implement logging alerts for rapid ICO 72-hour notification. |
| **UK GDPR** (Chapter V, Articles 44–50) | United Kingdom | International Transfers of Personal Data (adequacy, IDTA, SCCs). | If hosted on US infrastructure (AWS/Vercel/Render US regions), UK user data is transferred cross-border without documented safeguards. | **Requires Legal Review** | Architecture relies on global US cloud endpoints without regional hosting selection or Standard Contractual Clauses (SCCs). | Offer UK/EU regional database hosting (e.g., AWS `eu-west-2` London or Frankfurt) and execute UK International Data Transfer Agreements. |
| **PECR** (SI 2003/2426) | United Kingdom | Privacy and Electronic Communications Regulations (Cookies & Trackers). | No cookies are currently set; uses `localStorage`. External Unsplash avatars load from US server without consent. | **Partially Implemented** | `frontend/src/services/api.ts` uses `localStorage`. Profile avatars in `seedData.ts` point to `images.unsplash.com`. | Replace external Unsplash URLs with local generic SVG avatars. If analytics/session cookies are introduced, deploy cookie banner. |
| **Equality Act 2010** | United Kingdom | Duty to make reasonable adjustments for disabled persons (Digital Services). | Web accessibility barriers (contrast, keyboard navigation, missing screen reader labels) exist in interface. | **Partially Implemented** | Modal close buttons, status badges, and tab panels lack semantic ARIA attributes. | Audit and remediate all interactive components against WCAG 2.2 Level AA. |
| **OWASP Top 10:2021** | International | Web Application Security Standards (A01 Broken Access Control, A02 Cryptographic Failures, A07 Auth Failures). | RBAC implemented via NestJS guards. However, object-level tenant scoping is missing; JWT stored in `localStorage`; no login rate limiting. | **Partially Implemented** | `backend/src/issues/issues.service.ts`: users can view any ticket if authenticated; `frontend/src/services/api.ts`: JWT in `localStorage`. | Implement project-level membership checks, migrate tokens to HttpOnly Secure cookies, and add `@nestjs/throttler` rate limiting. |
| **OWASP API Top 10:2023** | International | API Security Standards (API1 BOLA, API2 Broken Authentication, API4 Unrestricted Resource Consumption). | DTO validation via `class-validator` (good). Lacks API rate limits, lacks project membership checks (BOLA), reset tokens in logs. | **Partially Implemented** | No throttling middleware in `backend/src/main.ts`. Endpoints permit unlimited rapid requests. | Add `@nestjs/throttler` (e.g. 100 req/min global, 5 req/min on `/auth/*`). Enforce project permission checks on `/api/issues/:id`. |
| **WCAG 2.2 Level AA** | International | Web Content Accessibility Guidelines (Perceivable, Operable, Understandable, Robust). | Contrast issues on text (`text-zinc-400` on white), unlabelled icon buttons, lack of focus management in popups and dropdowns. | **Partially Implemented** | `frontend/src/components/topbar/GlobalSearchModal.tsx` and `ConfirmModal.tsx`: missing accessible labels and focus traps. | Ensure minimum contrast ratio 4.5:1 for normal text, add `aria-label` to all icon buttons, and implement keyboard focus trapping in dialogs. |
| **ISO/IEC 27001:2022** | International | Information Security Management System (ISMS) controls. | Access control and database transactions exist. Formal ISMS policies, risk assessments, and vulnerability management are absent. | **Requires Legal Review** | Internal organizational policies and external audit certifications are outside application codebase scope. | Establish formal Information Security Policy, Vendor Risk Management, and annual penetration testing. |
| **SOC 2 Type II** | International | Trust Services Criteria (Security, Availability, Confidentiality). | Production readiness requires immutable audit logs, MFA, automated backups, and restricted admin access. Current reset endpoint deletes audit logs. | **Not Implemented** | `/api/system/reset` executes destructive table wipes including audit logs (`tx.activityEvent.deleteMany()`). | Disable destructive reset in production environments; forward audit logs to immutable cloud storage (AWS S3 Glacier / CloudWatch). |

---

## C. Feature Audit Matrix

| Module / Feature | Implemented? | Functionality Verified? | Policy Alignment | Issues Found | Required Changes | Evidence / Inspected Code |
|---|---|---|---|---|---|---|
| **1. Authentication** | Yes | Yes (Backend & Frontend verified) | Non-Compliant with UK/US auth guidelines | No MFA support; no rate limiting on login/reset endpoints; 7-day JWT stored in `localStorage`; plaintext reset tokens printed in server logs; logout does not invalidate JWT. | Add rate limiting (`@nestjs/throttler`); migrate tokens to HttpOnly cookies; add token blacklist on logout; remove console logging of reset tokens. | `backend/src/auth/auth.service.ts` (Lines 165–241, 326–331); `frontend/src/services/api.ts` (Line 18). |
| **2. Users & RBAC** | Yes | Yes (CRUD & 8 Roles verified) | Partially Aligned | Cannot delete users who authored tickets/comments (blocks GDPR Art. 17); no user self-deletion; passwords displayed in admin UI; no self-service personal data export. | Implement User Anonymization pipeline (`[Deleted User]`); allow account deletion requests; remove plaintext password storage/display. | `backend/src/users/users.service.ts` (Lines 260–305); `frontend/src/pages/AdminPanelPage.tsx` (Lines 175–178). |
| **3. Projects** | Yes | Yes (CRUD & Key generation verified) | Partially Aligned | Deleting project cascades and permanently deletes all tickets, comments, and attachments without legal hold check. | Implement soft-delete / archival flag (`isArchived`) rather than immediate physical cascade deletion. | `backend/prisma/schema.prisma` (Line 158: `onDelete: Cascade` on issues/epics/sprints). |
| **4. Issues & Tickets** | Yes | Yes (Auto ID, SLA calculation, CRUD) | Partially Aligned | Any authenticated user can read tickets across projects (no project-membership boundary / BOLA); no sensitive data redaction/DLP. | Enforce project membership check in `IssuesService`; add DLP regex check to flag SSNs/credit cards in ticket descriptions. | `backend/src/issues/issues.controller.ts` (Lines 57–60); `backend/src/issues/issues.service.ts` (Lines 130–170). |
| **5. Support Escalations (L1/L2/L3)** | Yes | Yes (Atomic transitions, SLA recompute) | Compliant with ITIL & SLA practices | Operational workflow is verified; escalation records track actor and timestamps. No cross-tier confidentiality controls. | Maintain existing escalation logic; consider restricting visibility of L3 internal engineering notes from frontline viewers. | `backend/src/issues/issues.service.ts` (Lines 420–490); `frontend/src/components/tickets/EscalateModal.tsx`. |
| **6. Kanban Board** | Yes | Yes (Drag-and-drop status update, SLA preserved) | Compliant | Updates status through backend validation pipes; maintains optimistic UI updates. | None. Operational workflow verified. | `backend/src/kanban/kanban.controller.ts`; `frontend/src/pages/KanbanBoard.tsx`. |
| **7. Attachments & Files** | Yes | Yes (Upload, Streamable download, Delete) | Non-Compliant with cloud security | Files stored unencrypted on local container disk; no antivirus/malware scanning; MIME type checked only by extension (no magic byte check). | Integrate virus scanning (ClamAV); migrate to S3/Cloudflare R2 with encryption at rest; inspect magic numbers for true MIME verification. | `backend/src/attachments/storage/storage.service.ts` (Lines 14–30); `backend/src/attachments/attachments.service.ts` (Lines 27–54). |
| **8. Notifications** | Yes | Yes (In-app alerts, read status, system alerts) | Compliant | Strictly in-app notifications. No external emails sent, avoiding CAN-SPAM violations. | If email digests are added in future, implement opt-out and unsubscription headers. | `backend/src/notifications/notifications.service.ts` (Lines 28–70); `frontend/src/context/AppContext.tsx`. |
| **9. Epics** | Yes | Yes (CRUD, color badges, progress) | Compliant | Proper input validation (`MaxLength`, Hex regex for color). | None. Feature functions as intended. | `backend/src/epics/epics.controller.ts`; `backend/src/epics/dto/create-epic.dto.ts`. |
| **10. Sprints** | Yes | Yes (Lifecycle: start, complete, rollover) | Compliant | Incomplete issues correctly roll over to backlog or target sprint upon sprint closure. | None. Workflow is verified. | `backend/src/sprints/sprints.service.ts` (Lines 350–430); `frontend/src/context/AppContext.tsx`. |
| **11. Global Search** | Yes | Yes (Multi-entity instant search) | Partially Aligned | Search returns matching users, projects, and tickets globally to any user regardless of project membership. | Scope search results to projects where the authenticated user is an assigned member. | `backend/src/search/search.service.ts` (Lines 40–110); `frontend/src/components/topbar/GlobalSearchModal.tsx`. |
| **12. Activity Audit Feed** | Yes | Yes (Append-only feed, issue/project history) | Non-Compliant with audit standards | Audit trail is wiped during administrative system reset (`deleteMany()`); administrative password changes are not logged. | Make audit logs strictly append-only (remove `deleteMany()` in `SystemModule`); record user credential and permission modifications. | `backend/src/system/system.service.ts` (Lines 231, 470); `backend/src/activity/activity.service.ts`. |
| **13. Saved Filters** | Yes | Yes (Per-user filter presets, CRUD) | Compliant | Filters are scoped strictly to the authenticated user ID. | None. Feature functions as intended. | `backend/src/saved-filters/saved-filters.service.ts` (Lines 28–50). |
| **14. System Administration** | Yes | Yes (Health probe, DB export/import, Reset) | Non-Compliant with enterprise security | Full unencrypted JSON DB dump downloadable by any Admin without MFA or re-authentication; reset endpoint destroys production data and audit logs. | Require step-up re-authentication/MFA for database exports; disable factory reset in production environments (`NODE_ENV=production`). | `backend/src/system/system.controller.ts` (Lines 58–95); `backend/src/system/system.service.ts`. |
| **15. Reports & Analytics** | Yes | Yes (Summary metrics, SLA compliance rate) | Compliant | Real-time aggregate queries compute total, breached, at-risk, and tier distribution counts. | Ensure reports respect tenant boundaries if multi-tenancy is introduced. | `backend/src/reports/reports.service.ts` (Lines 15–140); `frontend/src/pages/ReportsPage.tsx`. |

---

## D. Security and Privacy Audit

### 1. High-Risk Vulnerabilities

#### VULN-01: Plaintext Password Reset Token Leakage via Application Logs
- **Affected File:** [`backend/src/auth/auth.service.ts`](file:///C:/Users/kirit/Desktop/tp/ticketing-tool/backend/src/auth/auth.service.ts#L326-L331)
- **Code:**
  ```typescript
  this.logger.log(`[DEV] Password reset token for ${user.email}: ${rawToken} (valid for 1 hour)`);
  this.logger.log(`[DEV] Reset URL: http://localhost:3000/reset-password?token=${rawToken}`);
  ```
- **Risk Level:** **HIGH**
- **Impact:** Any user, developer, or automated monitoring tool with access to production stdout logs (e.g. Render/Datadog/CloudWatch) can hijack any user's account by requesting a reset and copying the active token from the log stream.
- **Recommended Fix:** Completely remove plaintext token logging. In production, dispatch the token strictly over encrypted SMTP/TLS via an email provider (SendGrid, Postmark, AWS SES).

#### VULN-02: Missing Rate Limiting on Authentication & Public Endpoints (CWE-307)
- **Affected Endpoints:** `POST /api/auth/login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- **Risk Level:** **HIGH**
- **Impact:** An attacker can perform automated high-volume credential stuffing or brute-force user passwords without being blocked. Attackers can also flood the forgot-password endpoint to exhaust resources or generate massive token records.
- **Recommended Fix:** Implement `@nestjs/throttler` in `app.module.ts` and apply strict rate limits on authentication routes (e.g., maximum 5 attempts per IP per 15-minute window).

#### VULN-03: Long-Lived JWT Stored in Browser `localStorage` (CWE-922 / CWE-384)
- **Affected Files:** [`frontend/src/services/api.ts`](file:///C:/Users/kirit/Desktop/tp/ticketing-tool/frontend/src/services/api.ts#L8-L25), [`backend/package.json`](file:///C:/Users/kirit/Desktop/tp/ticketing-tool/backend/.env.example#L12)
- **Risk Level:** **MEDIUM–HIGH**
- **Impact:** The JWT expiration is set to 7 days (`JWT_EXPIRATION="7d"`). Tokens stored in `localStorage` are vulnerable to extraction via Cross-Site Scripting (XSS). Furthermore, logging out only clears the client's `localStorage`; the backend token remains cryptographically valid for 7 days until natural expiration because no server-side revocation list exists.
- **Recommended Fix:** Migrate to short-lived access tokens (15 minutes) delivered via `HttpOnly`, `Secure`, `SameSite=Lax` cookies, combined with server-side rotating refresh tokens stored in PostgreSQL.

#### VULN-04: Unrestricted File Attachment Uploads Without Malware Scanning (CWE-434)
- **Affected File:** [`backend/src/attachments/attachments.service.ts`](file:///C:/Users/kirit/Desktop/tp/ticketing-tool/backend/src/attachments/attachments.service.ts#L25-L54)
- **Risk Level:** **MEDIUM–HIGH**
- **Impact:** While the application blocks dangerous file extensions (`.exe`, `.dll`, `.sh`, `.bat`, `.svg`), it does not perform antivirus or malware analysis on uploaded documents (`.pdf`, `.docx`, `.xlsx`, `.zip`). Malicious macros or embedded exploits can be uploaded to tickets and downloaded by internal support agents.
- **Recommended Fix:** Implement an asynchronous malware scanning hook (e.g., ClamAV daemon or AWS GuardDuty S3 scanning) before marking attachments available for download. Verify MIME types by inspecting initial magic bytes rather than trusting file extensions.

#### VULN-05: Complete Deletion of Audit Ledger on Factory Reset (CWE-778)
- **Affected File:** [`backend/src/system/system.service.ts`](file:///C:/Users/kirit/Desktop/tp/ticketing-tool/backend/src/system/system.service.ts#L231)
- **Code:**
  ```typescript
  await tx.activityEvent.deleteMany();
  ```
- **Risk Level:** **HIGH (Compliance Blocker)**
- **Impact:** The system administration reset endpoint allows an administrator to erase all historical user activity, escalations, status changes, and data modifications. This violates SOC 2, ISO 27001, and UK GDPR accountability principles requiring tamper-evident, immutable audit trails.
- **Recommended Fix:** Remove `deleteMany()` on the `ActivityEvent` table. In production environments, disable `/api/system/reset` entirely or restrict it behind a multi-party approval mechanism.

---

## E. USA Readiness Assessment

### 1. State Privacy Law Applicability (CCPA / CPRA & VCDPA / CPA)
*Note: Legal applicability depends on business thresholds (e.g. CCPA applies to for-profit entities doing business in California with annual gross revenues over $25M, or buying/selling/sharing personal info of 100,000+ consumers/households).*

- **Notice at Collection (§ 1798.100):** **Failed.** The platform collects employee/customer names, email addresses, timezones, IP addresses, and uploaded files without displaying a Notice at Collection at or before the point of data entry.
- **Consumer Rights (§ 1798.105, § 1798.110):** **Failed.** There is no automated workflow for consumers to submit verified requests to access, correct, or delete their personal data.
- **Service Provider Obligations:** If the platform is marketed as a B2B SaaS ticketing solution to US enterprise clients, the operating entity must execute Data Processing Agreements (DPAs) with customers acting as "Service Providers" under CCPA regulations.

### 2. Accessibility (ADA Title III & WCAG 2.2 AA)
Under Title III of the Americans with Disabilities Act, commercial websites are widely recognized by federal courts (including the 2nd and 9th Circuits) as places of public accommodation.
- **Audit Finding:** The application contains high-severity accessibility barriers:
  - Modals (`ConfirmModal`, `EscalateModal`) lack `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
  - Screen reader users cannot discern the purpose of icon-only buttons (missing `aria-label` on modal close `<button>` and search clear `<button>`).
  - Focus is not trapped inside open dialogs, allowing keyboard tab navigation into hidden background elements.
- **Legal Risk:** High exposure to predatory ADA web accessibility demand letters and lawsuits in US federal jurisdictions.

### 3. Regional Formatting & Timezones
- **Audit Finding:** The platform hardcodes IST (`UTC+05:30`) in seed profiles and uses raw UTC/ISO dates in multiple views. US enterprise users expect standard US formats:
  - Date: `MM/DD/YYYY` (e.g. `11/04/2026`) instead of `YYYY-MM-DD`.
  - Time: 12-hour clock with AM/PM indicators.
  - Timezones: US Eastern (ET), Central (CT), Mountain (MT), and Pacific (PT).

---

## F. UK Readiness Assessment

### 1. UK GDPR & Data Protection Act 2018

- **Article 5 (Principles):**
  - *Data Minimisation:* **Partially Compliant.** Standard ticket and profile fields are collected. However, free-form text areas lack PII safeguards.
  - *Storage Limitation:* **Non-Compliant.** No retention periods or automatic purge controls are defined. Closed tickets and attachments remain in PostgreSQL indefinitely.
  - *Integrity & Confidentiality:* **Partially Compliant.** Passwords are encrypted with bcrypt, but reset tokens are logged to stdout and JWTs are long-lived.
  - *Accountability:* **Non-Compliant.** No Record of Processing Activities (ROPA), no formal Data Protection Impact Assessment (DPIA), and audit logs can be wiped via `/api/system/reset`.

- **Article 17 (Right to Erasure / "Right to be Forgotten"):**
  - **Critical Failure:** If a UK data subject submits an erasure request, the software physically rejects account deletion:
    ```typescript
    if (reportedIssuesCount > 0) {
      throw new BadRequestException(`Cannot delete user: they are the reporter of ${reportedIssuesCount} issue(s).`);
    }
    ```
    To comply with UK GDPR, the platform must support **Pseudonymization**: scrub the user's name, email, avatar, and password hash, and reassign ticket relations to a synthetic tombstone record (`[User Deleted - DSR Request]`).

- **Article 15 & 20 (Right of Access & Portability):**
  - **Failure:** The platform offers no per-user data export. The only export feature dumps the entire database, which breaches Article 15(4) (must not adversely affect the rights and freedoms of others).

### 2. PECR (Privacy and Electronic Communications Regulations)
- **Cookies & Storage:** The platform does not currently set marketing or third-party tracking cookies; it uses `localStorage` for application state. However, using `localStorage` for authentication tokens still constitutes terminal equipment storage under PECR Regulation 6, requiring clear notice.
- **Third-Party CDN Requests:** Seed data avatar URLs reference `images.unsplash.com`. When a user loads a page, their browser automatically transmits their IP address and User-Agent to Unsplash (US servers) without prior notice or consent.

### 3. Equality Act 2010
- The Equality Act 2010 legally obligates UK service providers not to discriminate against disabled individuals. The digital accessibility shortcomings identified under WCAG 2.2 AA represent a direct legal vulnerability in the UK market.

---

## G. Missing Features and Policies

### Missing Application Features
1. **DSR Self-Service Portal:**
   - "Download My Data" button producing a standardized ZIP/JSON containing the user's personal details, tickets, and activity.
   - "Delete My Account" button initiating a formal erasure and pseudonymization workflow.
2. **Multi-Factor Authentication (MFA / 2FA):**
   - Time-based One-Time Password (TOTP) support via Google Authenticator or Microsoft Authenticator.
3. **Session Security & Refresh Tokens:**
   - 15-minute access token + 7-day HttpOnly cookie refresh token.
   - Server-side token revocation table in PostgreSQL (`RevokedToken` model).
4. **Data Loss Prevention (DLP) & PII Redaction:**
   - Server-side regex scanner to detect and warn when US Social Security Numbers, UK National Insurance Numbers, credit card numbers, or API keys are pasted into ticket fields.
5. **Secure Cloud Object Storage:**
   - S3/Cloudflare R2 integration with pre-signed upload URLs and server-side encryption (`AES-256` or `KMS`) replacing container local disk storage.
6. **Antivirus Scanning Hook:**
   - Asynchronous scanner (e.g. ClamAV or AWS GuardDuty) verifying uploaded attachments.
7. **Regional Date, Time & Locale Switcher:**
   - Automatic browser timezone detection.
   - Preference toggle between US (`MM/DD/YYYY`) and UK/International (`DD/MM/YYYY`) date formatting.
8. **Project-Scoped Data Isolation:**
   - Enforcement preventing users who are not assigned project members from querying tickets or attachments in other projects.

### Missing Compliance Documentation & Policies
1. **Public Privacy Policy (UK GDPR & CCPA Aligned):** Comprehensive legal disclosure detailing Controller identity, lawful bases, data categories, sub-processors, retention periods, and supervisory authority contacts.
2. **Terms of Service (ToS) / End User License Agreement (EULA):** Acceptable use policies, liability limitations, and SLA disclaimers.
3. **Data Protection Policy & Record of Processing Activities (ROPA):** Internal compliance documentation required under UK GDPR Article 30.
4. **Incident Response & Breach Notification Plan:** Defined operational workflow detailing 72-hour ICO notification procedures and US state AG reporting thresholds.
5. **Data Retention & Disposal Schedule:** Formal business rules defining when resolved support tickets and attachments must be archived or purged.
6. **Data Processing Agreement (DPA) Template:** Pre-signed B2B contractual agreements containing standard SCCs and UK IDTA clauses for enterprise customers.

---

## H. Prioritised Remediation Plan

| Priority | Issue | Required Change | Affected Module / Files | Reason | Suggested Implementation Order |
|---|---|---|---|---|---|
| **CRITICAL** | Plaintext reset token logged to server stdout | Remove `this.logger.log` printing raw reset token. Dispatch tokens strictly via secure transactional email. | [`backend/src/auth/auth.service.ts`](file:///C:/Users/kirit/Desktop/tp/ticketing-tool/backend/src/auth/auth.service.ts) | Prevents trivial account takeover via centralized log streams. | **Step 1** |
| **CRITICAL** | No rate limiting on authentication routes | Install and configure `@nestjs/throttler`. Restrict `/api/auth/login`, `/api/auth/forgot-password`, and `/api/auth/reset-password` to 5 requests per 15 minutes per IP. | `backend/src/app.module.ts`, `backend/src/auth/auth.controller.ts` | Prevents automated credential stuffing and DDoS attacks. | **Step 2** |
| **CRITICAL** | Inability to delete users (GDPR Art. 17 / CCPA Deletion failure) | Implement user anonymization pipeline: scrub user credentials/PII and reassign relational foreign keys (`reporterId`, `assigneeId`, `authorId`) to `[Deleted User]` tombstone. | `backend/prisma/schema.prisma`, `backend/src/users/users.service.ts` | Eliminates direct violation of legally binding UK GDPR and CCPA erasure mandates. | **Step 3** |
| **CRITICAL** | System reset endpoint wipes audit logs | Remove `await tx.activityEvent.deleteMany()` from `SystemModule`. Restrict `/api/system/reset` strictly to local non-production environments (`NODE_ENV !== 'production'`). | [`backend/src/system/system.service.ts`](file:///C:/Users/kirit/Desktop/tp/ticketing-tool/backend/src/system/system.service.ts) | Preserves immutable audit trail required for SOC 2, ISO 27001, and legal accountability. | **Step 4** |
| **HIGH** | Missing Privacy Policy and Terms of Service | Create dedicated `/privacy` and `/terms` pages in frontend. Add consent acknowledgment checkbox or Notice at Collection on `LoginPage.tsx`. | `frontend/src/pages/`, `frontend/src/App.tsx`, `frontend/src/pages/LoginPage.tsx` | Mandatory under CCPA Notice at Collection and UK GDPR Articles 13 & 14. | **Step 5** |
| **HIGH** | 7-Day JWT in `localStorage` without revocation | Migrate to short-lived access tokens (15m) + HttpOnly cookies. Add database-backed token revocation list checked during JWT validation. | `backend/src/auth/`, `frontend/src/services/api.ts` | Protects session credentials against XSS exfiltration and ensures real logout. | **Step 6** |
| **HIGH** | Web accessibility barriers (ADA / Equality Act risk) | Add ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-label` on icon buttons) and focus trapping to all modals. | `frontend/src/components/common/ConfirmModal.tsx`, `frontend/src/components/topbar/GlobalSearchModal.tsx` | Mitigates legal exposure under ADA Title III and UK Equality Act 2010. | **Step 7** |
| **HIGH** | Lack of per-user Data Portability export | Implement `GET /api/users/me/export` returning structured JSON containing only the requesting user's profile, tickets, and comments. | `backend/src/users/`, `frontend/src/pages/ProfilePage.tsx` | Satisfies statutory UK GDPR Article 20 and CCPA Right to Access. | **Step 8** |
| **MEDIUM** | Insecure local attachment storage | Migrate attachment storage from local container disk to cloud object storage (AWS S3 or Cloudflare R2) with server-side encryption (`SSE-S3`). | `backend/src/attachments/storage/storage.service.ts` | Prevents data loss on container recreation and ensures encryption at rest. | **Step 9** |
| **MEDIUM** | No attachment malware scanning | Integrate ClamAV or AWS GuardDuty scanning on uploaded files before streaming is permitted. Verify MIME via magic bytes. | `backend/src/attachments/attachments.service.ts` | Prevents weaponized documents from compromising internal support workstations. | **Step 10** |
| **MEDIUM** | Hardcoded date formats and timezones | Bind dates and times to user settings (`preferences.dateFormat`: `MM/DD/YYYY` vs. `DD/MM/YYYY`) and detect browser timezone. | `frontend/src/context/AppContext.tsx`, `frontend/src/pages/` | Essential for US and UK enterprise user adoption and operational accuracy. | **Step 11** |
| **MEDIUM** | Lack of project-level authorization (BOLA) | Validate that the requesting user belongs to `projectId` before returning issue details in `IssuesService.findOne`. | `backend/src/issues/issues.service.ts` | Eliminates OWASP API Security Top 10 Broken Object-Level Authorization (BOLA). | **Step 12** |
| **LOW** | External Unsplash images loaded from US CDN | Replace external Unsplash image URLs in seed data with local static SVGs or user-uploaded avatars. | `frontend/src/data/seedData.ts`, `backend/src/auth/auth.service.ts` | Prevents undeclared third-party data transmission to US servers under PECR/GDPR. | **Step 13** |
| **LOW** | Unused `@google/genai` dependency | Remove unused `@google/genai` package from `frontend/package.json`. | `frontend/package.json` | Eliminates confusion regarding undeclared third-party AI data processing. | **Step 14** |

---

## I. Final Verdict

### 1. Is the application aligned with applicable US requirements?
**Verdict:** **NO (Partially Aligned Architecturally, Non-Compliant Legally).**  
**Evidence & Gaps:**  
- *Evidence:* The application has solid technical foundations (bcrypt password hashing, Prisma ORM SQL-injection immunity, role-based decorators).
- *Gaps:* Lacks a Notice at Collection and Privacy Policy; lacks CCPA consumer request mechanisms (Know/Delete); has severe digital accessibility barriers under ADA Title III (WCAG 2.2 AA non-compliance); and lacks brute-force throttling on login endpoints.

### 2. Is the application aligned with applicable UK requirements?
**Verdict:** **NO (High Regulatory Exposure under UK GDPR).**  
**Evidence & Gaps:**  
- *Evidence:* Data minimization is partially respected for basic account creation, and append-only activity logging exists for standard ticket mutations.
- *Gaps:* Direct breach of UK GDPR Article 17 (software blocks user erasure if tickets exist); direct breach of Article 15/20 (no individual data export portal); direct breach of Article 13/14 (no transparent Privacy Notice); and direct breach of Article 32 (system reset endpoint allows complete audit ledger deletion).

### 3. Are all existing features functioning as intended?
**Verdict:** **YES.**  
All 15 modules across the monorepo compile cleanly, all 106 automated backend test suites pass with zero errors, and all frontend views (Kanban board, Sprints, Epics, Reports, Global Search, Support Center) successfully communicate with their corresponding NestJS REST endpoints and PostgreSQL database tables.

### 4. Are all current policies sufficient?
**Verdict:** **NO.**  
The repository contains no formal Privacy Policy, no Terms of Service, no Acceptable Use Policy, no Data Retention Schedule, and no Data Breach Incident Response Plan. Existing code documentation outlines technical standards but does not provide legally binding governance policies.

### 5. What must be changed before a US launch?
1. Remove plaintext password reset token logging in `auth.service.ts`.
2. Add `@nestjs/throttler` rate limiting to `/api/auth/*`.
3. Publish a compliant Privacy Policy and Terms of Service with a Notice at Collection on the login page.
4. Remediate WCAG 2.2 AA accessibility violations on all modals and icon-only buttons to mitigate ADA Title III litigation risks.
5. Provide user-level data export and deletion workflows.
6. Support US date formatting (`MM/DD/YYYY`) and 12-hour clock.

### 6. What must be changed before a UK launch?
1. Implement a user pseudonymization pipeline enabling UK GDPR Article 17 compliance (`[Deleted User]`).
2. Implement user self-service data portability export (`GET /api/users/me/export`) under Article 20.
3. Publish a UK GDPR Article 13/14 Privacy Notice identifying the Data Controller, legal basis, retention periods, and ICO contact.
4. Remove the audit log deletion command from the system reset routine to preserve tamper-evident auditability.
5. Replace external Unsplash image URLs with local static assets to comply with PECR and international transfer rules.
6. Fix WCAG 2.2 AA digital accessibility barriers under the Equality Act 2010.

### 7. What can be improved later?
1. Migration of attachments to AWS S3/Cloudflare R2 with ClamAV antivirus scanning.
2. Integration of Multi-Factor Authentication (TOTP 2FA).
3. Migration from `localStorage` to short-lived HttpOnly Secure cookies with refresh token rotation.
4. Data Loss Prevention (DLP) regex scanners for automated detection of PII/payment data in ticket descriptions.
5. Multi-region database deployment (UK/EU region vs. US region).

### 8. Which items require legal or compliance-professional review?
1. **Terms of Service & SLA Commitments:** Review of enterprise support tiers, L1/L2/L3 response warranties, and liability caps.
2. **Privacy Notice & International Data Transfer Safeguards:** Review of standard contractual clauses (SCCs) and UK International Data Transfer Agreements (IDTA) if UK customer data is processed on US cloud infrastructure.
3. **B2B Data Processing Agreement (DPA):** Formal review of DPA terms defining Controller vs. Processor obligations for enterprise SaaS licensing.
4. **State-by-State Privacy Law Thresholds:** Determining applicability of California (CCPA/CPRA), Virginia (VCDPA), Colorado (CPA), and other state privacy regulations based on the company's gross annual revenue and volume of consumer data processed.

---
*End of Audit Report.*


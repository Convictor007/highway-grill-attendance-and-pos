# Highway Grill HRMS — API

**Base URL:** `/api` (Next.js routes in `server/app/api/`)

**Auth:** `Authorization: Bearer <token>` from `POST /auth/login`

All endpoints require a valid session unless noted. Permissions are enforced server-side.

## Auth & registration

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/login` | Returns token |
| POST | `/auth/logout` | Token |
| GET | `/auth/me` | Current user + permissions |
| POST | `/auth/register` | Self-registration |
| GET | `/auth/register-options` | Branches / departments for signup |

## Roles & users

| Method | Path | Permission |
|--------|------|------------|
| GET | `/roles` | token |
| GET/PUT | `/roles/{slug}/permissions` | users.manage |
| GET/POST | `/users` | users.manage |
| GET/PUT | `/users/{id}` | users.manage |
| PUT | `/users/{id}/approve` | users.approve |
| PUT | `/users/{id}/activate` | users.manage |
| PUT | `/users/{id}/reject` | users.approve |
| GET | `/users/pending` | users.approve |

## Employees & reference data

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/employees` | employees.view / employees.manage |
| GET/PUT/DELETE | `/employees/{id}` | employees.view / employees.manage |
| GET/PUT | `/employees/me` | token |
| POST | `/employees/me/photo` | token + employee |
| GET | `/branches`, `/departments`, `/positions` | employees.view |

## Settings (admin)

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/settings/branches` | employees.view / settings.branches.manage |
| PUT | `/settings/branches/{id}` | settings.branches.manage |
| GET/POST | `/settings/departments` | employees.view / settings.departments.manage |
| PUT | `/settings/departments/{id}` | settings.departments.manage |
| GET/POST | `/settings/positions` | employees.view / settings.departments.manage |
| PUT/DELETE | `/settings/positions/{id}` | settings.departments.manage |

## Attendance & DTR

| Method | Path | Permission |
|--------|------|------------|
| GET | `/attendance` | attendance.view |
| GET/PUT | `/attendance/{id}` | attendance.view / attendance.manage |
| GET | `/attendance/status` | attendance.self |
| GET | `/attendance/history`, `/summary`, `/statistics` | attendance.self / attendance.view |
| GET | `/attendance/export?format=xlsx\|pdf` | attendance.view |
| POST | `/attendance/clock-in`, `/clock-out`, `/break-start`, `/break-end` | attendance.self |
| POST | `/attendance/cancel-clock-in` | attendance.self |
| POST | `/attendance/vicinity-ping` | attendance.self |
| GET | `/attendance/scheduled-shift` | attendance.self |

## Leave

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/leave/types` | leave.view / leave.manage |
| PUT | `/leave/{id}` | leave.manage (type or request by context) |
| GET | `/leave/balances` | leave.view |
| GET/POST | `/leave/requests` | leave.view / leave.apply |
| PUT | `/leave/{id}/review` | leave.approve |
| PUT | `/leave/{id}/cancel` | leave.apply |

## Shifts

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/shifts/templates` | shifts.manage |
| PUT/DELETE | `/shifts/templates/{id}` | shifts.manage |
| GET/PUT | `/shifts/schedules/{id}` | shifts.manage |
| GET/PUT | `/shifts/roster`, `/roster/cell`, `/roster/footnotes` | shifts.manage |
| GET | `/shifts/my`, `/shifts/coworkers` | shifts.view.self |
| GET/POST | `/shifts/swaps` | shifts.view.self |
| PUT | `/shifts/swaps/{id}` | shifts.manage |

## Payroll & benefits

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/payroll/runs` | payroll.view / payroll.manage |
| GET/PUT | `/payroll/runs/{id}` | payroll.view / payroll.manage |
| GET/PUT | `/payroll/{id}` | payroll.view / payroll.manage |
| POST | `/payroll/{id}/generate-payslips`, `/generate-payslip` | payroll.manage |
| POST | `/payroll/{id}/send-payslips`, `/send-payslip` | payroll.manage |
| POST | `/payroll/{id}/pay-selected`, `/defer`, `/undefer` | payroll.manage |
| GET | `/payroll/payslips`, `/payroll/payslip/{id}`, `/payroll/my-payslips` | payroll.view / payroll.view.self |
| GET/POST | `/payroll/prepare`, `/payroll/run-roster` | payroll.manage |
| GET/POST/PUT/DELETE | `/payroll/adjustments`, `/adjustments/{id}` | payroll.manage |
| GET/POST/PUT/DELETE | `/benefits`, `/benefits/{id}` | payroll.manage |
| GET/PUT | `/benefits/government-profile`, `/deduction-setup` | payroll.manage |
| GET | `/benefits/compliance`, `/remittance`, `/bulk-deductions` | payroll.manage |

## Loans, documents, memos

| Method | Path | Permission |
|--------|------|------------|
| GET | `/loans` | loans.manage |
| POST | `/loans/apply` | loans.self |
| PUT | `/loans/{id}/review`, `/payments` | loans.manage |
| GET/POST | `/documents` | documents.view.self / employees.manage |
| POST | `/documents/upload` | employees.manage |
| DELETE | `/documents/{id}` | employees.manage |
| GET/POST | `/announcements` | announcements.view / employees.manage |
| PUT/DELETE | `/announcements/{id}` | employees.manage |
| GET | `/contracts/service-record/{employeeId}` | documents.view.self |

## Field work, geocode, other

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/field-work/sites` | attendance.view |
| PUT/DELETE | `/field-work/sites/{id}` | attendance.view |
| GET | `/field-work/checkins`, `/zone-status` | attendance.view / attendance.self |
| GET | `/geocode/search`, `/geocode/reverse` | token |
| GET/POST/PUT/DELETE | `/holidays`, `/holidays/{id}` | employees.manage |
| GET/POST/PUT/DELETE | `/tips/pools`, `/tips/pools/{id}` | payroll.view |
| GET/POST/PUT/DELETE | `/compliance/checklists`, `/checklists/{id}` | compliance.view |
| GET/POST | `/compliance/logs` | compliance.view |
| GET | `/compliance/audit` | compliance.view |
| GET | `/dashboard`, `/dashboard/org-masterlist` | reports.view |
| GET/PUT/DELETE | `/notifications`, `/notifications/{id}` | token |
| PUT | `/notifications/read-all` | token |

# Database usage audit — attendance & payroll focus

Scanned `database/schema.sql`, live DB tables, `api/`, and `src/` (June 2026).

**Legend**
- **Unused** — no reads/writes in application code
- **Schema-only** — table exists but no API module / UI
- **Optional** — built and wired, but not required for core attendance + payroll

---

## 1. Tables completely unused (safe to remove)

No references in `api/` or `src/` (only in `schema.sql`). No seed data.

| Table | Domain |
|-------|--------|
| `training_programs` | Training |
| `training_sessions` | Training |
| `training_enrollments` | Training |
| `appraisal_cycles` | Performance |
| `appraisals` | Performance |
| `appraisal_criteria` | Performance |
| `disciplinary_records` | HR discipline |
| `job_postings` | Recruitment |
| `applicants` | Recruitment |
| `interviews` | Recruitment |
| `employee_skills` | Employee profile |

**11 tables** — leftover from full restaurant HRMS template; not needed for Highway Grill attendance/payroll.

---

## 2. Orphan tables (in live DB, not in current schema.sql)

Present in MySQL but **no PHP/TS references** anywhere in the repo:

| Table | Notes |
|-------|--------|
| `system_settings` | Legacy / patch artifact |
| `user_webauthn_credentials` | Passkey auth never implemented in app |
| `webauthn_challenges` | Passkey auth never implemented in app |

Verify empty, then drop if you do not plan WebAuthn.

---

## 3. Tables required for attendance & payroll

| Table | Role |
|-------|------|
| `roles`, `permissions`, `role_permissions` | Auth / RBAC |
| `branches`, `departments`, `positions` | Org structure; `positions.min_hourly` drives payroll rate |
| `employees`, `users`, `user_sessions`, `user_permissions` | Accounts |
| `shift_templates`, `schedules`, `shift_assignments` | Roster → expected shift end, OT detection |
| `attendance` | DTR / clock in-out |
| `overtime_requests` | Auto OT from DTR; feeds payroll OT hours |
| `holidays` | Holiday hours / premium in payroll |
| `payroll_runs`, `payslips`, `payroll_adjustments` | Payroll |
| `tips_pool`, `tips_distribution` | Tips on payslips |
| `field_work_sites`, `field_work_checkins` | Geofence clock-in (non-management crew) |
| `notifications` | Shift / leave / system alerts |
| `audit_logs` | Compliance trail (`AuditLog.php`) |

**Patch table (not in base schema.sql):** `employee_benefit_enrollments` — used by Benefits + payroll (`patch_juanhr_modules.sql`).

**Patch column:** `payroll_runs.run_type` — regular vs 13th month (`patch_juanhr_modules.sql`).

---

## 4. Optional modules (built, not core to attendance/payroll)

These have API + UI but can be removed if you want a minimal DTR + payroll app:

| Table(s) | Module |
|----------|--------|
| `leave_types`, `leave_balances`, `leave_requests` | Leave |
| `employee_loans`, `loan_payments` | Loans (payroll deducts active loans) |
| `documents` | Service records / uploads |
| `employee_contracts`, `employee_bank_accounts` | Contracts & bank info |
| `announcements` | Memos |
| `compliance_checklists`, `compliance_logs` | Compliance page |
| `shift_swap_requests` | Shift swaps |

If you drop loans, update `PayrollService` (it calls `LoanService::applyPayrollDeduction`). If you drop tips/benefits, update payslip generation accordingly.

---

## 5. Unused columns (within active tables)

### Attendance / payroll path

| Table | Column | Status |
|-------|--------|--------|
| `employees` | `probation_end` | Never read or written |
| `overtime_requests` | `approved_by` | Never set (auto OT is immediate) |
| `payslips` | `document_id` | Never linked when generating payslips |
| `employee_contracts` | `signed_at` | Never read or written |
| `employee_contracts` | `hourly_rate` | Stored in service records; **payroll uses `positions.min_hourly` instead** |
| `leave_types` | `max_carry_days` | In schema/UI types only; balance logic never uses it |
| `attendance` | `method` values `biometric`, `pin` | Enum exists; app only uses `app` and `manual` |

### Settings / metadata (used in UI, not in payroll math)

| Table | Column | Notes |
|-------|--------|--------|
| `positions` | `pay_grade`, `max_hourly` | Settings page only |
| `positions` | `is_tipped` | Display flag; tips come from `tips_pool` |
| `branches` | `manager_id` | Settings |
| `departments` | `head_id`, `cost_center` | Settings |
| `employees` | `national_id` | API accepts it; no profile/HR form field in UI |

### Columns that **are** used (do not drop)

- `attendance`: `shift_assignment_id`, `regular_hours`, `overtime_hours`, `break_*`, `clock_out_type`, `outside_since`, `approved_by`/`approved_at` (HR corrections), GPS/address fields
- `overtime_requests`: `source`, `attendance_id`, `status` (auto = `approved`)
- `payslips`: all amount columns including `service_charge` (stores benefits total), `generated_at`
- `payroll_runs`: `total_gross`, `total_net`, `processed_by`, `processed_at`

---

## 6. Suggested cleanup order (if you want a lean schema)

1. **Drop unused module tables** (section 1) — no app code depends on them.
2. **Drop orphan tables** (section 2) after confirming empty.
3. **Drop unused columns** (section 5) — use `ALTER TABLE ... DROP COLUMN` one at a time.
4. **Optionally drop optional modules** (section 4) only after removing their API routes and UI.

Example drop script (unused tables only):

```sql
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS training_enrollments, training_sessions, training_programs;
DROP TABLE IF EXISTS appraisal_criteria, appraisals, appraisal_cycles;
DROP TABLE IF EXISTS disciplinary_records;
DROP TABLE IF EXISTS interviews, applicants, job_postings;
DROP TABLE IF EXISTS employee_skills;
SET FOREIGN_KEY_CHECKS = 1;
```

---

## 7. Related fixes already applied

- HR overtime approve/reject removed; auto OT → `approved`
- Attendance register empty: UTC date default fixed; list query includes overlapping sessions

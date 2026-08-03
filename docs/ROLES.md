# Highway Grill HRMS — Roles

| Slug | Name | Access |
|------|------|--------|
| `admin` | System Admin | Platform settings, compliance, staff logins / role permissions |
| `super_admin` | Super Admin | Security only — auth logs, registration logs, threats, employee map |
| `hr` | HR | Employees, approvals, attendance, leave, payroll, shifts, reports |
| `employee` | Employee | Clock in/out, leave, own payroll, schedule, profile |

System Admin and Super Admin are **different**. Super Admin is not listed under Staff logins.

## Demo logins (seed)

| Role | Email | Password |
|------|-------|----------|
| System Admin | `admin@highwaygrill.com` | `hg2015` |
| Super Admin | `security@highwaygrill.com` | `dsadsadsa` |
| HR | `hr@highwaygrill.com` | `HrTemp2025!` |

Requires `AUTH_HASH_PASSWORDS=true` on the API.

## Web portals

| Role | Home route |
|------|------------|
| System Admin | `/admin` |
| Super Admin | `/security` |
| HR | `/` (HR dashboard) |
| Employee | `/` (employee home) |

## Security patches

```sql
-- database/postgres/patch_security_super_admin.sql
-- database/postgres/patch_location_tracking.sql
```

Or:

```powershell
node scripts/run-security-patches.mjs
```

## Fresh database

```powershell
.\scripts\setup-database.ps1
```

See `database/README.md`.

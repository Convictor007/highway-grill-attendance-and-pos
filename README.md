# Highway Grill HRMS

Restaurant HRMS for Highway Grill — employees, attendance, leave, and payroll.

## Stack

- **Frontend:** React + Vite + TypeScript
- **API:** PHP (XAMPP) — no direct database access from the UI
- **Database:** MySQL (`highway_grill_hrms`)

## Setup

### 1. Environment

```bash
copy .env.example .env
```

Edit `.env` for your MySQL password, CORS origin, and XAMPP path if the project is not under `htdocs/HG_web`:

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE` | Frontend API prefix (default `/api`) |
| `VITE_PROXY_TARGET` | Apache URL for Vite proxy |
| `VITE_PROXY_API_PATH` | Path to `api/index.php` on Apache |
| `DB_*` | MySQL connection for PHP API |
| `CORS_ORIGIN` | Allowed origin (default `http://localhost:5173`) |
| `AUTH_HASH_PASSWORDS` | `false` = plain passwords in dev seeds |

PHP reads the same `.env` from the project root via `api/config/config.php`.

### 2. MySQL (fresh database)

Delete `highway_grill_hrms` in phpMyAdmin if it already exists, then:

```powershell
.\scripts\setup-database.ps1
```

Or manually:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root < database\schema.sql
C:\xampp\mysql\bin\mysql.exe -u root < database\seed.sql
php scripts\test-login.php
```

Set `DB_PASS` in `.env` if your root user has a password.

### 3. Run app

```bash
npm install
npm run dev
```

Open http://localhost:5173

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@highwaygrill.local | dsadsadsa |
| HR | hr@highwaygrill.local | dsadsadsa |
| Employee | employee@highwaygrill.local | dsadsadsa |

Vite proxies `/api/*` → `{VITE_PROXY_TARGET}{VITE_PROXY_API_PATH}/*`

## Database layout

| File | Purpose |
|------|---------|
| `database/schema.sql` | Drop DB, create all tables |
| `database/seed.sql` | Roles, permissions, branch, demo users, shifts |
| `database/README.md` | Install notes |

## Schema reference

- Visual schema: `docs/schema/restaurant_hrms_database_schema.html`
- Legacy POS SQL: `database/archive/tables_pos_legacy.sql`

## API reference

Full endpoint list: `docs/API.md`

## Modules

- **Dashboard** — stats for admin / HR
- **Employees** — add, edit, terminate
- **Users** — logins linked to employees + roles
- **Shifts** — schedules and assignments
- **Attendance** — clock in/out + register
- **Leave** — balances, apply, approve
- **Payroll** — runs and payslips

Inspired by [Frappe HRMS](https://github.com/frappe/hrms) module structure; custom implementation.

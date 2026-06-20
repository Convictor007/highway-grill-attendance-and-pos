# Highway Grill HRMS

Restaurant HRMS for Highway Grill — employees, attendance, leave, and payroll.

## Stack

- **Frontend:** React + Vite + TypeScript
- **API:** Node (Next.js in `server/`) — production on Vercel; local dev on port 3001
- **Database:** Postgres (Neon, production) · MySQL optional for local XAMPP legacy

## Setup

### 1. Environment

```bash
copy .env.example .env
```

Edit `.env` for your MySQL password, CORS origin, and XAMPP path if the project is not under `htdocs/HG_web`:

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE` | Frontend API prefix (default `/api`) |
| `VITE_PROXY_TARGET` | API proxy target (default `http://localhost:3001` for Node) |
| `VITE_PROXY_API_PATH` | Set only for legacy PHP: e.g. `/HG_web/api/index.php` on Apache |
| `DATABASE_URL` | Postgres connection for Node API (`server/.env.local`) |
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

Terminal 1 — API (Node):

```bash
npm run dev:api
```

Terminal 2 — frontend:

```bash
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` and `/uploads` to the Node server on port 3001.

**Legacy PHP (XAMPP only):** set `VITE_PROXY_TARGET=http://localhost` and `VITE_PROXY_API_PATH=/HG_web/api/index.php` in `.env`, use Apache + MySQL as before.

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@highwaygrill.local | dsadsadsa |
| HR | hr@highwaygrill.local | dsadsadsa |
| Employee | employee@highwaygrill.local | dsadsadsa |

Vite proxies `/api/*` → Node (`http://localhost:3001/api/*`) by default.

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

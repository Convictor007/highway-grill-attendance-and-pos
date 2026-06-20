# Highway Grill HRMS — Database

Drop the old database in phpMyAdmin for a clean install, or run `schema.sql` (drops DB). `seed.sql` is safe to re-run if data already exists.

Production uses **Neon Postgres** — see `postgres/hg.sql` and `postgres/hgseed.sql`. Local XAMPP dev uses **MySQL** below.

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | MySQL: drops `highway_grill_hrms`, recreates database and tables |
| `seed.sql` | MySQL: roles, branch, demo logins, sample data |
| `postgres/hg.sql` | Postgres base schema (Vercel / Neon) |
| `postgres/hgseed.sql` | Postgres seed data |
| `archive/` | Historical MySQL patches (superseded tables merged into `schema.sql`) |
| `archive/tables_pos_legacy.sql` | Old POS schema (not used by HRMS) |

## Roles

| Slug | Access |
|------|--------|
| `admin` | Full system |
| `hr` | HR modules (no branch settings) |
| `employee` | Clock in/out, leave self-service |

Demo password (dev): `dsadsadsa` — set `AUTH_HASH_PASSWORDS=true` in production.

## Install (PowerShell)

```powershell
.\scripts\setup-database.ps1
```

## Install (manual, MySQL)

```powershell
C:\xampp\mysql\bin\mysql.exe -u root < database\schema.sql
C:\xampp\mysql\bin\mysql.exe -u root < database\seed.sql
```

Add `-p` if MySQL root has a password.

## Upgrade existing MySQL database

Incremental patches live in `database/archive/`. Apply with:

```powershell
.\scripts\apply-patches.ps1
```

Or run individual files:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root < database\archive\patch_employee_permissions.sql
C:\xampp\mysql\bin\mysql.exe -u root < database\archive\patch_relink_users.sql
C:\xampp\mysql\bin\mysql.exe -u root < database\archive\patch_geocode_address.sql
```

Remove unused template tables (training, recruitment, etc.) from an older install:

```powershell
C:\xampp\mysql\bin\mysql.exe -u root < database\archive\patch_drop_unused_modules.sql
```

Then sign out and sign in again if permissions changed.

## Verify API (local)

With `npm run dev:api` running:

```powershell
curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"hr@highwaygrill.local\",\"password\":\"dsadsadsa\"}"
```

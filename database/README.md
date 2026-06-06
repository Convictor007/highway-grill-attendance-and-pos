# Highway Grill HRMS — Database

Drop the old database in phpMyAdmin for a clean install, or run `schema.sql` (drops DB). `seed.sql` is safe to re-run if data already exists.

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | Drops `highway_grill_hrms`, recreates database and all tables |
| `seed.sql` | Roles, branch setup, 3 logins + 4 crew, leave balances, sample attendance |
| `archive/tables_pos_legacy.sql` | Old POS schema (not used by HRMS) |

## Roles

| Slug | Access |
|------|--------|
| `admin` | Full system |
| `hr` | HR modules (no branch settings) |
| `employee` | Clock in/out, leave self-service |

Demo password (dev): `dsadsadsa` — set `AUTH_HASH_PASSWORDS=true` in production.

### Upgrade existing database (employee features)

```powershell
C:\xampp\mysql\bin\mysql.exe -u root < database\patch_employee_permissions.sql
C:\xampp\mysql\bin\mysql.exe -u root < database\seed.sql
```

Then sign out and sign in again so permissions refresh.

### Fix clock-in / user ↔ employee link

```powershell
C:\xampp\mysql\bin\mysql.exe -u root < database\patch_relink_users.sql
```

Restart Apache after pulling API changes (Authorization header fix in `api/.htaccess`).

### Geocoding (addresses on clock-in / field work)

```powershell
C:\xampp\mysql\bin\mysql.exe -u root < database\patch_geocode_address.sql
```

Uses OpenStreetMap Nominatim via `GET /geocode/reverse?lat=&lng=`.

## Install (PowerShell)

```powershell
.\scripts\setup-database.ps1
```

## Install (manual)

```powershell
C:\xampp\mysql\bin\mysql.exe -u root < database\schema.sql
C:\xampp\mysql\bin\mysql.exe -u root < database\seed.sql
```

Add `-p` if MySQL root has a password.

## Verify logins

```powershell
php scripts\test-login.php
```

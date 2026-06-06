# Highway Grill HRMS — Roles (3)

| Slug | Name | Access |
|------|------|--------|
| `admin` | Admin | Everything — settings, users, all modules |
| `hr` | HR | Employees, users, attendance, leave, payroll, shifts, reports |
| `employee` | Employee | Clock in/out, apply for leave, view own leave |

Password (dev): `dsadsadsa` with `AUTH_HASH_PASSWORDS=false` in `.env`.

## Demo logins

| Role | Email |
|------|-------|
| Admin | admin@highwaygrill.local |
| HR | hr@highwaygrill.local |
| Employee | employee@highwaygrill.local |

## Fresh database

```powershell
.\scripts\setup-database.ps1
```

See `database/README.md`.

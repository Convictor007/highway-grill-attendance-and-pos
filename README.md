# Highway Grill HRMS

Restaurant HRMS for Highway Grill — employees, attendance, leave, and payroll.

## Stack

- **Frontend:** React + Vite + TypeScript (`src/`)
- **API:** Node / Next.js (`server/`) — Vercel in production, port 3001 locally
- **Database:** Postgres (Neon on Vercel) · MySQL optional for local legacy seeds only

The UI calls `/api/*` only — no direct database access from the browser.

## Setup

### 1. Environment

Create `server/.env.local` with at least:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string (Neon) |
| `CORS_ORIGIN` | Allowed origin (default `http://localhost:5173`) |
| `AUTH_HASH_PASSWORDS` | `false` = plain passwords in dev seeds |

Optional root `.env` for Vite:

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE` | API prefix (default `/api`) |
| `VITE_PROXY_TARGET` | Dev proxy target (default `http://localhost:3001`) |

### 2. Database

**Production (Neon):** apply `database/postgres/hg.sql` and patches under `database/postgres/`.

**Local MySQL (optional):** only if you still use XAMPP for schema experiments:

```powershell
.\scripts\setup-database.ps1
```

See `database/README.md` for patch scripts.

### 3. Run app

Terminal 1 — API:

```bash
npm run dev:api
```

Terminal 2 — frontend:

```bash
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` and `/uploads` to the Node server.

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@highwaygrill.local | dsadsadsa |
| HR | hr@highwaygrill.local | dsadsadsa |
| Employee | employee@highwaygrill.local | dsadsadsa |

## Deploy

Production: https://highwaygrill.vercel.app

```bash
git push origin main
npx vercel deploy --prod
```

## Docs

| File | Purpose |
|------|---------|
| `docs/API.md` | REST endpoint reference (Node) |
| `database/README.md` | SQL schema and patches |

## Modules

Dashboard, employees, users, shifts, attendance, leave, payroll, benefits, loans, compliance, memos, field work, tips.

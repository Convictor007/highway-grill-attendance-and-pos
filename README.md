# Highway Grill HRMS

Human Resource Management System for Highway Grill — attendance tracking, scheduling, payroll, DTR reports, and more.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Next.js (API routes) + TypeScript
- **Database**: PostgreSQL (Neon)
- **Deploy**: Vercel

## Prerequisites

- Node.js 18+
- npm
- A Neon PostgreSQL database (free tier works)

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/Convictor007/highway-grill-attendance-and-pos.git
cd highway-grill-attendance-and-pos
```

### 2. Install dependencies

```bash
npm install
cd server && npm install && cd ..
```

### 3. Set up environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
cp .env.example server/.env.local
```

Edit `.env` and `server/.env.local` with the same values. At minimum you need:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `CORS_ORIGIN` | `http://localhost:5173` |
| `SMTP_*` | Gmail SMTP for payslip emails (optional) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for file uploads (optional) |

### 4. Set up the database

Option A — Import the Neon dump:

```bash
# Using pg_restore or psql
psql "your-database-url" < database/neon/hg_web.sql
```

Option B — Run patches on an existing Neon database:

```bash
node scripts/run-neon-patches.mjs
node scripts/run-neon-seed-benefits.mjs
```

### 5. Start the dev servers

Open two terminals:

```bash
# Terminal 1 — Frontend (Vite, port 5173)
npm run dev

# Terminal 2 — API (Next.js, port 3001)
npm run dev:api
```

The frontend runs at `http://localhost:5173` and proxies API calls to `http://localhost:3001`.

### 6. Build for production

```bash
npm run build
```

## Project Structure

```
├── src/                  # React frontend
├── server/               # Next.js API
│   ├── app/api/          # API routes
│   └── lib/              # Server logic (auth, attendance, payroll, etc.)
├── database/
│   └── neon/             # Neon database dump
├── scripts/              # Dev utility scripts (not deployed)
├── .env.example          # Environment variable template
└── package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite frontend |
| `npm run dev:api` | Start Next.js API server |
| `npm run build` | Build frontend |
| `npm run build:api` | Build API server |
| `npm run lint` | Run ESLint |

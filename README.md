# GSL Enterprise Portfolio Management Dashboard

Multi-department portfolio governance platform for **Greensprings School (GSL)** across **IT, Maintenance, Transport, Facilities**, and additional Super Admin-managed departments spanning **Lekki, Ikoyi, Anthos, and Anthony** campuses.

## Stack

- **`client/`** — React 18, TypeScript, Vite, Tailwind CSS, Recharts, XLSX (hosted on **Vercel**)
- **`server/`** — Node.js, Express, TypeScript, Zod, `node-cron` (hosted on **Render** via [render.yaml](render.yaml))
- **`supabase/migrations/`** — PostgreSQL schema, 5-role RLS, audit triggers, auto-generated `GSL-PROJECT-XXX` sequence, and Realtime (hosted on **Supabase**)

## Roles (UI + PostgreSQL RLS)

- **Super Admin** — Global control across all departments, users, departments CRUD, and budget approvals
- **Executive** — School-wide read-only visibility across all departments
- **Department Admin** — Full CRUD, user management, and budget proposals scoped to own department
- **Project Manager** — Create/edit projects, categories, risks, and actions within own department
- **Project Owner** — Read/update own assigned projects only (`/reports` blocked)

## Local Development

```bash
# 1. Backend API
cd server && cp .env.example .env && npm install && npm run dev

# 2. Frontend (runs in Demo Mode if Supabase env vars are omitted)
cd client && cp .env.example .env && npm install && npm run dev
```

## Live Production Deployment

Follow the step-by-step instructions in **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** to deploy **Supabase**, **Render**, and **Vercel**.

# GSL IT Portfolio Management Dashboard

A full-stack IT Portfolio Governance & Management web application for **Greensprings School (GSL)**, replacing manual Excel trackers with real-time PostgreSQL persistence, interactive analytics, inline portfolio updates, and role-based access control.

## Architecture

- **`client/`** — React 18, TypeScript, Vite, Tailwind CSS, Recharts (deployable to **Vercel**)
- **`server/`** — Node.js, Express, TypeScript (deployable to **Render** via `render.yaml`) for admin role & user management, department/budget administration, CSV import/export, server-side KPI summaries, and scheduled overdue-action sync
- **`supabase/migrations/`** — Normalized PostgreSQL schema, Row-Level Security (RLS) policies, Realtime publication, and sample seed data

## Features

1. **Executive Dashboard (`/`)**
   - Real-time KPI Grid: Total Projects, % Complete (Avg), Total Approved Budget, Remaining Budget, Projects At Risk (Red RAG), and Open Leadership Actions
   - Recharts Visualizations: RAG Status Distribution (Doughnut), Projects by Campus (Bar), and Projects by Category (Bar)
   - Surfaced Data Tables: Top 5 Open Critical/High Risks and Overdue Leadership Actions
2. **Master Portfolio View (`/portfolio`)**
   - Searchable, filterable table across all campuses and categories
   - Inline editing for `% Complete` and `RAG Status` (enabled for Project Managers & Admins; read-only for Executives)
   - Modal creation/editing of full project records and CSV export
3. **Project Drill-Down (`/projects/:id`) & Governance Register (`/governance`)**
   - Manage project-linked Risks and Leadership Actions
4. **RBAC & Security**
   - Database-enforced RLS (`executive` = read-only, `project_manager` & `admin` = full CRUD)
   - Admin user role management (`/admin/users`) backed by the Render Express API

## Quick Start

### 1. Supabase Setup
1. Create a Supabase project and run `supabase/migrations/001_initial_schema.sql` in the SQL Editor.
2. Optionally run `supabase/migrations/002_seed_data.sql` to load sample GSL projects, risks, and actions.
3. Promote an initial admin user in SQL Editor:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@greenspringsschool.com';
   ```

### 2. Backend API (`server/` — Render)
```bash
cd server
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CORS_ORIGIN
npm install
npm run dev
```

### 3. Frontend (`client/` — Vercel)
```bash
cd client
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
npm install
npm run dev
```

> **Preview without Supabase:** If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are omitted, the frontend runs in **Local Demo Mode** with sample GSL data and a role switcher (`Project Manager` vs `Executive View-Only`) so you can test the UI immediately.


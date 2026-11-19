# GSL IT Portfolio Management Dashboard — Full System Documentation

**Organization:** Greensprings School (GSL) — IT Department  
**Version:** v2.0  
**Target Hosting:** Vercel (Frontend), Railway (Express API), Supabase (PostgreSQL, Auth, Realtime)

---

## 1. System Overview & Architecture

The **GSL IT Portfolio Management Dashboard** replaces manual Excel project trackers with a role-aware, real-time web platform spanning Lekki, Ikoyi, Anthos, and cross-campus IT initiatives.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        Browser (React 18 + Vite)                        │
│  Executive Dashboard • Master Tracker • Project Charter • Governance    │
└───────────────┬─────────────────────────────────────────┬───────────────┘
                │                                         │
                │ HTTPS + Supabase JWT                    │ HTTPS + Bearer JWT
                ▼                                         ▼
┌───────────────────────────────┐         ┌───────────────────────────────┐
│     Supabase Platform         │         │    Railway Express API        │
│ • Auth (Email/Password JWT)   │         │ • /api/health                 │
│ • PostgreSQL + RLS Policies   │◄────────┤ • /api/portfolio/* (CSV/Bulk) │
│ • Realtime (postgres_changes) │ Service │ • /api/admin/* (Role Mgmt)    │
└───────────────────────────────┘  Role   │ • node-cron (01:00 WAT Sync)  │
                                          └───────────────────────────────┘
```

### Runtime Modes (`client/src/lib/supabase.ts`)
- **Production / Supabase Mode:** Active when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured. Uses real Supabase Auth sessions, PostgreSQL queries enforced by Row-Level Security (RLS), and live WebSocket subscriptions (`supabase_realtime`).
- **Local Demo Preview Mode:** Active automatically when Supabase environment variables are omitted. Loads `DEMO_PROJECTS`, `DEMO_RISKS`, and `DEMO_ACTIONS` from `client/src/data/demoData.ts` in memory and enables an **Active Role** switcher in the sidebar (`Project Manager`, `Executive`, `Admin`) for testing RBAC behavior locally.

---

## 2. Database Layer (Supabase PostgreSQL)

Defined in `supabase/migrations/001_initial_schema.sql` and seeded via `supabase/migrations/002_seed_data.sql`.

### 2.1 Domain Enums
- `campus_type`: `'Lekki'`, `'Ikoyi'`, `'Anthos'`, `'All Campuses'`
- `project_category_type`: `'Infrastructure'`, `'Software Applications'`, `'Cybersecurity'`, `'Service Delivery'`, `'Operations & Support'`, `'Strategic Initiatives'`
- `rag_status_type`: `'Green'` (On Track), `'Amber'` (Attention Needed), `'Red'` (Critical Issue), `'Blue'` (Completed)
- `procurement_status_type`: `'Not Started'`, `'RFQ / Tendering'`, `'Vendor Selected'`, `'PO Issued'`, `'Delivered'`, `'N/A'`
- `risk_severity_type`: `'Critical'`, `'High'`, `'Medium'`, `'Low'`
- `risk_status_type`: `'Open'`, `'Mitigated'`, `'Closed'`
- `action_status_type`: `'Pending Decision'`, `'Overdue'`, `'In Review'`, `'Closed'`
- `app_role`: `'executive'`, `'project_manager'`, `'admin'`

### 2.2 Core Tables

| Table | Key Columns | Purpose & Rules |
| :--- | :--- | :--- |
| `public.profiles` | `id` (FK `auth.users`), `email`, `full_name`, `role` | Stores RBAC roles. Auto-created via `on_auth_user_created` (`handle_new_user()`) with least-privilege default `'executive'`. |
| `public.projects` | `id`, `project_id` (unique e.g. `GSL-IT-001`), `name`, `category`, `campus`, 5 ownership fields (`business_owner`, `project_manager`, `technical_lead`, `key_stakeholders`, `approval_authority`), `percent_complete` (`0–100`), `rag_status`, `next_milestone`, `milestone_date`, `target_date`, 4 scoring columns (`impact_score`, `risk_score`, `urgency_score`, `strategic_score`), generated `priority_score`, `approved_budget`, `actual_spend`, `procurement_status`, 4 benefit columns (`problem_statement`, `expected_benefit`, `efficiency_savings`, `strategic_alignment`) | Master IT portfolio register. `priority_score` is a PostgreSQL `GENERATED ALWAYS AS` column averaging the 4 criteria (`1.00–5.00`). |
| `public.risks` | `id`, `project_id` (FK `projects.id ON DELETE CASCADE`), `description`, `severity`, `status`, `owner` | Project-level risk register surfaced onto the Executive Dashboard. |
| `public.leadership_actions` | `id`, `project_id` (FK `projects.id ON DELETE CASCADE`), `decision_required`, `required_by`, `decision_owner`, `due_date`, `impact_if_delayed`, `status` | Executive decision & escalation register. |

### 2.3 Triggers & Real-Time Sync
- `set_updated_at()` automatically updates `updated_at` on `profiles`, `projects`, `risks`, and `leadership_actions`.
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.projects, public.risks, public.leadership_actions;` broadcasts database inserts, updates, and deletes to connected clients, which trigger `refreshAll()` in `PortfolioContext`.

---

## 3. Role-Based Access Control (RBAC)

Access is enforced across three layers so view-only users cannot bypass UI restrictions:

1. **Database Layer (PostgreSQL RLS):**
   - Helper `public.current_user_role()` (`SECURITY DEFINER`) looks up `role` from `public.profiles` for `auth.uid()` without recursive policy lookups.
   - `SELECT`: Allowed for all `authenticated` users (`executive`, `project_manager`, `admin`).
   - `INSERT`, `UPDATE`, `DELETE` on `projects`, `risks`, `leadership_actions`: Restricted to `project_manager` and `admin`.
   - `profiles`: Users can update only their own `full_name`; the `WITH CHECK` clause prevents self-escalation of `role`.
2. **Backend API Layer (`server/src/middleware/auth.ts`):**
   - `authenticate` extracts the `Authorization: Bearer <token>` header, verifies it via `supabaseAuth.auth.getUser(token)`, and loads the caller's role from `profiles`.
   - `requireRole(allowedRoles)` returns `403 Forbidden` for unauthorized roles (e.g., an `executive` calling `/api/portfolio/import` or a non-admin calling `/api/admin/*`).
3. **Frontend UI Layer (`AuthContext.tsx` & Components):**
   - Exposes `role`, `canEdit` (`project_manager` or `admin`), and `isAdmin` (`admin`).
   - Executives see a `"Executive • View Only"` badge in the header, static progress bars / RAG pills instead of inline editors, and no create/edit/delete buttons.
   - Inline updates in `PortfolioContext.updateProjectInline` apply optimistically and roll back with an error toast if RLS rejects the write.

---

## 4. Frontend Application (`client/`)

### 4.1 Routing (`client/src/App.tsx`)

| Path | Component | Access | Description |
| :--- | :--- | :--- | :--- |
| `/login` | `LoginPage` | Public | Email/password sign-in and account registration |
| `/` | `ExecutiveDashboardPage` | All authenticated | Executive home view (Snapshot → KPIs → Charts → Surfaced Governance → Detailed Tracker) |
| `/portfolio` | `MasterPortfolioPage` | All authenticated | Searchable, filterable Master IT Project Tracker with inline editing, CSV export, and full project modal |
| `/projects/:id` | `ProjectDetailPage` | All authenticated | Project Charter: ownership matrix, priority breakdown, financials, benefits/outcomes, and CRUD for project risks/actions |
| `/governance` | `RisksAndActionsPage` | All authenticated | Global Leadership Action Register and Risk Register |
| `/admin/users` | `UserManagementPage` | `admin` only | Assigns `executive`, `project_manager`, or `admin` roles via the Railway Express API |

### 4.2 Executive Dashboard Flow (`ExecutiveDashboardPage.tsx`)
1. **Portfolio Snapshot & Governance Header (Top):** GSL crest (`GslLogo`), organization/department metadata, document version (`v2.0`), owner, review date, and the **Review & Reporting Cadence** strip (Weekly IT Review, Monthly Executive Review, Quarterly Portfolio Review).
2. **Executive KPI Grid (`KpiGrid.tsx`) & RAG Key (`RagLegend`):**
   - **Total Projects**
   - **Projects Completed** (`rag_status === 'Blue'` or `percent_complete >= 100`)
   - **Projects At Risk (Red)** (`rag_status === 'Red'`)
   - **Behind Schedule** (`rag_status !== 'Blue'`, `< 100%`, and `target_date < today`)
   - **Portfolio `% Complete`** (average across all projects)
   - **Budget Status** (Remaining Budget, Approved Budget, and % spent)
   - **Open Risks** (with Critical/High count)
   - **Open Action Items** (with Overdue count)
3. **Visual Analytics (Recharts):**
   - `RagDistributionChart`: Doughnut chart with explicit RAG meaning legend.
   - `ProjectsByCampusChart`: Bar chart across `Lekki`, `Ikoyi`, `Anthos`, and `All Campuses`.
   - `ProjectsByCategoryChart`: Horizontal bar chart across the 6 standardized IT categories.
4. **Surfaced Governance Sections:**
   - `TopRisksTable`: Top 5 non-closed `Critical` / `High` risks sorted by severity.
   - `OverdueActionsTable`: Open leadership actions that are `'Overdue'` or past `due_date`, including `Decision Required`, `Required By`, `Decision Owner`, `Due Date`, and `Impact if Delayed`.
   - `UpcomingMilestonesCard`: Chronological delivery checkpoints for active projects.
5. **Detailed IT Project Tracker (Bottom):**
   - Full `PortfolioTable` ranked by `priority_score` descending, with inline editing for `% Complete` (`InlinePercentEditor`) and `RAG Status` (`InlineRagSelect`), budget/procurement indicators, and `"Confirm ownership"` warnings if any ownership role is blank, `"Confirm"`, or `"TBD"`.

---

## 5. Backend API & Automation (`server/`)

Deployable on Railway (`server/railway.json`). Uses `helmet`, `cors`, `express.json`, and `zod` validation.

### 5.1 Endpoints

| Method & Path | Auth / Role | Purpose |
| :--- | :--- | :--- |
| `GET /api/health` | Public | Railway health check (`status: 'ok'`). |
| `GET /api/portfolio/summary` | Authenticated | Server-side aggregated KPIs across `projects`, `risks`, and `leadership_actions`. |
| `GET /api/portfolio/export` | Authenticated | Downloads RFC-4180 escaped CSV (`gsl-it-portfolio.csv`) ordered by `priority_score` descending. |
| `POST /api/portfolio/import` | `project_manager`, `admin` | Zod-validated bulk upsert (up to 200 projects per call) matching on `project_id`. |
| `POST /api/portfolio/sync-overdue` | `project_manager`, `admin` | Manually triggers overdue action status sync. |
| `GET /api/admin/users` | `admin` | Lists all user profiles from `public.profiles`. |
| `PATCH /api/admin/users/:id/role` | `admin` | Updates a user's `app_role` (blocks admins from demoting their own active account). |

### 5.2 Scheduled Overdue Action Automation (`server/src/jobs/overdueActions.ts`)
- When `ENABLE_OVERDUE_CRON=true`, `node-cron` runs daily at `01:00` (`Africa/Lagos` timezone).
- `syncOverdueLeadershipActions()` queries `leadership_actions` with status `'Pending Decision'` or `'In Review'` whose `due_date < current_date` and automatically transitions them to `'Overdue'`.

---

## 6. Deployment Checklist

1. **Supabase:** Run `supabase/migrations/001_initial_schema.sql` (and optionally `002_seed_data.sql`), then promote your first admin in SQL Editor:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@greenspringsschool.com';
   ```
2. **Railway (`server/`):** Set root directory to `server`, configure `PORT`, `CORS_ORIGIN` (your Vercel URL), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `ENABLE_OVERDUE_CRON=true`.
3. **Vercel (`client/`):** Set root directory to `client`, configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (your Railway URL), and `VITE_CURRENCY_CODE=NGN`. `client/vercel.json` handles SPA client-side routing rewrites.


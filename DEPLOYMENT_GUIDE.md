# Live Deployment Guide (Supabase + Render + Vercel)

Follow these steps in order to deploy the **GSL Enterprise Portfolio Management Dashboard** for live production use.

---

## Step 1: Set Up Supabase (Database & Authentication)

1. Go to [supabase.com](https://supabase.com) and click **New project**.
2. Choose an organization, enter a project name (e.g. `gsl-enterprise-portfolio`), set a strong database password, select a region close to your users, and click **Create new project**.
3. Wait for the database to finish provisioning, then open **SQL Editor** in the left sidebar:
   - Click **New query**, paste the full contents of `supabase/migrations/001_initial_schema.sql`, and click **Run**.
   - Click **New query**, paste the full contents of `supabase/migrations/002_seed_data.sql`, and click **Run** (seeds `IT`, `Maintenance`, `Transport`, `Facilities`, global categories, department budgets, and 12 sample projects `GSL-PROJECT-001` through `GSL-PROJECT-012`).
   > **Note:** Only run `003_...` or `004_...` if you are upgrading an older existing database. For a fresh project, run **only** `001_initial_schema.sql` and `002_seed_data.sql`.
4. Go to **Project Settings -> Data API / API Keys** and copy these three values for Steps 2 and 3:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **`anon` public key**
   - **`service_role` secret key** *(keep strictly private — server-side Render only, never put this in Vercel)*
5. Create your first **Super Admin** account:
   - Go to **Authentication -> Users -> Add user -> Create new user**.
   - Enter your email and password, check **Auto Confirm User**, and click **Create user**.
   - Return to **SQL Editor** and run (replacing the email and full name with yours):
     ```sql
     UPDATE public.profiles
     SET role = 'Super Admin', full_name = 'Your Full Name'
     WHERE email = 'your-email@greenspringsschool.com';
     ```

---

## Step 2: Deploy the Backend API on Render

1. Go to [render.com](https://render.com) and sign in with GitHub (`hcmdbolu/project-dashboard`).
2. Deploy using the included **`render.yaml`** Blueprint *(recommended)*:
   - Click **New + -> Blueprint**.
   - Select your `project-dashboard` GitHub repository and branch `main`.
   - Render reads `render.yaml` automatically (`rootDir: server`, `buildCommand: npm install && npm run build`, `startCommand: npm start`, `healthCheckPath: /api/health`).
3. When prompted for environment variables *(or under **Service -> Environment**)*, fill in:
   | Variable | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` |
   | `ENABLE_OVERDUE_CRON` | `true` |
   | `SUPABASE_URL` | Your Supabase Project URL |
   | `SUPABASE_ANON_KEY` | Your Supabase `anon` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase `service_role` key |
   | `CORS_ORIGIN` | `http://localhost:5173` *(temporarily — you will replace this with your Vercel URL in Step 4)* |
4. Click **Deploy** and wait for status **Live**.
5. Copy your Render URL (e.g. `https://gsl-enterprise-portfolio-api.onrender.com`) and verify it in a browser by visiting:
   ```text
   https://gsl-enterprise-portfolio-api.onrender.com/api/health
   ```
   You should see `{"status":"ok","service":"gsl-enterprise-portfolio-api",...}`.

---

## Step 3: Deploy the Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and click **Add New... -> Project**.
2. Import the `hcmdbolu/project-dashboard` GitHub repository.
3. Configure Build Settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Expand **Environment Variables** and add all four variables:
   | Variable | Value |
   | :--- | :--- |
   | `VITE_SUPABASE_URL` | Your Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase `anon` key |
   | `VITE_API_BASE_URL` | Your Render URL from Step 2 (no trailing slash, e.g. `https://gsl-enterprise-portfolio-api.onrender.com`) |
   | `VITE_CURRENCY_CODE` | `NGN` |
5. Click **Deploy** and wait for deployment to complete.
6. Copy your live Vercel URL (e.g. `https://gsl-project-dashboard.vercel.app`).

---

## Step 4: Connect CORS & Auth Redirects (Required!)

1. **Update Render `CORS_ORIGIN`:**
   - Open your Render service -> **Environment**.
   - Change `CORS_ORIGIN` to your live Vercel URL (no trailing slash, e.g. `https://gsl-project-dashboard.vercel.app`). If you also use a custom domain, separate multiple URLs with commas.
   - Click **Save Changes** (Render automatically redeploys with the new CORS origin).
2. **Update Supabase Auth URLs:**
   - Open Supabase -> **Authentication -> URL Configuration**.
   - Set **Site URL** to your live Vercel URL (`https://gsl-project-dashboard.vercel.app`).
   - Add `https://gsl-project-dashboard.vercel.app/**` under **Redirect URLs** and click **Save**.

---

## Step 5: Live Production Verification Checklist

1. Open your live Vercel URL — confirm you land on `/login` (not Demo Mode).
2. Sign in with your **Super Admin** email and password.
3. Open **User Management (`/admin/users`)** and create test staff accounts for each department (`Department Admin`, `Project Manager`, `Project Owner`) to verify Render + Supabase Service Role connectivity.
4. Open **Department Budgets (`/budgets`)** to propose/approve a department ceiling, then create a test project in **Master Portfolio (`/projects`)** and verify it receives the auto-generated code `GSL-PROJECT-013`.
5. Sign in as a **Project Owner** in an incognito window to verify they only see their assigned projects and cannot access `/reports`.

> **Render Free Tier Note:** Render's free web service spins down after 15 minutes of inactivity. The first Admin User or Department API request after idle may take ~30–50 seconds to wake up.

-- ============================================================================
-- GSL Enterprise Portfolio Management Dashboard - Forward Migration (v2 -> v3)
-- Run ONLY if upgrading an existing v2 database to multi-department v3.
-- ============================================================================

-- 1. Add Anthony to campus_type enum
ALTER TYPE public.campus_type ADD VALUE IF NOT EXISTS 'Anthony';

-- 2. Add budget_status_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_status_type') THEN
    CREATE TYPE public.budget_status_type AS ENUM (
      'Draft', 'Pending Approval', 'Approved', 'Rejected'
    );
  END IF;
END $$;

-- 3. Create departments & seed default departments
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.departments (id, name, code, description) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'IT', 'IT', 'Information Technology, Enterprise Systems, Infrastructure & Cybersecurity'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Maintenance', 'MNT', 'Preventive & Corrective Plant, HVAC, Electrical & Building Maintenance'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Transport', 'TRN', 'School Bus Fleet, Routing GPS Telemetry & Student Transit Safety'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'Facilities', 'FAC', 'Capital Works, Campus Grounds, Power Infrastructure & Security Upgrades')
ON CONFLICT (code) DO NOTHING;

-- 4. Upgrade app_role enum to 5 roles
ALTER TYPE public.app_role RENAME TO app_role_v2;
CREATE TYPE public.app_role AS ENUM (
  'Super Admin',
  'Executive',
  'Department Admin',
  'Project Manager',
  'Project Owner'
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.profiles
  ALTER COLUMN role TYPE public.app_role
  USING (
    CASE role::text
      WHEN 'Admin' THEN 'Super Admin'::public.app_role
      WHEN 'Project Manager' THEN 'Project Manager'::public.app_role
      WHEN 'Project Owner' THEN 'Project Owner'::public.app_role
      ELSE 'Executive'::public.app_role
    END
  );
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'Executive';
DROP TYPE public.app_role_v2 CASCADE;

-- 5. Dynamic categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, department_id)
);

INSERT INTO public.categories (name, department_id) VALUES
  ('Infrastructure', NULL),
  ('Software Applications', NULL),
  ('Cybersecurity', NULL),
  ('Service Delivery', NULL),
  ('Operations & Support', NULL),
  ('Strategic Initiatives', NULL),
  ('Fleet & Transport', NULL),
  ('Facility Maintenance', NULL)
ON CONFLICT DO NOTHING;

-- 6. Department Budgets & Audit Logs
CREATE TABLE IF NOT EXISTS public.department_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  fiscal_period text NOT NULL,
  proposed_amount numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (proposed_amount >= 0),
  approved_amount numeric(15,2) NOT NULL DEFAULT 0.00 CHECK (approved_amount >= 0),
  status public.budget_status_type NOT NULL DEFAULT 'Draft',
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, fiscal_period)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Upgrade projects, risks, leadership_actions with department_id & category_id & sequence
CREATE SEQUENCE IF NOT EXISTS public.gsl_project_code_seq START 1;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.projects
SET department_id = 'aaaaaaaa-0000-4000-8000-000000000001'
WHERE department_id IS NULL;

ALTER TABLE public.projects ALTER COLUMN department_id SET NOT NULL;

UPDATE public.projects p
SET category_id = c.id
FROM public.categories c
WHERE p.category_id IS NULL AND c.name = p.category::text AND c.department_id IS NULL;

ALTER TABLE public.projects ALTER COLUMN approved_budget TYPE numeric(15,2);
ALTER TABLE public.projects ALTER COLUMN actual_spend TYPE numeric(15,2);

ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT;
UPDATE public.risks r SET department_id = p.department_id FROM public.projects p WHERE r.project_id = p.id AND r.department_id IS NULL;
ALTER TABLE public.risks ALTER COLUMN department_id SET NOT NULL;

ALTER TABLE public.leadership_actions
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE RESTRICT;
UPDATE public.leadership_actions a SET department_id = p.department_id FROM public.projects p WHERE a.project_id = p.id AND a.department_id IS NULL;
ALTER TABLE public.leadership_actions ALTER COLUMN department_id SET NOT NULL;

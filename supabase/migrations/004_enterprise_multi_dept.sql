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


-- 8. Sync project code sequence above existing rows
SELECT setval(
  'public.gsl_project_code_seq',
  GREATEST(1, (SELECT COALESCE(MAX((regexp_match(project_code, '(\d+)$'))[1]::bigint), 0) FROM public.projects)),
  true
);

-- 9. Recreate triggers & RBAC helpers dropped by app_role_v2 CASCADE
CREATE OR REPLACE FUNCTION public.generate_gsl_project_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  candidate text;
BEGIN
  IF NEW.project_code IS NULL OR btrim(NEW.project_code) = '' THEN
    LOOP
      candidate := 'GSL-PROJECT-' || lpad(nextval('public.gsl_project_code_seq')::text, 3, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.projects WHERE project_code = candidate);
    END LOOP;
    NEW.project_code := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_auto_code ON public.projects;
CREATE TRIGGER trg_projects_auto_code
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.generate_gsl_project_code();

CREATE OR REPLACE FUNCTION public.sync_child_department_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT p.department_id INTO NEW.department_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_risks_sync_dept ON public.risks;
CREATE TRIGGER trg_risks_sync_dept
  BEFORE INSERT OR UPDATE OF project_id ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.sync_child_department_id();

DROP TRIGGER IF EXISTS trg_actions_sync_dept ON public.leadership_actions;
CREATE TRIGGER trg_actions_sync_dept
  BEFORE INSERT OR UPDATE OF project_id ON public.leadership_actions
  FOR EACH ROW EXECUTE FUNCTION public.sync_child_department_id();

CREATE OR REPLACE FUNCTION public.log_project_audit_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
BEGIN
  actor := COALESCE(NEW.updated_by, auth.uid());

  IF OLD.name IS DISTINCT FROM NEW.name THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'name', OLD.name, NEW.name);
  END IF;
  IF OLD.rag_status IS DISTINCT FROM NEW.rag_status THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'rag_status', OLD.rag_status::text, NEW.rag_status::text);
  END IF;
  IF OLD.schedule_status IS DISTINCT FROM NEW.schedule_status THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'schedule_status', OLD.schedule_status::text, NEW.schedule_status::text);
  END IF;
  IF OLD.percent_complete IS DISTINCT FROM NEW.percent_complete THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'percent_complete', OLD.percent_complete::text, NEW.percent_complete::text);
  END IF;
  IF OLD.approved_budget IS DISTINCT FROM NEW.approved_budget THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'approved_budget', OLD.approved_budget::text, NEW.approved_budget::text);
  END IF;
  IF OLD.actual_spend IS DISTINCT FROM NEW.actual_spend THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'actual_spend', OLD.actual_spend::text, NEW.actual_spend::text);
  END IF;
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'owner_id', OLD.owner_id::text, NEW.owner_id::text);
  END IF;
  IF OLD.project_manager_id IS DISTINCT FROM NEW.project_manager_id THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'project_manager_id', OLD.project_manager_id::text, NEW.project_manager_id::text);
  END IF;
  IF OLD.target_end_date IS DISTINCT FROM NEW.target_end_date THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'target_end_date', OLD.target_end_date::text, NEW.target_end_date::text);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_audit ON public.projects;
CREATE TRIGGER trg_projects_audit
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_project_audit_changes();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, campus)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'Executive',
    'All Campuses'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 10. Enable RLS and recreate full v3 5-role multi-department policies
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leadership_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read departments" ON public.departments;
CREATE POLICY "Authenticated users can read departments"
  ON public.departments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Only Super Admin manages departments" ON public.departments;
CREATE POLICY "Only Super Admin manages departments"
  ON public.departments FOR ALL TO authenticated
  USING (public.current_user_role() = 'Super Admin')
  WITH CHECK (public.current_user_role() = 'Super Admin');

DROP POLICY IF EXISTS "Users see global or own department categories" ON public.categories;
CREATE POLICY "Users see global or own department categories"
  ON public.categories FOR SELECT TO authenticated
  USING (
    department_id IS NULL
    OR public.current_user_role() IN ('Super Admin', 'Executive')
    OR department_id = public.current_user_department_id()
  );

DROP POLICY IF EXISTS "Admins and PMs can create categories" ON public.categories;
CREATE POLICY "Admins and PMs can create categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND (department_id IS NULL OR department_id = public.current_user_department_id())
    )
  );

DROP POLICY IF EXISTS "Role-scoped profile reads" ON public.profiles;
CREATE POLICY "Role-scoped profile reads"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('Super Admin', 'Executive')
    OR id = auth.uid()
    OR department_id = public.current_user_department_id()
  );

DROP POLICY IF EXISTS "Role-scoped budget reads" ON public.department_budgets;
CREATE POLICY "Role-scoped budget reads"
  ON public.department_budgets FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('Super Admin', 'Executive')
    OR department_id = public.current_user_department_id()
  );

DROP POLICY IF EXISTS "Department Admin proposes own dept budget; Super Admin manages all" ON public.department_budgets;
CREATE POLICY "Department Admin proposes own dept budget; Super Admin manages all"
  ON public.department_budgets FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() = 'Department Admin'
      AND department_id = public.current_user_department_id()
      AND status IN ('Draft', 'Pending Approval')
    )
  );

DROP POLICY IF EXISTS "Department Admin updates own proposal; Super Admin approves/rejects" ON public.department_budgets;
CREATE POLICY "Department Admin updates own proposal; Super Admin approves/rejects"
  ON public.department_budgets FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() = 'Department Admin'
      AND department_id = public.current_user_department_id()
      AND status IN ('Draft', 'Pending Approval', 'Rejected')
    )
  )
  WITH CHECK (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() = 'Department Admin'
      AND department_id = public.current_user_department_id()
      AND status IN ('Draft', 'Pending Approval')
    )
  );

DROP POLICY IF EXISTS "Role-scoped project reads" ON public.projects;
CREATE POLICY "Role-scoped project reads"
  ON public.projects FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('Super Admin', 'Executive')
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND department_id = public.current_user_department_id()
    )
    OR (
      public.current_user_role() = 'Project Owner'
      AND department_id = public.current_user_department_id()
      AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Super Admin, Dept Admin, and PM insert projects in scope" ON public.projects;
CREATE POLICY "Super Admin, Dept Admin, and PM insert projects in scope"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND department_id = public.current_user_department_id()
    )
  );

DROP POLICY IF EXISTS "Role-scoped project updates" ON public.projects;
CREATE POLICY "Role-scoped project updates"
  ON public.projects FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND department_id = public.current_user_department_id()
    )
    OR (
      public.current_user_role() = 'Project Owner'
      AND department_id = public.current_user_department_id()
      AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND department_id = public.current_user_department_id()
    )
    OR (
      public.current_user_role() = 'Project Owner'
      AND department_id = public.current_user_department_id()
      AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Super Admin and scoped Dept Admin delete projects" ON public.projects;
CREATE POLICY "Super Admin and scoped Dept Admin delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() = 'Department Admin'
      AND department_id = public.current_user_department_id()
    )
  );

DROP POLICY IF EXISTS "Role-scoped risks reads" ON public.risks;
CREATE POLICY "Role-scoped risks reads"
  ON public.risks FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('Super Admin', 'Executive')
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND department_id = public.current_user_department_id()
    )
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id
          AND p.department_id = public.current_user_department_id()
          AND p.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Role-scoped risks insert" ON public.risks;
CREATE POLICY "Role-scoped risks insert"
  ON public.risks FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id AND p.department_id = public.current_user_department_id()
      )
    )
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id
          AND p.department_id = public.current_user_department_id()
          AND p.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Role-scoped risks update" ON public.risks;
CREATE POLICY "Role-scoped risks update"
  ON public.risks FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND department_id = public.current_user_department_id()
    )
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id
          AND p.department_id = public.current_user_department_id()
          AND p.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Super Admin and scoped Dept Admin delete risks" ON public.risks;
CREATE POLICY "Super Admin and scoped Dept Admin delete risks"
  ON public.risks FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() = 'Department Admin'
      AND department_id = public.current_user_department_id()
    )
  );

DROP POLICY IF EXISTS "Role-scoped leadership actions reads" ON public.leadership_actions;
CREATE POLICY "Role-scoped leadership actions reads"
  ON public.leadership_actions FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('Super Admin', 'Executive')
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND department_id = public.current_user_department_id()
    )
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id
          AND p.department_id = public.current_user_department_id()
          AND p.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Role-scoped leadership actions insert" ON public.leadership_actions;
CREATE POLICY "Role-scoped leadership actions insert"
  ON public.leadership_actions FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id AND p.department_id = public.current_user_department_id()
      )
    )
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id
          AND p.department_id = public.current_user_department_id()
          AND p.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Role-scoped leadership actions update" ON public.leadership_actions;
CREATE POLICY "Role-scoped leadership actions update"
  ON public.leadership_actions FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND department_id = public.current_user_department_id()
    )
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id
          AND p.department_id = public.current_user_department_id()
          AND p.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Super Admin and scoped Dept Admin delete leadership actions" ON public.leadership_actions;
CREATE POLICY "Super Admin and scoped Dept Admin delete leadership actions"
  ON public.leadership_actions FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() = 'Department Admin'
      AND department_id = public.current_user_department_id()
    )
  );

DROP POLICY IF EXISTS "Role-scoped audit log reads" ON public.audit_logs;
CREATE POLICY "Role-scoped audit log reads"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('Super Admin', 'Executive')
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.department_id = public.current_user_department_id()
        AND (
          public.current_user_role() IN ('Department Admin', 'Project Manager')
          OR (public.current_user_role() = 'Project Owner' AND p.owner_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Users can update own full_name only" ON public.profiles;
CREATE POLICY "Users can update own full_name only"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND department_id IS NOT DISTINCT FROM (SELECT p.department_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "Only Super Admin deletes department budgets" ON public.department_budgets;
CREATE POLICY "Only Super Admin deletes department budgets"
  ON public.department_budgets FOR DELETE TO authenticated
  USING (public.current_user_role() = 'Super Admin');


-- 11. Required Schema, Table, Sequence & Function Grants (enforced by RLS above)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_department_id() TO authenticated, service_role;

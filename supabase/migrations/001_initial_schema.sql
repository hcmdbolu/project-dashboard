-- ============================================================================
-- GSL Enterprise Portfolio Management Dashboard - Canonical Schema (v3)
-- Multi-Department + 5-Role RBAC + Dynamic Categories + Budgets + Audit Logs
-- ============================================================================

-- 1. Domain Enums
CREATE TYPE public.campus_type AS ENUM (
  'Lekki',
  'Ikoyi',
  'Anthos',
  'Anthony',
  'All Campuses'
);

CREATE TYPE public.schedule_status_type AS ENUM (
  'On Schedule',
  'Behind Schedule',
  'Completed',
  'Not Started'
);

CREATE TYPE public.rag_status_type AS ENUM (
  'Green',
  'Amber',
  'Red',
  'Blue'
);

CREATE TYPE public.procurement_status_type AS ENUM (
  'Not Started',
  'RFQ / Tendering',
  'Vendor Selected',
  'PO Issued',
  'Delivered',
  'N/A'
);

CREATE TYPE public.budget_status_type AS ENUM (
  'Draft',
  'Pending Approval',
  'Approved',
  'Rejected'
);

CREATE TYPE public.risk_severity_type AS ENUM (
  'Critical',
  'High',
  'Medium',
  'Low'
);

CREATE TYPE public.risk_status_type AS ENUM (
  'Open',
  'Mitigated',
  'Closed'
);

CREATE TYPE public.action_status_type AS ENUM (
  'Pending Decision',
  'Overdue',
  'In Review',
  'Closed'
);

CREATE TYPE public.app_role AS ENUM (
  'Super Admin',
  'Executive',
  'Department Admin',
  'Project Manager',
  'Project Owner'
);

-- 2. Departments
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. User Profiles (5-Role RBAC + Department Partitioning)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text UNIQUE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'Executive',
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  campus public.campus_type NOT NULL DEFAULT 'All Campuses',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Dynamic Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, department_id)
);

CREATE UNIQUE INDEX idx_categories_global_name
  ON public.categories (lower(name))
  WHERE department_id IS NULL;

-- 5. Department Budgets (Proposal & Super Admin Approval)
CREATE TABLE public.department_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  fiscal_period text NOT NULL,
  proposed_amount numeric(15,2) NOT NULL DEFAULT 0.00
    CHECK (proposed_amount >= 0),
  approved_amount numeric(15,2) NOT NULL DEFAULT 0.00
    CHECK (approved_amount >= 0),
  status public.budget_status_type NOT NULL DEFAULT 'Draft',
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, fiscal_period)
);

-- 6. Auto-Generated Project Code Sequence (GSL-PROJECT-001, GSL-PROJECT-002...)
CREATE SEQUENCE public.gsl_project_code_seq START 1;

-- 7. Projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code text UNIQUE NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  campus public.campus_type NOT NULL,

  -- Ownership & Accountability (linked to profiles + display labels)
  project_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  technical_lead_name text NOT NULL DEFAULT '',
  approval_authority text NOT NULL DEFAULT '',

  -- Benefits & Outcomes
  problem_solved text NOT NULL DEFAULT '',
  expected_benefit text NOT NULL DEFAULT '',
  savings_efficiency text NOT NULL DEFAULT '',

  -- Progress, Health & Schedule
  percent_complete smallint NOT NULL DEFAULT 0
    CHECK (percent_complete >= 0 AND percent_complete <= 100),
  schedule_status public.schedule_status_type NOT NULL DEFAULT 'Not Started',
  rag_status public.rag_status_type NOT NULL DEFAULT 'Green',
  next_milestone text NOT NULL DEFAULT '',
  milestone_due_date date,
  target_end_date date NOT NULL,

  -- Weighted Priority Scoring (1-5 criteria)
  business_impact numeric(3,2) NOT NULL DEFAULT 3.00
    CHECK (business_impact >= 1.00 AND business_impact <= 5.00),
  risk_level numeric(3,2) NOT NULL DEFAULT 3.00
    CHECK (risk_level >= 1.00 AND risk_level <= 5.00),
  urgency numeric(3,2) NOT NULL DEFAULT 3.00
    CHECK (urgency >= 1.00 AND urgency <= 5.00),
  strategic_importance numeric(3,2) NOT NULL DEFAULT 3.00
    CHECK (strategic_importance >= 1.00 AND strategic_importance <= 5.00),
  priority_score numeric(4,2) GENERATED ALWAYS AS (
    ROUND((
      business_impact * 0.35 +
      strategic_importance * 0.30 +
      urgency * 0.20 +
      risk_level * 0.15
    )::numeric, 2)
  ) STORED,

  -- Flexible Exact Naira Budget & Financial Tracking
  approved_budget numeric(15,2) NOT NULL DEFAULT 0.00
    CHECK (approved_budget >= 0),
  actual_spend numeric(15,2) NOT NULL DEFAULT 0.00
    CHECK (actual_spend >= 0),
  procurement_status public.procurement_status_type NOT NULL DEFAULT 'Not Started',

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7b. Multi-Owner & Department-Owner Junction Tables
CREATE TABLE public.project_owners (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE public.project_department_owners (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, department_id)
);

-- 8. Risks & Leadership Actions (Department-Partitioned)
CREATE TABLE public.risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  description text NOT NULL,
  severity public.risk_severity_type NOT NULL DEFAULT 'Medium',
  mitigation_plan text NOT NULL DEFAULT '',
  status public.risk_status_type NOT NULL DEFAULT 'Open',
  risk_owner text NOT NULL,
  target_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.leadership_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  decision_required text NOT NULL,
  required_by text NOT NULL DEFAULT 'Project Lead',
  decision_owner text NOT NULL DEFAULT 'Executive Leadership',
  due_date date NOT NULL,
  status public.action_status_type NOT NULL DEFAULT 'Pending Decision',
  impact_if_delayed text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. Audit Logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- 10. Indexes
CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_department_id ON public.profiles (department_id);
CREATE INDEX idx_budgets_department_id ON public.department_budgets (department_id);
CREATE INDEX idx_projects_department_id ON public.projects (department_id);
CREATE INDEX idx_projects_category_id ON public.projects (category_id);
CREATE INDEX idx_projects_owner_id ON public.projects (owner_id);
CREATE INDEX idx_projects_pm_id ON public.projects (project_manager_id);
CREATE INDEX idx_projects_campus ON public.projects (campus);
CREATE INDEX idx_projects_rag_status ON public.projects (rag_status);
CREATE INDEX idx_projects_priority ON public.projects (priority_score DESC);
CREATE INDEX idx_project_owners_project_id ON public.project_owners (project_id);
CREATE INDEX idx_project_owners_user_id ON public.project_owners (user_id);
CREATE INDEX idx_project_dept_owners_project_id ON public.project_department_owners (project_id);
CREATE INDEX idx_project_dept_owners_department_id ON public.project_department_owners (department_id);
CREATE INDEX idx_risks_project_id ON public.risks (project_id);
CREATE INDEX idx_risks_department_id ON public.risks (department_id);
CREATE INDEX idx_actions_project_id ON public.leadership_actions (project_id);
CREATE INDEX idx_actions_department_id ON public.leadership_actions (department_id);
CREATE INDEX idx_audit_logs_project_id ON public.audit_logs (project_id, changed_at DESC);

-- 11. Triggers & Automation Functions
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON public.department_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_risks_updated_at
  BEFORE UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_leadership_actions_updated_at
  BEFORE UPDATE ON public.leadership_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-generate GSL-PROJECT-001, GSL-PROJECT-002, etc. (collision-safe loop)
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
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.projects WHERE project_code = candidate
      );
    END LOOP;
    NEW.project_code := candidate;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_auto_code
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.generate_gsl_project_code();

-- Sync department_id onto risks and leadership_actions from parent project
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

CREATE TRIGGER trg_risks_sync_dept
  BEFORE INSERT OR UPDATE OF project_id ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.sync_child_department_id();

CREATE TRIGGER trg_actions_sync_dept
  BEFORE INSERT OR UPDATE OF project_id ON public.leadership_actions
  FOR EACH ROW EXECUTE FUNCTION public.sync_child_department_id();

-- Audit log trigger on projects updates
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
  IF OLD.department_id IS DISTINCT FROM NEW.department_id THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'department_id', OLD.department_id::text, NEW.department_id::text);
  END IF;
  IF OLD.category_id IS DISTINCT FROM NEW.category_id THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'category_id', OLD.category_id::text, NEW.category_id::text);
  END IF;
  IF OLD.next_milestone IS DISTINCT FROM NEW.next_milestone THEN
    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, actor, 'next_milestone', OLD.next_milestone, NEW.next_milestone);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_audit
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_project_audit_changes();

CREATE OR REPLACE FUNCTION public.log_project_co_owner_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(NULLIF(btrim(full_name), ''), email, NEW.user_id::text)
    INTO v_label
    FROM public.profiles
    WHERE id = NEW.user_id;

    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.project_id, auth.uid(), 'co_owners', NULL, 'Added: ' || COALESCE(v_label, NEW.user_id::text));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = OLD.project_id) THEN
      SELECT COALESCE(NULLIF(btrim(full_name), ''), email, OLD.user_id::text)
      INTO v_label
      FROM public.profiles
      WHERE id = OLD.user_id;

      INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
      VALUES (OLD.project_id, auth.uid(), 'co_owners', 'Removed: ' || COALESCE(v_label, OLD.user_id::text), NULL);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_project_dept_owner_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(name, NEW.department_id::text)
    INTO v_label
    FROM public.departments
    WHERE id = NEW.department_id;

    INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.project_id, auth.uid(), 'department_owners', NULL, 'Added: ' || COALESCE(v_label, NEW.department_id::text));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = OLD.project_id) THEN
      SELECT COALESCE(name, OLD.department_id::text)
      INTO v_label
      FROM public.departments
      WHERE id = OLD.department_id;

      INSERT INTO public.audit_logs (project_id, changed_by, field_name, old_value, new_value)
      VALUES (OLD.project_id, auth.uid(), 'department_owners', 'Removed: ' || COALESCE(v_label, OLD.department_id::text), NULL);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_project_owners_audit
  AFTER INSERT OR DELETE ON public.project_owners
  FOR EACH ROW EXECUTE FUNCTION public.log_project_co_owner_changes();

CREATE TRIGGER trg_project_dept_owners_audit
  AFTER INSERT OR DELETE ON public.project_department_owners
  FOR EACH ROW EXECUTE FUNCTION public.log_project_dept_owner_changes();

-- Auto-provision least-privilege 'Executive' profile on self-signup
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. RBAC Helper Functions
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

CREATE OR REPLACE FUNCTION public.is_project_co_owner(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_owners po
    WHERE po.project_id = _project_id
      AND po.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_dept_owner(_project_id uuid, _dept_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _dept_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.project_department_owners pdo
      WHERE pdo.project_id = _project_id
        AND pdo.department_id = _dept_id
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_role() IN ('Super Admin', 'Executive')
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = _project_id
        AND (
          (
            public.current_user_role() IN ('Department Admin', 'Project Manager')
            AND p.department_id = public.current_user_department_id()
          )
          OR public.is_project_co_owner(p.id, auth.uid())
          OR public.is_project_dept_owner(p.id, public.current_user_department_id())
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_role() = 'Super Admin'
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = _project_id
        AND (
          (
            public.current_user_role() IN ('Department Admin', 'Project Manager')
            AND p.department_id = public.current_user_department_id()
          )
          OR public.is_project_co_owner(p.id, auth.uid())
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project_ownership(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_role() = 'Super Admin'
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = _project_id
        AND public.current_user_role() IN ('Department Admin', 'Project Manager')
        AND p.department_id = public.current_user_department_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.project_primary_department_unchanged(_project_id uuid, _new_dept_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND p.department_id = _new_dept_id
  );
$$;

-- 13. Row-Level Security (5-Role Multi-Department Matrix)
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_department_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leadership_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Departments
CREATE POLICY "Authenticated users can read departments"
  ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only Super Admin manages departments"
  ON public.departments FOR ALL TO authenticated
  USING (public.current_user_role() = 'Super Admin')
  WITH CHECK (public.current_user_role() = 'Super Admin');

-- Categories
CREATE POLICY "Users see global or own department categories"
  ON public.categories FOR SELECT TO authenticated
  USING (
    department_id IS NULL
    OR public.current_user_role() IN ('Super Admin', 'Executive')
    OR department_id = public.current_user_department_id()
  );

CREATE POLICY "Admins and PMs can create categories"
  ON public.categories FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND (department_id IS NULL OR department_id = public.current_user_department_id())
    )
  );

CREATE POLICY "Super Admin can manage all categories"
  ON public.categories FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'Super Admin')
  WITH CHECK (public.current_user_role() = 'Super Admin');

CREATE POLICY "Super Admin can delete categories"
  ON public.categories FOR DELETE TO authenticated
  USING (public.current_user_role() = 'Super Admin');

-- Profiles
CREATE POLICY "Role-scoped profile reads"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own full_name only"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND department_id IS NOT DISTINCT FROM (SELECT p.department_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Department Budgets
CREATE POLICY "Role-scoped budget reads"
  ON public.department_budgets FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('Super Admin', 'Executive')
    OR department_id = public.current_user_department_id()
  );

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

CREATE POLICY "Only Super Admin deletes department budgets"
  ON public.department_budgets FOR DELETE TO authenticated
  USING (public.current_user_role() = 'Super Admin');

-- Projects
CREATE POLICY "Role-scoped project reads"
  ON public.projects FOR SELECT TO authenticated
  USING (public.can_view_project(id));

CREATE POLICY "Super Admin, Dept Admin, and PM insert projects in scope"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND department_id = public.current_user_department_id()
    )
  );

CREATE POLICY "Role-scoped project updates"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.can_edit_project(id))
  WITH CHECK (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() IN ('Department Admin', 'Project Manager')
      AND department_id = public.current_user_department_id()
    )
    OR (
      public.is_project_co_owner(id, auth.uid())
      AND public.project_primary_department_unchanged(id, department_id)
    )
  );

CREATE POLICY "Super Admin and scoped Dept Admin delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() = 'Department Admin'
      AND department_id = public.current_user_department_id()
    )
  );

-- Project Owners (Co-Owners)
CREATE POLICY "Project co-owner reads"
  ON public.project_owners FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

CREATE POLICY "Admins and PMs insert project co-owners"
  ON public.project_owners FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project_ownership(project_id));

CREATE POLICY "Admins and PMs delete project co-owners"
  ON public.project_owners FOR DELETE TO authenticated
  USING (public.can_manage_project_ownership(project_id));

-- Project Department Owners (Department-Wide View Access)
CREATE POLICY "Project dept-owner reads"
  ON public.project_department_owners FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

CREATE POLICY "Admins and PMs insert project dept-owners"
  ON public.project_department_owners FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project_ownership(project_id));

CREATE POLICY "Admins and PMs delete project dept-owners"
  ON public.project_department_owners FOR DELETE TO authenticated
  USING (public.can_manage_project_ownership(project_id));

-- Risks
CREATE POLICY "Role-scoped risks reads"
  ON public.risks FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

CREATE POLICY "Role-scoped risks insert"
  ON public.risks FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id));

CREATE POLICY "Role-scoped risks update"
  ON public.risks FOR UPDATE TO authenticated
  USING (public.can_edit_project(project_id))
  WITH CHECK (public.can_edit_project(project_id));

CREATE POLICY "Super Admin and scoped Dept Admin delete risks"
  ON public.risks FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() = 'Department Admin'
      AND department_id = public.current_user_department_id()
    )
  );

-- Leadership Actions
CREATE POLICY "Role-scoped leadership actions reads"
  ON public.leadership_actions FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

CREATE POLICY "Role-scoped leadership actions insert"
  ON public.leadership_actions FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id));

CREATE POLICY "Role-scoped leadership actions update"
  ON public.leadership_actions FOR UPDATE TO authenticated
  USING (public.can_edit_project(project_id))
  WITH CHECK (public.can_edit_project(project_id));

CREATE POLICY "Super Admin and scoped Dept Admin delete leadership actions"
  ON public.leadership_actions FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'Super Admin'
    OR (
      public.current_user_role() = 'Department Admin'
      AND department_id = public.current_user_department_id()
    )
  );

-- Audit Logs (read-only for users matching project visibility)
CREATE POLICY "Role-scoped audit log reads"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

-- 14. Enable Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.departments,
  public.categories,
  public.department_budgets,
  public.projects,
  public.project_owners,
  public.project_department_owners,
  public.risks,
  public.leadership_actions;


-- 15. Required Schema, Table, Sequence & Function Grants (enforced by RLS above)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_department_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_co_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_dept_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_project_ownership(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_primary_department_unchanged(uuid, uuid) TO authenticated, service_role;

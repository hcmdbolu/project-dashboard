-- ============================================================================
-- GSL Enterprise Portfolio Management Dashboard - Forward Migration (v3 -> v4)
-- 1. Multiple Individual Co-Owners (public.project_owners) -> View & Edit
-- 2. Department-Wide Owners (public.project_department_owners) -> View-Only
-- 3. Super Admin Multi-Role Visibility in profiles & PM/Owner assignment
-- 4. Ownership Audit Triggers, Updated RLS Policies & Realtime Publication
-- ============================================================================

-- 1. Junction Tables
CREATE TABLE IF NOT EXISTS public.project_owners (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_department_owners (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_project_owners_project_id
  ON public.project_owners (project_id);
CREATE INDEX IF NOT EXISTS idx_project_owners_user_id
  ON public.project_owners (user_id);
CREATE INDEX IF NOT EXISTS idx_project_dept_owners_project_id
  ON public.project_department_owners (project_id);
CREATE INDEX IF NOT EXISTS idx_project_dept_owners_department_id
  ON public.project_department_owners (department_id);

-- 2. Backfill existing single owner_id values into public.project_owners
INSERT INTO public.project_owners (project_id, user_id)
SELECT id, owner_id
FROM public.projects
WHERE owner_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. SECURITY DEFINER RLS Helper Functions (prevents circular RLS evaluation)
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

-- 4. Ownership Audit Triggers (guarded against parent project cascade delete)
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

DROP TRIGGER IF EXISTS trg_project_owners_audit ON public.project_owners;
CREATE TRIGGER trg_project_owners_audit
  AFTER INSERT OR DELETE ON public.project_owners
  FOR EACH ROW EXECUTE FUNCTION public.log_project_co_owner_changes();

DROP TRIGGER IF EXISTS trg_project_dept_owners_audit ON public.project_department_owners;
CREATE TRIGGER trg_project_dept_owners_audit
  AFTER INSERT OR DELETE ON public.project_department_owners
  FOR EACH ROW EXECUTE FUNCTION public.log_project_dept_owner_changes();

-- 5. Updated Row-Level Security Policies
ALTER TABLE public.project_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_department_owners ENABLE ROW LEVEL SECURITY;

-- Profiles: allow authenticated directory reads so Super Admins (department_id IS NULL)
-- and cross-department co-owners/audit actors resolve in pickers and UI tables.
DROP POLICY IF EXISTS "Role-scoped profile reads" ON public.profiles;
CREATE POLICY "Role-scoped profile reads"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- Projects
DROP POLICY IF EXISTS "Role-scoped project reads" ON public.projects;
CREATE POLICY "Role-scoped project reads"
  ON public.projects FOR SELECT TO authenticated
  USING (public.can_view_project(id));

DROP POLICY IF EXISTS "Role-scoped project updates" ON public.projects;
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

-- Project Owners (Co-Owners)
DROP POLICY IF EXISTS "Project co-owner reads" ON public.project_owners;
CREATE POLICY "Project co-owner reads"
  ON public.project_owners FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

DROP POLICY IF EXISTS "Admins and PMs insert project co-owners" ON public.project_owners;
CREATE POLICY "Admins and PMs insert project co-owners"
  ON public.project_owners FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project_ownership(project_id));

DROP POLICY IF EXISTS "Admins and PMs delete project co-owners" ON public.project_owners;
CREATE POLICY "Admins and PMs delete project co-owners"
  ON public.project_owners FOR DELETE TO authenticated
  USING (public.can_manage_project_ownership(project_id));

-- Project Department Owners (Department-Wide View Access)
DROP POLICY IF EXISTS "Project dept-owner reads" ON public.project_department_owners;
CREATE POLICY "Project dept-owner reads"
  ON public.project_department_owners FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

DROP POLICY IF EXISTS "Admins and PMs insert project dept-owners" ON public.project_department_owners;
CREATE POLICY "Admins and PMs insert project dept-owners"
  ON public.project_department_owners FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_project_ownership(project_id));

DROP POLICY IF EXISTS "Admins and PMs delete project dept-owners" ON public.project_department_owners;
CREATE POLICY "Admins and PMs delete project dept-owners"
  ON public.project_department_owners FOR DELETE TO authenticated
  USING (public.can_manage_project_ownership(project_id));

-- Risks
DROP POLICY IF EXISTS "Role-scoped risks reads" ON public.risks;
CREATE POLICY "Role-scoped risks reads"
  ON public.risks FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

DROP POLICY IF EXISTS "Role-scoped risks insert" ON public.risks;
CREATE POLICY "Role-scoped risks insert"
  ON public.risks FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id));

DROP POLICY IF EXISTS "Role-scoped risks update" ON public.risks;
CREATE POLICY "Role-scoped risks update"
  ON public.risks FOR UPDATE TO authenticated
  USING (public.can_edit_project(project_id))
  WITH CHECK (public.can_edit_project(project_id));

-- Leadership Actions
DROP POLICY IF EXISTS "Role-scoped leadership actions reads" ON public.leadership_actions;
CREATE POLICY "Role-scoped leadership actions reads"
  ON public.leadership_actions FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

DROP POLICY IF EXISTS "Role-scoped leadership actions insert" ON public.leadership_actions;
CREATE POLICY "Role-scoped leadership actions insert"
  ON public.leadership_actions FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(project_id));

DROP POLICY IF EXISTS "Role-scoped leadership actions update" ON public.leadership_actions;
CREATE POLICY "Role-scoped leadership actions update"
  ON public.leadership_actions FOR UPDATE TO authenticated
  USING (public.can_edit_project(project_id))
  WITH CHECK (public.can_edit_project(project_id));

-- Audit Logs
DROP POLICY IF EXISTS "Role-scoped audit log reads" ON public.audit_logs;
CREATE POLICY "Role-scoped audit log reads"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.can_view_project(project_id));

-- 6. Supabase Realtime Publication & Grants
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.project_owners;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.project_department_owners;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_owners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_department_owners TO authenticated;
GRANT ALL ON public.project_owners TO service_role;
GRANT ALL ON public.project_department_owners TO service_role;

GRANT EXECUTE ON FUNCTION public.is_project_co_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_dept_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_project_ownership(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_primary_department_unchanged(uuid, uuid) TO authenticated, service_role;

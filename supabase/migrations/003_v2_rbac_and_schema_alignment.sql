-- ============================================================================
-- GSL IT Portfolio Management Dashboard - v2 Upgrade Migration
-- Run this ONLY if upgrading an existing v1 database instead of a fresh setup.
-- ============================================================================

-- 1. Add schedule_status_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_status_type') THEN
    CREATE TYPE public.schedule_status_type AS ENUM (
      'On Schedule',
      'Behind Schedule',
      'Completed',
      'Not Started'
    );
  END IF;
END $$;

-- 2. Upgrade app_role enum to 4 title-case roles
ALTER TYPE public.app_role RENAME TO app_role_v1;
CREATE TYPE public.app_role AS ENUM (
  'Executive',
  'Project Manager',
  'Project Owner',
  'Admin'
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS campus public.campus_type NOT NULL DEFAULT 'All Campuses';

ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.profiles
  ALTER COLUMN role TYPE public.app_role
  USING (
    CASE role::text
      WHEN 'admin' THEN 'Admin'::public.app_role
      WHEN 'project_manager' THEN 'Project Manager'::public.app_role
      ELSE 'Executive'::public.app_role
    END
  );
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'Executive';
DROP TYPE public.app_role_v1 CASCADE;

-- 3. Align projects columns & weighted priority_score
ALTER TABLE public.projects RENAME COLUMN project_id TO project_code;
ALTER TABLE public.projects RENAME COLUMN business_owner TO business_owner_name;
ALTER TABLE public.projects RENAME COLUMN project_manager TO project_manager_name;
ALTER TABLE public.projects RENAME COLUMN technical_lead TO technical_lead_name;
ALTER TABLE public.projects RENAME COLUMN problem_statement TO problem_solved;
ALTER TABLE public.projects RENAME COLUMN efficiency_savings TO savings_efficiency;
ALTER TABLE public.projects RENAME COLUMN milestone_date TO milestone_due_date;
ALTER TABLE public.projects RENAME COLUMN target_date TO target_end_date;

ALTER TABLE public.projects DROP COLUMN IF EXISTS priority_score;
ALTER TABLE public.projects RENAME COLUMN impact_score TO business_impact;
ALTER TABLE public.projects RENAME COLUMN risk_score TO risk_level;
ALTER TABLE public.projects RENAME COLUMN urgency_score TO urgency;
ALTER TABLE public.projects RENAME COLUMN strategic_score TO strategic_importance;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_status public.schedule_status_type NOT NULL DEFAULT 'On Schedule',
  ADD COLUMN IF NOT EXISTS priority_score numeric(4,2) GENERATED ALWAYS AS (
    ROUND((
      business_impact * 0.35 +
      strategic_importance * 0.30 +
      urgency * 0.20 +
      risk_level * 0.15
    )::numeric, 2)
  ) STORED;

-- 4. Align risks columns
ALTER TABLE public.risks RENAME COLUMN owner TO risk_owner;
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS mitigation_plan text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS target_date date;

-- 5. Recreate helper, trigger & 4-role RLS policies
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

DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can view risks" ON public.risks;
DROP POLICY IF EXISTS "Authenticated users can view leadership actions" ON public.leadership_actions;
DROP POLICY IF EXISTS "PMs and Admins can insert projects" ON public.projects;
DROP POLICY IF EXISTS "PMs and Admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "PMs and Admins can delete projects" ON public.projects;
DROP POLICY IF EXISTS "PMs and Admins can manage risks" ON public.risks;
DROP POLICY IF EXISTS "PMs and Admins can manage leadership actions" ON public.leadership_actions;

CREATE POLICY "Role-scoped project read"
  ON public.projects FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('Executive', 'Project Manager', 'Admin')
    OR (public.current_user_role() = 'Project Owner' AND owner_id = auth.uid())
  );

CREATE POLICY "Role-scoped risks read"
  ON public.risks FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('Executive', 'Project Manager', 'Admin')
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    )
  );

CREATE POLICY "Role-scoped leadership actions read"
  ON public.leadership_actions FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('Executive', 'Project Manager', 'Admin')
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    )
  );

CREATE POLICY "PMs and Admins can insert projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('Project Manager', 'Admin'));

CREATE POLICY "PMs, Admins, and scoped Project Owners can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('Project Manager', 'Admin')
    OR (public.current_user_role() = 'Project Owner' AND owner_id = auth.uid())
  )
  WITH CHECK (
    public.current_user_role() IN ('Project Manager', 'Admin')
    OR (public.current_user_role() = 'Project Owner' AND owner_id = auth.uid())
  );

CREATE POLICY "Only Admins can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (public.current_user_role() = 'Admin');

CREATE POLICY "PMs, Admins, and scoped Project Owners can insert risks"
  ON public.risks FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('Project Manager', 'Admin')
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    )
  );

CREATE POLICY "PMs, Admins, and scoped Project Owners can update risks"
  ON public.risks FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('Project Manager', 'Admin')
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('Project Manager', 'Admin')
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    )
  );

CREATE POLICY "Only Admins can delete risks"
  ON public.risks FOR DELETE TO authenticated
  USING (public.current_user_role() = 'Admin');

CREATE POLICY "PMs, Admins, and scoped Project Owners can insert leadership actions"
  ON public.leadership_actions FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('Project Manager', 'Admin')
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    )
  );

CREATE POLICY "PMs, Admins, and scoped Project Owners can update leadership actions"
  ON public.leadership_actions FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('Project Manager', 'Admin')
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('Project Manager', 'Admin')
    OR (
      public.current_user_role() = 'Project Owner'
      AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    )
  );

CREATE POLICY "Only Admins can delete leadership actions"
  ON public.leadership_actions FOR DELETE TO authenticated
  USING (public.current_user_role() = 'Admin');

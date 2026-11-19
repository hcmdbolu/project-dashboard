import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEMO_ACTIONS,
  DEMO_AUDIT_LOGS,
  DEMO_BUDGETS,
  DEMO_CATEGORIES,
  DEMO_DEPARTMENTS,
  DEMO_PROJECTS,
  DEMO_RISKS,
  DEMO_USERS,
} from '../data/demoData';
import {
  computePortfolioKpis,
  computePriorityScore,
  isProjectAssignedToOwner,
} from '../lib/formatters';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  AuditLog,
  BudgetStatus,
  CategoryItem,
  Department,
  DepartmentBudget,
  DepartmentInput,
  LeadershipAction,
  LeadershipActionInput,
  PortfolioKpis,
  Profile,
  Project,
  ProjectInput,
  Risk,
  RiskInput,
  ToastMessage,
} from '../types/portfolio';
import { useAuth } from './AuthContext';

interface PortfolioContextValue {
  departments: Department[];
  categories: CategoryItem[];
  profiles: Profile[];
  budgets: DepartmentBudget[];
  projects: Project[];
  allVisibleProjects: Project[];
  risks: Risk[];
  actions: LeadershipAction[];
  auditLogs: AuditLog[];
  kpis: PortfolioKpis;
  selectedDepartmentId: string | 'ALL';
  setSelectedDepartmentId: (deptId: string | 'ALL') => void;
  activeDepartment: Department | null;
  loading: boolean;
  realtimeConnected: boolean;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  refreshAll: () => Promise<void>;
  getDepartmentName: (departmentId: string | null | undefined) => string;
  getCategoryName: (categoryId: string | null | undefined) => string;
  getProfileName: (profileId: string | null | undefined) => string;
  createCategory: (name: string, departmentId: string | null) => Promise<CategoryItem | null>;
  createDepartment: (input: DepartmentInput) => Promise<boolean>;
  updateDepartment: (id: string, input: Partial<DepartmentInput>) => Promise<boolean>;
  deleteDepartment: (id: string) => Promise<boolean>;
  submitDepartmentBudget: (
    departmentId: string,
    fiscalPeriod: string,
    proposedAmount: number,
    status: 'Draft' | 'Pending Approval',
    reviewNotes?: string
  ) => Promise<boolean>;
  reviewDepartmentBudget: (
    budgetId: string,
    status: Extract<BudgetStatus, 'Approved' | 'Rejected'>,
    approvedAmount: number,
    reviewNotes: string
  ) => Promise<boolean>;
  updateProjectInline: (
    id: string,
    patch: Partial<Pick<Project, 'percent_complete' | 'rag_status' | 'schedule_status'>>
  ) => Promise<boolean>;
  createProject: (input: ProjectInput) => Promise<boolean>;
  updateProject: (id: string, input: Partial<ProjectInput>) => Promise<boolean>;
  bulkImportProjects: (items: ProjectInput[]) => Promise<number>;
  deleteProject: (id: string) => Promise<boolean>;
  createRisk: (input: RiskInput) => Promise<boolean>;
  updateRisk: (id: string, input: Partial<RiskInput>) => Promise<boolean>;
  deleteRisk: (id: string) => Promise<boolean>;
  createAction: (input: LeadershipActionInput) => Promise<boolean>;
  updateAction: (id: string, input: Partial<LeadershipActionInput>) => Promise<boolean>;
  deleteAction: (id: string) => Promise<boolean>;
}

const PortfolioContext = createContext<PortfolioContextValue | undefined>(undefined);

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:4000';

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    session,
    role,
    departmentId,
    isOrgWide,
    isSuperAdmin,
    canCreateProject,
    canProposeBudgets,
    canApproveBudgets,
    canEditProject,
    canDeleteProject,
    profile,
  } = useAuth();

  const [departments, setDepartments] = useState<Department[]>(
    isSupabaseConfigured ? [] : DEMO_DEPARTMENTS
  );
  const [categories, setCategories] = useState<CategoryItem[]>(
    isSupabaseConfigured ? [] : DEMO_CATEGORIES
  );
  const [profiles, setProfiles] = useState<Profile[]>(
    isSupabaseConfigured ? [] : DEMO_USERS
  );
  const [budgets, setBudgets] = useState<DepartmentBudget[]>(
    isSupabaseConfigured ? [] : DEMO_BUDGETS
  );
  const [rawProjects, setRawProjects] = useState<Project[]>(
    isSupabaseConfigured ? [] : DEMO_PROJECTS
  );
  const [rawRisks, setRawRisks] = useState<Risk[]>(
    isSupabaseConfigured ? [] : DEMO_RISKS
  );
  const [rawActions, setRawActions] = useState<LeadershipAction[]>(
    isSupabaseConfigured ? [] : DEMO_ACTIONS
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(
    isSupabaseConfigured ? [] : DEMO_AUDIT_LOGS
  );
  const [selectedDepartmentId, setSelectedDepartmentIdState] = useState<string | 'ALL'>(
    'ALL'
  );
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(
    !isSupabaseConfigured
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Lock selectedDepartmentId for non-org-wide roles
  useEffect(() => {
    if (!isOrgWide && departmentId) {
      setSelectedDepartmentIdState(departmentId);
    } else if (isOrgWide) {
      setSelectedDepartmentIdState('ALL');
    }
  }, [departmentId, isOrgWide]);

  const setSelectedDepartmentId = useCallback(
    (deptId: string | 'ALL') => {
      if (!isOrgWide && departmentId) {
        setSelectedDepartmentIdState(departmentId);
        return;
      }
      setSelectedDepartmentIdState(deptId);
    },
    [departmentId, isOrgWide]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const refreshAll = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    if (!session) {
      setDepartments([]);
      setCategories([]);
      setProfiles([]);
      setBudgets([]);
      setRawProjects([]);
      setRawRisks([]);
      setRawActions([]);
      setAuditLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [deptRes, catRes, profRes, budRes, projRes, riskRes, actionRes, auditRes] =
      await Promise.all([
        supabase.from('departments').select('*').order('name', { ascending: true }),
        supabase.from('categories').select('*').order('name', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, email, role, department_id, campus')
          .order('full_name', { ascending: true }),
        supabase
          .from('department_budgets')
          .select('*')
          .order('updated_at', { ascending: false }),
        supabase
          .from('projects')
          .select('*')
          .order('priority_score', { ascending: false }),
        supabase.from('risks').select('*').order('created_at', { ascending: false }),
        supabase
          .from('leadership_actions')
          .select('*')
          .order('due_date', { ascending: true }),
        supabase
          .from('audit_logs')
          .select('*')
          .order('changed_at', { ascending: false })
          .limit(200),
      ]);

    const firstError =
      deptRes.error ||
      catRes.error ||
      profRes.error ||
      budRes.error ||
      projRes.error ||
      riskRes.error ||
      actionRes.error;

    if (firstError) {
      pushToast({
        type: 'error',
        title: 'Failed to load portfolio data',
        message: firstError.message,
      });
    } else {
      setDepartments((deptRes.data ?? []) as Department[]);
      setCategories((catRes.data ?? []) as CategoryItem[]);
      setProfiles((profRes.data ?? []) as Profile[]);
      setBudgets((budRes.data ?? []) as DepartmentBudget[]);
      setRawProjects((projRes.data ?? []) as Project[]);
      setRawRisks((riskRes.data ?? []) as Risk[]);
      setRawActions((actionRes.data ?? []) as LeadershipAction[]);
      setAuditLogs((auditRes.data ?? []) as AuditLog[]);
    }
    setLoading(false);
  }, [pushToast, session]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client || !session) return;

    const channel = client
      .channel('gsl-enterprise-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, () =>
        refreshAll()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () =>
        refreshAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'department_budgets' },
        () => refreshAll()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () =>
        refreshAll()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'risks' }, () =>
        refreshAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leadership_actions' },
        () => refreshAll()
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      client.removeChannel(channel);
    };
  }, [refreshAll, session]);

  const deptMap = useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments]
  );
  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const profMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const getDepartmentName = useCallback(
    (id: string | null | undefined) => (id ? deptMap.get(id)?.name ?? '—' : 'All Departments'),
    [deptMap]
  );
  const getCategoryName = useCallback(
    (id: string | null | undefined) => (id ? catMap.get(id)?.name ?? 'Uncategorized' : 'Uncategorized'),
    [catMap]
  );
  const getProfileName = useCallback(
    (id: string | null | undefined) => (id ? profMap.get(id)?.full_name ?? 'Unassigned' : 'Unassigned'),
    [profMap]
  );

  // Hydrate display labels onto projects
  const hydratedProjects = useMemo(() => {
    return rawProjects.map((p) => ({
      ...p,
      category: getCategoryName(p.category_id),
      project_manager_name: getProfileName(p.project_manager_id),
      owner_name: getProfileName(p.owner_id),
    }));
  }, [getCategoryName, getProfileName, rawProjects]);

  // Role-based visibility (before global Department Selector filter)
  const allVisibleProjects = useMemo(() => {
    if (isOrgWide) return hydratedProjects;
    if (role === 'Department Admin' || role === 'Project Manager') {
      return hydratedProjects.filter((p) => p.department_id === departmentId);
    }
    // Project Owner: strictly within their department AND assigned to them
    return hydratedProjects.filter(
      (p) => p.department_id === departmentId && isProjectAssignedToOwner(p, profile)
    );
  }, [departmentId, hydratedProjects, isOrgWide, profile, role]);

  // Apply Department Selector filter for Super Admin / Executive
  const visibleProjects = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return allVisibleProjects;
    return allVisibleProjects.filter((p) => p.department_id === selectedDepartmentId);
  }, [allVisibleProjects, selectedDepartmentId]);

  const visibleProjectIds = useMemo(
    () => new Set(visibleProjects.map((p) => p.id)),
    [visibleProjects]
  );

  const visibleRisks = useMemo(
    () => rawRisks.filter((r) => visibleProjectIds.has(r.project_id)),
    [rawRisks, visibleProjectIds]
  );

  const visibleActions = useMemo(
    () => rawActions.filter((a) => visibleProjectIds.has(a.project_id)),
    [rawActions, visibleProjectIds]
  );

  const visibleBudgets = useMemo(() => {
    const roleScoped = isOrgWide
      ? budgets
      : budgets.filter((b) => b.department_id === departmentId);
    if (selectedDepartmentId === 'ALL') return roleScoped;
    return roleScoped.filter((b) => b.department_id === selectedDepartmentId);
  }, [budgets, departmentId, isOrgWide, selectedDepartmentId]);

  const kpis = useMemo<PortfolioKpis>(
    () => computePortfolioKpis(visibleProjects, visibleRisks, visibleActions, visibleBudgets),
    [visibleActions, visibleBudgets, visibleProjects, visibleRisks]
  );

  const activeDepartment = useMemo(() => {
    if (selectedDepartmentId !== 'ALL') {
      return deptMap.get(selectedDepartmentId) ?? null;
    }
    if (!isOrgWide && departmentId) {
      return deptMap.get(departmentId) ?? null;
    }
    return null;
  }, [departmentId, deptMap, isOrgWide, selectedDepartmentId]);

  const recordDemoAudit = useCallback(
    (projectId: string, fieldName: string, oldVal: unknown, newVal: unknown) => {
      if (String(oldVal ?? '') === String(newVal ?? '')) return;
      setAuditLogs((curr) => [
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          project_id: projectId,
          changed_by: profile?.id ?? null,
          field_name: fieldName,
          old_value: oldVal == null ? null : String(oldVal),
          new_value: newVal == null ? null : String(newVal),
          changed_at: new Date().toISOString(),
        },
        ...curr,
      ]);
    },
    [profile?.id]
  );

  const assertProjectEdit = useCallback(
    (projectId: string): Project | null => {
      const target = rawProjects.find((p) => p.id === projectId);
      if (!target || !canEditProject(target)) {
        pushToast({
          type: 'error',
          title: 'Permission denied',
          message: 'You do not have edit permissions on this project.',
        });
        return null;
      }
      return target;
    },
    [canEditProject, pushToast, rawProjects]
  );

  const createCategory = useCallback(
    async (name: string, deptId: string | null): Promise<CategoryItem | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;

      const existing = categories.find(
        (c) =>
          c.name.toLowerCase() === trimmed.toLowerCase() &&
          (c.department_id === deptId || c.department_id === null)
      );
      if (existing) return existing;

      if (!canCreateProject) {
        pushToast({ type: 'error', title: 'Permission denied' });
        return null;
      }

      if (!isSupabaseConfigured || !supabase) {
        const created: CategoryItem = {
          id: `cat-${Date.now()}`,
          name: trimmed,
          department_id: deptId,
          created_by: profile?.id ?? null,
        };
        setCategories((curr) => [...curr, created].sort((a, b) => a.name.localeCompare(b.name)));
        pushToast({ type: 'success', title: `Category "${trimmed}" added` });
        return created;
      }

      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: trimmed,
          department_id: deptId,
          created_by: profile?.id ?? null,
        })
        .select('*')
        .single();

      if (error) {
        pushToast({ type: 'error', title: 'Could not add category', message: error.message });
        return null;
      }

      const created = data as CategoryItem;
      setCategories((curr) => [...curr, created].sort((a, b) => a.name.localeCompare(b.name)));
      pushToast({ type: 'success', title: `Category "${trimmed}" added` });
      return created;
    },
    [canCreateProject, categories, profile?.id, pushToast]
  );

  const createDepartment = useCallback(
    async (input: DepartmentInput): Promise<boolean> => {
      if (!isSuperAdmin) {
        pushToast({ type: 'error', title: 'Super Admin access required' });
        return false;
      }
      if (!isSupabaseConfigured || !supabase) {
        const created: Department = {
          id: `dept-${Date.now()}`,
          name: input.name.trim(),
          code: input.code.trim().toUpperCase(),
          description: input.description.trim(),
        };
        setDepartments((curr) => [...curr, created]);
        pushToast({ type: 'success', title: 'Department created' });
        return true;
      }

      const res = await fetch(`${API_BASE_URL}/api/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast({ type: 'error', title: 'Create failed', message: data.error });
        return false;
      }
      setDepartments((curr) => [...curr, data.department]);
      pushToast({ type: 'success', title: 'Department created' });
      return true;
    },
    [isSuperAdmin, pushToast, session?.access_token]
  );

  const updateDepartment = useCallback(
    async (id: string, input: Partial<DepartmentInput>): Promise<boolean> => {
      if (!isSuperAdmin) return false;
      if (!isSupabaseConfigured || !supabase) {
        setDepartments((curr) =>
          curr.map((d) => (d.id === id ? { ...d, ...input } : d))
        );
        pushToast({ type: 'success', title: 'Department updated' });
        return true;
      }
      const res = await fetch(`${API_BASE_URL}/api/departments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast({ type: 'error', title: 'Update failed', message: data.error });
        return false;
      }
      setDepartments((curr) => curr.map((d) => (d.id === id ? data.department : d)));
      pushToast({ type: 'success', title: 'Department updated' });
      return true;
    },
    [isSuperAdmin, pushToast, session?.access_token]
  );

  const deleteDepartment = useCallback(
    async (id: string): Promise<boolean> => {
      if (!isSuperAdmin) return false;
      if (!isSupabaseConfigured || !supabase) {
        if (rawProjects.some((p) => p.department_id === id)) {
          pushToast({
            type: 'error',
            title: 'Cannot delete department',
            message: 'Reassign or remove projects in this department first.',
          });
          return false;
        }
        setDepartments((curr) => curr.filter((d) => d.id !== id));
        pushToast({ type: 'success', title: 'Department deleted' });
        return true;
      }
      const res = await fetch(`${API_BASE_URL}/api/departments/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast({ type: 'error', title: 'Delete failed', message: data.error });
        return false;
      }
      setDepartments((curr) => curr.filter((d) => d.id !== id));
      pushToast({ type: 'success', title: 'Department deleted' });
      return true;
    },
    [isSuperAdmin, pushToast, rawProjects, session?.access_token]
  );

  const submitDepartmentBudget = useCallback(
    async (
      targetDeptId: string,
      fiscalPeriod: string,
      proposedAmount: number,
      status: 'Draft' | 'Pending Approval',
      reviewNotes = ''
    ): Promise<boolean> => {
      if (!canProposeBudgets) {
        pushToast({ type: 'error', title: 'Permission denied' });
        return false;
      }
      if (!isSupabaseConfigured || !supabase) {
        setBudgets((curr) => {
          const existing = curr.find(
            (b) => b.department_id === targetDeptId && b.fiscal_period === fiscalPeriod
          );
          if (existing) {
            return curr.map((b) =>
              b.id === existing.id
                ? {
                    ...b,
                    proposed_amount: proposedAmount,
                    status,
                    review_notes: reviewNotes,
                    submitted_by: profile?.id ?? null,
                  }
                : b
            );
          }
          return [
            {
              id: `bud-${Date.now()}`,
              department_id: targetDeptId,
              fiscal_period: fiscalPeriod,
              proposed_amount: proposedAmount,
              approved_amount: 0,
              status,
              submitted_by: profile?.id ?? null,
              approved_by: null,
              review_notes: reviewNotes,
            },
            ...curr,
          ];
        });
        pushToast({
          type: 'success',
          title: status === 'Pending Approval' ? 'Budget submitted for approval' : 'Draft saved',
        });
        return true;
      }

      const { data, error } = await supabase
        .from('department_budgets')
        .upsert(
          {
            department_id: targetDeptId,
            fiscal_period: fiscalPeriod,
            proposed_amount: proposedAmount,
            status,
            submitted_by: profile?.id ?? null,
            review_notes: reviewNotes,
          },
          { onConflict: 'department_id,fiscal_period' }
        )
        .select('*')
        .single();

      if (error) {
        pushToast({ type: 'error', title: 'Budget submission failed', message: error.message });
        return false;
      }

      setBudgets((curr) => {
        const rest = curr.filter((b) => b.id !== data.id);
        return [data as DepartmentBudget, ...rest];
      });
      pushToast({
        type: 'success',
        title: status === 'Pending Approval' ? 'Budget submitted for approval' : 'Draft saved',
      });
      return true;
    },
    [canProposeBudgets, profile?.id, pushToast]
  );

  const reviewDepartmentBudget = useCallback(
    async (
      budgetId: string,
      status: Extract<BudgetStatus, 'Approved' | 'Rejected'>,
      approvedAmount: number,
      reviewNotes: string
    ): Promise<boolean> => {
      if (!canApproveBudgets) {
        pushToast({ type: 'error', title: 'Super Admin approval required' });
        return false;
      }
      if (!isSupabaseConfigured || !supabase) {
        setBudgets((curr) =>
          curr.map((b) =>
            b.id === budgetId
              ? {
                  ...b,
                  status,
                  approved_amount: status === 'Approved' ? approvedAmount : 0,
                  approved_by: profile?.id ?? null,
                  review_notes: reviewNotes,
                }
              : b
          )
        );
        pushToast({ type: 'success', title: `Department budget ${status.toLowerCase()}` });
        return true;
      }

      const { data, error } = await supabase
        .from('department_budgets')
        .update({
          status,
          approved_amount: status === 'Approved' ? approvedAmount : 0,
          approved_by: profile?.id ?? null,
          review_notes: reviewNotes,
        })
        .eq('id', budgetId)
        .select('*')
        .single();

      if (error) {
        pushToast({ type: 'error', title: 'Review failed', message: error.message });
        return false;
      }
      setBudgets((curr) => curr.map((b) => (b.id === budgetId ? (data as DepartmentBudget) : b)));
      pushToast({ type: 'success', title: `Department budget ${status.toLowerCase()}` });
      return true;
    },
    [canApproveBudgets, profile?.id, pushToast]
  );

  const updateProjectInline = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Project, 'percent_complete' | 'rag_status' | 'schedule_status'>>
    ): Promise<boolean> => {
      const target = assertProjectEdit(id);
      if (!target) return false;

      const previous = rawProjects;
      const sanitizedPatch: Partial<Project> = { ...patch };
      if (typeof sanitizedPatch.percent_complete === 'number') {
        sanitizedPatch.percent_complete = Math.max(
          0,
          Math.min(100, Math.round(sanitizedPatch.percent_complete))
        );
      }

      setRawProjects((curr) =>
        curr.map((p) => (p.id === id ? { ...p, ...sanitizedPatch } : p))
      );

      if (!isSupabaseConfigured || !supabase) {
        if (sanitizedPatch.percent_complete !== undefined) {
          recordDemoAudit(id, 'percent_complete', target.percent_complete, sanitizedPatch.percent_complete);
        }
        if (sanitizedPatch.rag_status !== undefined) {
          recordDemoAudit(id, 'rag_status', target.rag_status, sanitizedPatch.rag_status);
        }
        pushToast({ type: 'success', title: 'Project updated', message: 'Saved in demo mode.' });
        return true;
      }

      const { error } = await supabase
        .from('projects')
        .update({
          ...sanitizedPatch,
          updated_by: profile?.id ?? null,
        })
        .eq('id', id);

      if (error) {
        setRawProjects(previous);
        pushToast({ type: 'error', title: 'Update rejected', message: error.message });
        return false;
      }

      pushToast({ type: 'success', title: 'Project updated' });
      return true;
    },
    [assertProjectEdit, profile?.id, pushToast, rawProjects, recordDemoAudit]
  );

  const generateNextDemoProjectCode = useCallback((existing: Project[]): string => {
    const maxNum = existing.reduce((max, p) => {
      const match = /GSL-PROJECT-(\d+)/i.exec(p.project_code);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `GSL-PROJECT-${String(maxNum + 1).padStart(3, '0')}`;
  }, []);

  const createProject = useCallback(
    async (input: ProjectInput): Promise<boolean> => {
      if (!canCreateProject) {
        pushToast({ type: 'error', title: 'Permission denied' });
        return false;
      }

      if (!isSupabaseConfigured || !supabase) {
        const nextCode = generateNextDemoProjectCode(rawProjects);
        const created: Project = {
          ...input,
          id: `demo-${Date.now()}`,
          project_code: nextCode,
          priority_score: computePriorityScore(
            input.business_impact,
            input.risk_level,
            input.urgency,
            input.strategic_importance
          ),
        };
        setRawProjects((curr) => [created, ...curr]);
        pushToast({ type: 'success', title: 'Project created', message: nextCode });
        return true;
      }

      const { project_code: _omit, ...insertPayload } = input;
      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...insertPayload,
          project_code: '',
          created_by: profile?.id ?? null,
          updated_by: profile?.id ?? null,
        })
        .select('*')
        .single();

      if (error) {
        pushToast({ type: 'error', title: 'Create failed', message: error.message });
        return false;
      }

      const created = data as Project;
      setRawProjects((curr) => [created, ...curr]);
      pushToast({ type: 'success', title: 'Project created', message: created.project_code });
      return true;
    },
    [canCreateProject, generateNextDemoProjectCode, profile?.id, pushToast, rawProjects]
  );

  const updateProject = useCallback(
    async (id: string, input: Partial<ProjectInput>): Promise<boolean> => {
      const target = assertProjectEdit(id);
      if (!target) return false;

      if (!isSupabaseConfigured || !supabase) {
        setRawProjects((curr) =>
          curr.map((p) => {
            if (p.id !== id) return p;
            const merged = { ...p, ...input };
            return {
              ...merged,
              priority_score: computePriorityScore(
                merged.business_impact,
                merged.risk_level,
                merged.urgency,
                merged.strategic_importance
              ),
            };
          })
        );
        if (input.approved_budget !== undefined) {
          recordDemoAudit(id, 'approved_budget', target.approved_budget, input.approved_budget);
        }
        if (input.actual_spend !== undefined) {
          recordDemoAudit(id, 'actual_spend', target.actual_spend, input.actual_spend);
        }
        pushToast({ type: 'success', title: 'Project saved' });
        return true;
      }

      const { project_code: _omit, ...safeInput } = input;
      const { data, error } = await supabase
        .from('projects')
        .update({
          ...safeInput,
          updated_by: profile?.id ?? null,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        pushToast({ type: 'error', title: 'Save failed', message: error.message });
        return false;
      }

      setRawProjects((curr) => curr.map((p) => (p.id === id ? (data as Project) : p)));
      pushToast({ type: 'success', title: 'Project saved' });
      return true;
    },
    [assertProjectEdit, profile?.id, pushToast, recordDemoAudit]
  );

  const bulkImportProjects = useCallback(
    async (items: ProjectInput[]): Promise<number> => {
      if (!canCreateProject) {
        pushToast({ type: 'error', title: 'Permission denied' });
        return 0;
      }
      if (items.length === 0) return 0;

      if (!isSupabaseConfigured || !supabase) {
        setRawProjects((curr) => {
          let nextList = [...curr];
          items.forEach((item, idx) => {
            const existingIdx = item.project_code
              ? nextList.findIndex((p) => p.project_code === item.project_code)
              : -1;
            const code =
              existingIdx >= 0
                ? nextList[existingIdx].project_code
                : item.project_code?.trim() || generateNextDemoProjectCode(nextList);

            const built: Project = {
              ...(existingIdx >= 0
                ? nextList[existingIdx]
                : { id: `import-${Date.now()}-${idx}` }),
              ...item,
              project_code: code,
              priority_score: computePriorityScore(
                item.business_impact,
                item.risk_level,
                item.urgency,
                item.strategic_importance
              ),
            };
            if (existingIdx >= 0) {
              nextList[existingIdx] = built;
            } else {
              nextList = [built, ...nextList];
            }
          });
          return nextList;
        });
        pushToast({
          type: 'success',
          title: 'Excel import complete',
          message: `Imported ${items.length} projects in demo mode.`,
        });
        return items.length;
      }

      let importedCount = 0;
      for (const item of items) {
        const hasCode = Boolean(item.project_code && item.project_code.trim() !== '');
        if (hasCode) {
          const { error } = await supabase
            .from('projects')
            .upsert(
              { ...item, updated_by: profile?.id ?? null },
              { onConflict: 'project_code' }
            );
          if (error) {
            pushToast({ type: 'error', title: 'Excel import error', message: error.message });
            return importedCount;
          }
        } else {
          const { project_code: _omit, ...rest } = item;
          const { error } = await supabase.from('projects').insert({
            ...rest,
            project_code: '',
            created_by: profile?.id ?? null,
            updated_by: profile?.id ?? null,
          });
          if (error) {
            pushToast({ type: 'error', title: 'Excel import error', message: error.message });
            return importedCount;
          }
        }
        importedCount += 1;
      }

      await refreshAll();
      pushToast({
        type: 'success',
        title: 'Excel import complete',
        message: `${importedCount} project records imported.`,
      });
      return importedCount;
    },
    [canCreateProject, generateNextDemoProjectCode, profile?.id, pushToast, refreshAll]
  );

  const deleteProject = useCallback(
    async (id: string): Promise<boolean> => {
      const target = rawProjects.find((p) => p.id === id);
      if (!target || !canDeleteProject(target)) {
        pushToast({ type: 'error', title: 'Permission denied' });
        return false;
      }

      if (!isSupabaseConfigured || !supabase) {
        setRawProjects((curr) => curr.filter((p) => p.id !== id));
        setRawRisks((curr) => curr.filter((r) => r.project_id !== id));
        setRawActions((curr) => curr.filter((a) => a.project_id !== id));
        pushToast({ type: 'success', title: 'Project deleted' });
        return true;
      }

      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) {
        pushToast({ type: 'error', title: 'Delete failed', message: error.message });
        return false;
      }

      setRawProjects((curr) => curr.filter((p) => p.id !== id));
      pushToast({ type: 'success', title: 'Project deleted' });
      return true;
    },
    [canDeleteProject, pushToast, rawProjects]
  );

  const createRisk = useCallback(
    async (input: RiskInput): Promise<boolean> => {
      const parent = assertProjectEdit(input.project_id);
      if (!parent) return false;

      if (!isSupabaseConfigured || !supabase) {
        setRawRisks((curr) => [
          { ...input, id: `r-${Date.now()}`, department_id: parent.department_id },
          ...curr,
        ]);
        pushToast({ type: 'success', title: 'Risk logged' });
        return true;
      }
      const { data, error } = await supabase
        .from('risks')
        .insert({ ...input, department_id: parent.department_id })
        .select('*')
        .single();
      if (error) {
        pushToast({ type: 'error', title: 'Failed to log risk', message: error.message });
        return false;
      }
      setRawRisks((curr) => [data as Risk, ...curr]);
      pushToast({ type: 'success', title: 'Risk logged' });
      return true;
    },
    [assertProjectEdit, pushToast]
  );

  const updateRisk = useCallback(
    async (id: string, input: Partial<RiskInput>): Promise<boolean> => {
      const existing = rawRisks.find((r) => r.id === id);
      if (!existing || !assertProjectEdit(existing.project_id)) return false;

      if (!isSupabaseConfigured || !supabase) {
        setRawRisks((curr) => curr.map((r) => (r.id === id ? { ...r, ...input } : r)));
        pushToast({ type: 'success', title: 'Risk updated' });
        return true;
      }
      const { data, error } = await supabase
        .from('risks')
        .update(input)
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        pushToast({ type: 'error', title: 'Failed to update risk', message: error.message });
        return false;
      }
      setRawRisks((curr) => curr.map((r) => (r.id === id ? (data as Risk) : r)));
      pushToast({ type: 'success', title: 'Risk updated' });
      return true;
    },
    [assertProjectEdit, pushToast, rawRisks]
  );

  const deleteRisk = useCallback(
    async (id: string): Promise<boolean> => {
      const existing = rawRisks.find((r) => r.id === id);
      if (!existing || !canDeleteProject({ department_id: existing.department_id })) {
        pushToast({ type: 'error', title: 'Permission denied' });
        return false;
      }
      if (!isSupabaseConfigured || !supabase) {
        setRawRisks((curr) => curr.filter((r) => r.id !== id));
        pushToast({ type: 'success', title: 'Risk deleted' });
        return true;
      }
      const { error } = await supabase.from('risks').delete().eq('id', id);
      if (error) {
        pushToast({ type: 'error', title: 'Delete failed', message: error.message });
        return false;
      }
      setRawRisks((curr) => curr.filter((r) => r.id !== id));
      pushToast({ type: 'success', title: 'Risk deleted' });
      return true;
    },
    [canDeleteProject, pushToast, rawRisks]
  );

  const createAction = useCallback(
    async (input: LeadershipActionInput): Promise<boolean> => {
      const parent = assertProjectEdit(input.project_id);
      if (!parent) return false;

      if (!isSupabaseConfigured || !supabase) {
        setRawActions((curr) => [
          { ...input, id: `a-${Date.now()}`, department_id: parent.department_id },
          ...curr,
        ]);
        pushToast({ type: 'success', title: 'Leadership action created' });
        return true;
      }
      const { data, error } = await supabase
        .from('leadership_actions')
        .insert({ ...input, department_id: parent.department_id })
        .select('*')
        .single();
      if (error) {
        pushToast({ type: 'error', title: 'Failed to create action', message: error.message });
        return false;
      }
      setRawActions((curr) => [...curr, data as LeadershipAction]);
      pushToast({ type: 'success', title: 'Leadership action created' });
      return true;
    },
    [assertProjectEdit, pushToast]
  );

  const updateAction = useCallback(
    async (id: string, input: Partial<LeadershipActionInput>): Promise<boolean> => {
      const existing = rawActions.find((a) => a.id === id);
      if (!existing || !assertProjectEdit(existing.project_id)) return false;

      if (!isSupabaseConfigured || !supabase) {
        setRawActions((curr) => curr.map((a) => (a.id === id ? { ...a, ...input } : a)));
        pushToast({ type: 'success', title: 'Leadership action updated' });
        return true;
      }
      const { data, error } = await supabase
        .from('leadership_actions')
        .update(input)
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        pushToast({ type: 'error', title: 'Failed to update action', message: error.message });
        return false;
      }
      setRawActions((curr) =>
        curr.map((a) => (a.id === id ? (data as LeadershipAction) : a))
      );
      pushToast({ type: 'success', title: 'Leadership action updated' });
      return true;
    },
    [assertProjectEdit, pushToast, rawActions]
  );

  const deleteAction = useCallback(
    async (id: string): Promise<boolean> => {
      const existing = rawActions.find((a) => a.id === id);
      if (!existing || !canDeleteProject({ department_id: existing.department_id })) {
        pushToast({ type: 'error', title: 'Permission denied' });
        return false;
      }
      if (!isSupabaseConfigured || !supabase) {
        setRawActions((curr) => curr.filter((a) => a.id !== id));
        pushToast({ type: 'success', title: 'Leadership action deleted' });
        return true;
      }
      const { error } = await supabase.from('leadership_actions').delete().eq('id', id);
      if (error) {
        pushToast({ type: 'error', title: 'Delete failed', message: error.message });
        return false;
      }
      setRawActions((curr) => curr.filter((a) => a.id !== id));
      pushToast({ type: 'success', title: 'Leadership action deleted' });
      return true;
    },
    [canDeleteProject, pushToast, rawActions]
  );

  return (
    <PortfolioContext.Provider
      value={{
        departments,
        categories,
        profiles,
        budgets: visibleBudgets,
        projects: visibleProjects,
        allVisibleProjects,
        risks: visibleRisks,
        actions: visibleActions,
        auditLogs,
        kpis,
        selectedDepartmentId,
        setSelectedDepartmentId,
        activeDepartment,
        loading,
        realtimeConnected,
        toasts,
        dismissToast,
        pushToast,
        refreshAll,
        getDepartmentName,
        getCategoryName,
        getProfileName,
        createCategory,
        createDepartment,
        updateDepartment,
        deleteDepartment,
        submitDepartmentBudget,
        reviewDepartmentBudget,
        updateProjectInline,
        createProject,
        updateProject,
        bulkImportProjects,
        deleteProject,
        createRisk,
        updateRisk,
        deleteRisk,
        createAction,
        updateAction,
        deleteAction,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
};

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return ctx;
}

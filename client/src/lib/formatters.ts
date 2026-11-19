import {
  ActionStatus,
  BudgetStatus,
  DepartmentBudget,
  LeadershipAction,
  PortfolioKpis,
  ProcurementStatus,
  Profile,
  Project,
  RagStatus,
  Risk,
  RiskSeverity,
  RiskStatus,
  ScheduleStatus,
} from '../types/portfolio';

const CURRENCY_CODE = (import.meta.env.VITE_CURRENCY_CODE as string | undefined) || 'NGN';

export function formatCurrency(amount: number, compact = false): string {
  const safeValue = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: CURRENCY_CODE,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
    }).format(safeValue);
  } catch {
    return `${CURRENCY_CODE} ${safeValue.toLocaleString()}`;
  }
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  const parsed = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function isPastDue(dateString?: string | null): boolean {
  if (!dateString) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateString < today;
}

export function isProjectBehindSchedule(project: Project): boolean {
  if (project.rag_status === 'Blue' || project.schedule_status === 'Completed') {
    return false;
  }
  return project.schedule_status === 'Behind Schedule' || isPastDue(project.target_end_date);
}

export function hasUnconfirmedOwnership(project: Project): boolean {
  if (!project.owner_id || !project.project_manager_id) return true;
  const fields = [project.technical_lead_name, project.approval_authority];
  return fields.some((f) => {
    const normalized = (f || '').trim().toLowerCase();
    return normalized === '' || normalized === 'confirm' || normalized === 'tbd';
  });
}

export function computePriorityScore(
  businessImpact: number,
  riskLevel: number,
  urgency: number,
  strategicImportance: number
): number {
  const weighted =
    Number(businessImpact) * 0.35 +
    Number(strategicImportance) * 0.3 +
    Number(urgency) * 0.2 +
    Number(riskLevel) * 0.15;
  return Math.round(weighted * 100) / 100;
}

export function isProjectAssignedToOwner(
  project: Pick<Project, 'owner_id'>,
  profile: Pick<Profile, 'id'> | null | undefined
): boolean {
  if (!profile) return false;
  return Boolean(project.owner_id && project.owner_id === profile.id);
}

export function computePortfolioKpis(
  projects: Project[],
  risks: Risk[],
  actions: LeadershipAction[],
  budgets: DepartmentBudget[] = []
): PortfolioKpis {
  const totalProjects = projects.length;
  const completedProjects = projects.filter(
    (p) =>
      p.rag_status === 'Blue' ||
      p.schedule_status === 'Completed' ||
      p.percent_complete >= 100
  ).length;
  const onTrackProjects = projects.filter((p) => p.rag_status === 'Green').length;
  const attentionNeededProjects = projects.filter((p) => p.rag_status === 'Amber').length;
  const criticalProjects = projects.filter((p) => p.rag_status === 'Red').length;
  const behindScheduleProjects = projects.filter(isProjectBehindSchedule).length;
  const avgPercentComplete =
    totalProjects > 0
      ? Math.round(
          projects.reduce((acc, p) => acc + Number(p.percent_complete || 0), 0) /
            totalProjects
        )
      : 0;

  const departmentBudgetCeiling = budgets
    .filter((b) => b.status === 'Approved')
    .reduce((acc, b) => acc + Number(b.approved_amount || 0), 0);

  const allocatedBudget = projects.reduce(
    (acc, p) => acc + Number(p.approved_budget || 0),
    0
  );
  const totalActualSpend = projects.reduce(
    (acc, p) => acc + Number(p.actual_spend || 0),
    0
  );
  const remainingBudget = allocatedBudget - totalActualSpend;

  const openRisks = risks.filter((r) => r.status !== 'Closed').length;
  const openHighCriticalRisks = risks.filter(
    (r) =>
      r.status !== 'Closed' && (r.severity === 'Critical' || r.severity === 'High')
  ).length;
  const openLeadershipActions = actions.filter((a) => a.status !== 'Closed').length;
  const overdueLeadershipActions = actions.filter(
    (a) => a.status === 'Overdue' || (a.status !== 'Closed' && isPastDue(a.due_date))
  ).length;

  return {
    totalProjects,
    completedProjects,
    onTrackProjects,
    attentionNeededProjects,
    criticalProjects,
    behindScheduleProjects,
    avgPercentComplete,
    departmentBudgetCeiling,
    allocatedBudget,
    totalActualSpend,
    remainingBudget,
    openRisks,
    openHighCriticalRisks,
    openLeadershipActions,
    overdueLeadershipActions,
  };
}

export const RAG_COLORS: Record<
  RagStatus,
  { hex: string; pill: string; dot: string; label: string }
> = {
  Green: {
    hex: '#16a34a',
    pill: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
    label: 'On Track',
  },
  Amber: {
    hex: '#d97706',
    pill: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Attention Needed',
  },
  Red: {
    hex: '#dc2626',
    pill: 'bg-red-50 text-red-800 border-red-200',
    dot: 'bg-red-600',
    label: 'Critical / At Risk',
  },
  Blue: {
    hex: '#2563eb',
    pill: 'bg-blue-50 text-blue-800 border-blue-200',
    dot: 'bg-blue-600',
    label: 'Completed',
  },
};

export function getRagLabel(status: RagStatus): string {
  return RAG_COLORS[status]?.label ?? status;
}

export const BUDGET_STATUS_STYLES: Record<BudgetStatus, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  'Pending Approval': 'bg-amber-50 text-amber-800 border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
};

export const SCHEDULE_STYLES: Record<ScheduleStatus, string> = {
  'On Schedule': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Behind Schedule': 'bg-red-50 text-red-700 border-red-200',
  Completed: 'bg-blue-50 text-blue-700 border-blue-200',
  'Not Started': 'bg-slate-100 text-slate-600 border-slate-200',
};

export const PROCUREMENT_STYLES: Record<ProcurementStatus, string> = {
  'Not Started': 'bg-slate-100 text-slate-600 border-slate-200',
  'RFQ / Tendering': 'bg-amber-50 text-amber-800 border-amber-200',
  'Vendor Selected': 'bg-indigo-50 text-indigo-800 border-indigo-200',
  'PO Issued': 'bg-blue-50 text-blue-800 border-blue-200',
  Delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'N/A': 'bg-slate-50 text-slate-500 border-slate-200',
};

export const SEVERITY_STYLES: Record<RiskSeverity, string> = {
  Critical: 'bg-red-100 text-red-800 border-red-300',
  High: 'bg-orange-100 text-orange-800 border-orange-300',
  Medium: 'bg-amber-50 text-amber-800 border-amber-200',
  Low: 'bg-slate-100 text-slate-700 border-slate-300',
};

export const RISK_STATUS_STYLES: Record<RiskStatus, string> = {
  Open: 'bg-red-50 text-red-700 border-red-200',
  Mitigated: 'bg-amber-50 text-amber-700 border-amber-200',
  Closed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const ACTION_STATUS_STYLES: Record<ActionStatus, string> = {
  Overdue: 'bg-red-100 text-red-800 border-red-300',
  'Pending Decision': 'bg-amber-50 text-amber-800 border-amber-200',
  'In Review': 'bg-blue-50 text-blue-800 border-blue-200',
  Closed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const CAMPUSES = ['Lekki', 'Ikoyi', 'Anthos', 'Anthony', 'All Campuses'] as const;
export const RAG_STATUSES = ['Green', 'Amber', 'Red', 'Blue'] as const;
export const SCHEDULE_STATUSES = [
  'On Schedule',
  'Behind Schedule',
  'Completed',
  'Not Started',
] as const;
export const PROCUREMENT_STATUSES = [
  'Not Started',
  'RFQ / Tendering',
  'Vendor Selected',
  'PO Issued',
  'Delivered',
  'N/A',
] as const;
export const APP_ROLES = [
  'Super Admin',
  'Executive',
  'Department Admin',
  'Project Manager',
  'Project Owner',
] as const;

export const DEPT_ADMIN_ASSIGNABLE_ROLES = [
  'Department Admin',
  'Project Manager',
  'Project Owner',
] as const;

export const GOVERNANCE_META = {
  organization: 'Greensprings School (GSL)',
  version: 'v3.0',
  owner: 'Portfolio Governance Office',
  reviewDate: '19 Nov 2026',
  cadence: [
    { label: 'Weekly Operational Review', detail: 'Every Tuesday • Dept Leads & PMs' },
    { label: 'Monthly Executive Review', detail: '1st Wednesday • Heads of School & CFO' },
    { label: 'Quarterly Portfolio Review', detail: 'End of Term • GSL Executive Board' },
  ],
};

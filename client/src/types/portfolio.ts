export type Campus = 'Lekki' | 'Ikoyi' | 'Anthos' | 'Anthony' | 'All Campuses';

export type ScheduleStatus =
  | 'On Schedule'
  | 'Behind Schedule'
  | 'Completed'
  | 'Not Started';

export type RagStatus = 'Green' | 'Amber' | 'Red' | 'Blue';

export type ProcurementStatus =
  | 'Not Started'
  | 'RFQ / Tendering'
  | 'Vendor Selected'
  | 'PO Issued'
  | 'Delivered'
  | 'N/A';

export type BudgetStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected';

export type RiskSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export type RiskStatus = 'Open' | 'Mitigated' | 'Closed';

export type ActionStatus = 'Pending Decision' | 'Overdue' | 'In Review' | 'Closed';

export type AppRole =
  | 'Super Admin'
  | 'Executive'
  | 'Department Admin'
  | 'Project Manager'
  | 'Project Owner';

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  created_at?: string;
}

export interface DepartmentInput {
  name: string;
  code: string;
  description: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  department_id: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  department_id: string | null;
  campus: Campus;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentBudget {
  id: string;
  department_id: string;
  fiscal_period: string;
  proposed_amount: number;
  approved_amount: number;
  status: BudgetStatus;
  submitted_by?: string | null;
  approved_by?: string | null;
  review_notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  project_code: string;
  department_id: string;
  category_id: string | null;
  /** Resolved category name for display/charting */
  category?: string;
  name: string;
  campus: Campus;

  // Ownership & Accountability
  project_manager_id?: string | null;
  owner_id?: string | null;
  project_manager_name?: string;
  owner_name?: string;
  technical_lead_name: string;
  approval_authority: string;

  // Benefits & Outcomes
  problem_solved: string;
  expected_benefit: string;
  savings_efficiency: string;

  // Progress, Health & Schedule
  percent_complete: number;
  schedule_status: ScheduleStatus;
  rag_status: RagStatus;
  next_milestone: string;
  milestone_due_date?: string | null;
  target_end_date: string;

  // Weighted Priority Scoring (1-5)
  business_impact: number;
  risk_level: number;
  urgency: number;
  strategic_importance: number;
  priority_score: number;

  // Flexible Exact Naira Budget & Procurement
  approved_budget: number;
  actual_spend: number;
  procurement_status: ProcurementStatus;

  created_at?: string;
  updated_at?: string;
}

export type ProjectInput = Omit<
  Project,
  | 'id'
  | 'project_code'
  | 'priority_score'
  | 'category'
  | 'project_manager_name'
  | 'owner_name'
  | 'created_at'
  | 'updated_at'
> & {
  project_code?: string;
};

export interface Risk {
  id: string;
  project_id: string;
  department_id: string;
  description: string;
  severity: RiskSeverity;
  mitigation_plan: string;
  status: RiskStatus;
  risk_owner: string;
  target_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type RiskInput = Omit<Risk, 'id' | 'department_id' | 'created_at' | 'updated_at'> & {
  department_id?: string;
};

export interface LeadershipAction {
  id: string;
  project_id: string;
  department_id: string;
  decision_required: string;
  required_by: string;
  decision_owner: string;
  due_date: string;
  status: ActionStatus;
  impact_if_delayed: string;
  created_at?: string;
  updated_at?: string;
}

export type LeadershipActionInput = Omit<
  LeadershipAction,
  'id' | 'department_id' | 'created_at' | 'updated_at'
> & {
  department_id?: string;
};

export interface AuditLog {
  id: string;
  project_id: string;
  changed_by?: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export type KpiMetricKey =
  | 'total_projects'
  | 'completed'
  | 'on_track'
  | 'attention_needed'
  | 'at_risk'
  | 'behind_schedule'
  | 'avg_percent_complete'
  | 'department_budget_ceiling'
  | 'allocated_budget'
  | 'actual_spend'
  | 'remaining_budget'
  | 'open_risks'
  | 'open_actions';

export interface PortfolioKpis {
  totalProjects: number;
  completedProjects: number;
  onTrackProjects: number;
  attentionNeededProjects: number;
  criticalProjects: number;
  behindScheduleProjects: number;
  avgPercentComplete: number;
  departmentBudgetCeiling: number;
  allocatedBudget: number;
  totalActualSpend: number;
  remainingBudget: number;
  openRisks: number;
  openHighCriticalRisks: number;
  openLeadershipActions: number;
  overdueLeadershipActions: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

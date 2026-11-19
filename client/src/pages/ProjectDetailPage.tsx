import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckSquare,
  Edit3,
  History,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ProjectFormModal } from '../components/portfolio/ProjectFormModal';
import {
  ActionStatusBadge,
  CampusBadge,
  DepartmentBadge,
  ProcurementBadge,
  RagBadge,
  RiskStatusBadge,
  ScheduleBadge,
  SeverityBadge,
} from '../components/ui/Badges';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency, formatDate } from '../lib/formatters';
import {
  ActionStatus,
  LeadershipActionInput,
  RiskInput,
  RiskSeverity,
  RiskStatus,
} from '../types/portfolio';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    departmentId,
    isSuperAdmin,
    canCreateProject,
    canEditProject,
    canDeleteProject,
  } = useAuth();
  const {
    departments,
    categories,
    profiles,
    budgets,
    projects,
    allVisibleProjects,
    risks,
    actions,
    auditLogs,
    getDepartmentName,
    getCategoryName,
    getProfileName,
    createCategory,
    updateProject,
    deleteProject,
    createRisk,
    updateRisk,
    deleteRisk,
    createAction,
    updateAction,
    deleteAction,
  } = usePortfolio();

  const project = useMemo(
    () => projects.find((p) => p.id === id) ?? null,
    [projects, id]
  );

  const projectRisks = useMemo(
    () => (project ? risks.filter((r) => r.project_id === project.id) : []),
    [risks, project]
  );

  const projectActions = useMemo(
    () => (project ? actions.filter((a) => a.project_id === project.id) : []),
    [actions, project]
  );

  const projectAuditLogs = useMemo(
    () =>
      project
        ? auditLogs
            .filter((log) => log.project_id === project.id)
            .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
        : [],
    [auditLogs, project]
  );

  const [editOpen, setEditOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<
    | { kind: 'project' }
    | { kind: 'risk'; id: string; label: string }
    | { kind: 'action'; id: string; label: string }
    | null
  >(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [riskFormOpen, setRiskFormOpen] = useState(false);
  const [riskForm, setRiskForm] = useState<Omit<RiskInput, 'project_id' | 'department_id'>>({
    description: '',
    severity: 'Medium',
    mitigation_plan: '',
    status: 'Open',
    risk_owner: '',
    target_date: new Date().toISOString().slice(0, 10),
  });

  const [actionFormOpen, setActionFormOpen] = useState(false);
  const [actionForm, setActionForm] = useState<
    Omit<LeadershipActionInput, 'project_id' | 'department_id'>
  >({
    decision_required: '',
    required_by: '',
    decision_owner: '',
    due_date: new Date().toISOString().slice(0, 10),
    status: 'Pending Decision',
    impact_if_delayed: '',
  });

  if (!project) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Project not found</h2>
        <p className="mt-1 text-sm text-slate-500">
          This initiative may have been removed or is outside your department or owner
          permissions.
        </p>
        <Link
          to="/projects"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white hover:bg-gsl-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portfolio
        </Link>
      </div>
    );
  }

  const canEdit = canEditProject(project);
  const canDelete = canDeleteProject(project);
  const departmentName = getDepartmentName(project.department_id);
  const categoryName =
    project.category || getCategoryName(project.category_id) || 'Uncategorized';
  const remaining = project.approved_budget - project.actual_spend;
  const utilization =
    project.approved_budget > 0
      ? Math.round((project.actual_spend / project.approved_budget) * 100)
      : 0;

  const handleConfirmAction = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    let ok = false;
    if (confirmTarget.kind === 'project') {
      ok = await deleteProject(project.id);
      if (ok) {
        setConfirmBusy(false);
        setConfirmTarget(null);
        navigate('/projects');
        return;
      }
    } else if (confirmTarget.kind === 'risk') {
      ok = await deleteRisk(confirmTarget.id);
    } else if (confirmTarget.kind === 'action') {
      ok = await deleteAction(confirmTarget.id);
    }
    setConfirmBusy(false);
    if (ok) setConfirmTarget(null);
  };

  const handleAddRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riskForm.description.trim()) return;
    const ok = await createRisk({
      ...riskForm,
      project_id: project.id,
      department_id: project.department_id,
    });
    if (ok) {
      setRiskForm({
        description: '',
        severity: 'Medium',
        mitigation_plan: '',
        status: 'Open',
        risk_owner: '',
        target_date: new Date().toISOString().slice(0, 10),
      });
      setRiskFormOpen(false);
    }
  };

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionForm.decision_required.trim()) return;
    const ok = await createAction({
      ...actionForm,
      project_id: project.id,
      department_id: project.department_id,
    });
    if (ok) {
      setActionForm({
        decision_required: '',
        required_by: '',
        decision_owner: '',
        due_date: new Date().toISOString().slice(0, 10),
        status: 'Pending Decision',
        impact_if_delayed: '',
      });
      setActionFormOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gsl-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Master Portfolio
        </Link>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gsl-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-gsl-800"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit Initiative
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirmTarget({ kind: 'project' })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Project
            </button>
          )}
        </div>
      </div>

      {/* Header Overview Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-gsl-700">
                {project.project_code}
              </span>
              <DepartmentBadge name={departmentName} />
              <CampusBadge campus={project.campus} />
              <RagBadge status={project.rag_status} />
              <ScheduleBadge status={project.schedule_status} />
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{project.name}</h2>
            <p className="mt-1 text-xs text-slate-500">Category: {categoryName}</p>
          </div>

          <div className="rounded-2xl border border-gsl-200 bg-gsl-50 px-5 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gsl-700">
              Priority Score
            </p>
            <p className="text-2xl font-extrabold text-gsl-900">
              {project.priority_score.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-500">Weighted / 5.00</p>
          </div>
        </div>

        {/* Progress & Financial Bar */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Completion Progress</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {project.percent_complete}%
            </p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gsl-600"
                style={{ width: `${project.percent_complete}%` }}
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500">Approved Project Budget</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatCurrency(project.approved_budget)}
            </p>
            <p className="text-[11px] text-slate-500">Target: {formatDate(project.target_end_date)}</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Actual Spend</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatCurrency(project.actual_spend)}
            </p>
            <p className="text-[11px] text-slate-500">{utilization}% utilized</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Remaining Variance</p>
            <p
              className={`mt-1 text-lg font-bold ${
                remaining < 0 ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {formatCurrency(remaining)}
            </p>
            <div className="mt-1">
              <ProcurementBadge status={project.procurement_status} />
            </div>
          </div>
        </div>

        {/* Narrative & Ownership */}
        <div className="mt-6 grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 lg:grid-cols-2">
          <div className="space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900">
              Business Rationale &amp; Delivery
            </h3>
            <div className="rounded-xl bg-slate-50 p-3.5">
              <p className="font-semibold text-slate-700">Problem Being Solved</p>
              <p className="mt-1 text-slate-600">
                {project.problem_solved || 'Not documented'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5">
              <p className="font-semibold text-slate-700">Expected Benefit</p>
              <p className="mt-1 text-slate-600">
                {project.expected_benefit || 'Not documented'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3.5">
              <p className="font-semibold text-slate-700">Savings / Efficiency</p>
              <p className="mt-1 text-slate-600">
                {project.savings_efficiency || 'Not documented'}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900">
              Ownership &amp; Scoring Criteria
            </h3>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5">
              <div>
                <p className="text-slate-500">Project Manager</p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {project.project_manager_name || 'Unassigned'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Project Owner</p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {project.owner_name || 'Unassigned'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Technical Lead</p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {project.technical_lead_name || 'Confirm'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Approval Authority</p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {project.approval_authority || 'Confirm'}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5">
              <p className="font-semibold text-slate-700">Next Key Milestone</p>
              <p className="mt-1 text-slate-900">{project.next_milestone || '—'}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Milestone Due: {formatDate(project.milestone_due_date)}
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Impact (35%)', value: project.business_impact },
                { label: 'Strategic (30%)', value: project.strategic_importance },
                { label: 'Urgency (20%)', value: project.urgency },
                { label: 'Risk (15%)', value: project.risk_level },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-slate-200 bg-white px-2 py-2"
                >
                  <p className="text-[10px] font-medium text-slate-500">{s.label}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">{s.value}/5</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Linked Risks */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Project Risks &amp; Dependencies ({projectRisks.length})
            </h3>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setRiskFormOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg bg-gsl-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gsl-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Log Risk
            </button>
          )}
        </div>

        {riskFormOpen && canEdit && (
          <form
            onSubmit={handleAddRisk}
            className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-3"
          >
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Risk Description *
              </label>
              <input
                type="text"
                required
                value={riskForm.description}
                onChange={(e) =>
                  setRiskForm({ ...riskForm, description: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Severity
              </label>
              <select
                value={riskForm.severity}
                onChange={(e) =>
                  setRiskForm({
                    ...riskForm,
                    severity: e.target.value as RiskSeverity,
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              >
                {(['Critical', 'High', 'Medium', 'Low'] as const).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Mitigation Plan
              </label>
              <input
                type="text"
                value={riskForm.mitigation_plan}
                onChange={(e) =>
                  setRiskForm({ ...riskForm, mitigation_plan: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Risk Owner
              </label>
              <input
                type="text"
                value={riskForm.risk_owner}
                onChange={(e) =>
                  setRiskForm({ ...riskForm, risk_owner: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 md:col-span-3">
              <button
                type="button"
                onClick={() => setRiskFormOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-gsl-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Save Risk
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {projectRisks.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-slate-400">
              No risks logged for this project.
            </p>
          ) : (
            projectRisks.map((risk) => (
              <div
                key={risk.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={risk.severity} />
                    <RiskStatusBadge status={risk.status} />
                    <span className="text-xs font-semibold text-slate-900">
                      {risk.description}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Mitigation: {risk.mitigation_plan || 'None recorded'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Owner: {risk.risk_owner || 'Unassigned'} • Target:{' '}
                    {formatDate(risk.target_date)}
                  </p>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <select
                      value={risk.status}
                      onChange={(e) =>
                        updateRisk(risk.id, { status: e.target.value as RiskStatus })
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    >
                      {(['Open', 'Mitigated', 'Closed'] as const).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmTarget({
                            kind: 'risk',
                            id: risk.id,
                            label: risk.description,
                          })
                        }
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete risk"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Linked Leadership Actions */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Leadership Actions &amp; Decisions ({projectActions.length})
            </h3>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setActionFormOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg bg-gsl-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gsl-800"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Log Action
            </button>
          )}
        </div>

        {actionFormOpen && canEdit && (
          <form
            onSubmit={handleAddAction}
            className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-3"
          >
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Decision / Action Required *
              </label>
              <input
                type="text"
                required
                value={actionForm.decision_required}
                onChange={(e) =>
                  setActionForm({ ...actionForm, decision_required: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Decision Owner
              </label>
              <input
                type="text"
                value={actionForm.decision_owner}
                onChange={(e) =>
                  setActionForm({ ...actionForm, decision_owner: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Required By
              </label>
              <input
                type="text"
                value={actionForm.required_by}
                onChange={(e) =>
                  setActionForm({ ...actionForm, required_by: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Due Date
              </label>
              <input
                type="date"
                value={actionForm.due_date}
                onChange={(e) =>
                  setActionForm({ ...actionForm, due_date: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Impact If Delayed
              </label>
              <input
                type="text"
                value={actionForm.impact_if_delayed}
                onChange={(e) =>
                  setActionForm({ ...actionForm, impact_if_delayed: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 md:col-span-3">
              <button
                type="button"
                onClick={() => setActionFormOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-gsl-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Save Action
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {projectActions.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-slate-400">
              No leadership actions recorded for this project.
            </p>
          ) : (
            projectActions.map((act) => (
              <div
                key={act.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionStatusBadge status={act.status} />
                    <span className="text-xs font-semibold text-slate-900">
                      {act.decision_required}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Impact if delayed: {act.impact_if_delayed || 'Not specified'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Owner: {act.decision_owner} • Required by: {act.required_by} • Due:{' '}
                    {formatDate(act.due_date)}
                  </p>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <select
                      value={act.status}
                      onChange={(e) =>
                        updateAction(act.id, { status: e.target.value as ActionStatus })
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    >
                      {(
                        ['Pending Decision', 'In Review', 'Overdue', 'Closed'] as const
                      ).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmTarget({
                            kind: 'action',
                            id: act.id,
                            label: act.decision_required,
                          })
                        }
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete action"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Audit Log History */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <History className="h-4 w-4 text-gsl-700" />
          <h3 className="text-sm font-bold text-slate-900">
            Change Audit History ({projectAuditLogs.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          {projectAuditLogs.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs text-slate-400">
              No field updates recorded yet for this project.
            </p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Changed By</th>
                  <th className="px-4 py-2.5">Field</th>
                  <th className="px-4 py-2.5">Previous Value</th>
                  <th className="px-4 py-2.5">New Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/75">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                      {new Date(log.changed_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {log.changed_by ? getProfileName(log.changed_by) : 'System'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-700">
                      {log.field_name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {log.old_value ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-gsl-800">
                      {log.new_value ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <ProjectFormModal
        open={editOpen}
        initialProject={project}
        departments={departments}
        categories={categories}
        profiles={profiles}
        budgets={budgets}
        allProjects={allVisibleProjects}
        lockedDepartmentId={isSuperAdmin ? null : departmentId}
        canAddCategory={canCreateProject}
        onCreateCategory={createCategory}
        onClose={() => setEditOpen(false)}
        onSubmit={(payload) => updateProject(project.id, payload)}
      />

      <ConfirmModal
        open={Boolean(confirmTarget)}
        title={
          confirmTarget?.kind === 'project'
            ? 'Delete Project'
            : confirmTarget?.kind === 'risk'
            ? 'Delete Risk'
            : 'Delete Action'
        }
        message={
          confirmTarget?.kind === 'project'
            ? `Permanently delete ${project.project_code} (${project.name}) and all linked risks and actions?`
            : `Delete "${confirmTarget && 'label' in confirmTarget ? confirmTarget.label : ''}"?`
        }
        confirmLabel="Delete"
        busy={confirmBusy}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
};

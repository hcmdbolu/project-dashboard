import React, { useMemo, useState } from 'react';
import { CheckSquare, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ActionStatusBadge,
  CampusBadge,
  DepartmentBadge,
  RiskStatusBadge,
  SeverityBadge,
} from '../components/ui/Badges';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { usePortfolio } from '../context/PortfolioContext';
import { formatDate, isPastDue } from '../lib/formatters';
import {
  ActionStatus,
  LeadershipActionInput,
  RiskInput,
  RiskSeverity,
  RiskStatus,
} from '../types/portfolio';

export const RisksAndActionsPage: React.FC = () => {
  const {
    role,
    departmentId,
    isSuperAdmin,
    isDepartmentAdmin,
    canEditProject,
    canDeleteProject,
  } = useAuth();
  const {
    projects,
    risks,
    actions,
    getDepartmentName,
    createRisk,
    updateRisk,
    deleteRisk,
    createAction,
    updateAction,
    deleteAction,
  } = usePortfolio();

  const [tab, setTab] = useState<'risks' | 'actions'>('risks');
  const [riskFilter, setRiskFilter] = useState<RiskStatus | 'ALL'>('ALL');
  const [actionFilter, setActionFilter] = useState<ActionStatus | 'ALL'>('ALL');

  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'risk'; id: string; label: string }
    | { kind: 'action'; id: string; label: string }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const editableProjects = useMemo(
    () => projects.filter((p) => canEditProject(p)),
    [projects, canEditProject]
  );

  const [newRisk, setNewRisk] = useState<Omit<RiskInput, 'department_id'>>({
    project_id: '',
    description: '',
    severity: 'High',
    mitigation_plan: '',
    status: 'Open',
    risk_owner: '',
    target_date: new Date().toISOString().slice(0, 10),
  });

  const [newAction, setNewAction] = useState<Omit<LeadershipActionInput, 'department_id'>>({
    project_id: '',
    decision_required: '',
    required_by: '',
    decision_owner: '',
    due_date: new Date().toISOString().slice(0, 10),
    status: 'Pending Decision',
    impact_if_delayed: '',
  });

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  const filteredRisks = useMemo(() => {
    return risks.filter((r) => riskFilter === 'ALL' || r.status === riskFilter);
  }, [risks, riskFilter]);

  const filteredActions = useMemo(() => {
    return actions.filter((a) => actionFilter === 'ALL' || a.status === actionFilter);
  }, [actions, actionFilter]);

  const canModifyRecord = (projectId: string, recordDeptId: string): boolean => {
    const proj = projectMap.get(projectId);
    if (proj) return canEditProject(proj);
    if (isSuperAdmin) return true;
    if (role === 'Executive' || role === 'Project Owner') return false;
    return recordDeptId === departmentId;
  };

  const canDeleteRecord = (projectId: string, recordDeptId: string): boolean => {
    const proj = projectMap.get(projectId);
    if (proj) return canDeleteProject(proj);
    if (isSuperAdmin) return true;
    if (isDepartmentAdmin && recordDeptId === departmentId) return true;
    return false;
  };

  const handleOpenRiskModal = () => {
    setNewRisk((prev) => ({
      ...prev,
      project_id: prev.project_id || editableProjects[0]?.id || '',
    }));
    setRiskModalOpen(true);
  };

  const handleOpenActionModal = () => {
    setNewAction((prev) => ({
      ...prev,
      project_id: prev.project_id || editableProjects[0]?.id || '',
    }));
    setActionModalOpen(true);
  };

  const handleSaveRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    const proj = projectMap.get(newRisk.project_id);
    if (!newRisk.project_id || !newRisk.description.trim() || !proj) return;
    const ok = await createRisk({
      ...newRisk,
      department_id: proj.department_id,
    });
    if (ok) {
      setRiskModalOpen(false);
      setNewRisk({
        project_id: editableProjects[0]?.id ?? '',
        description: '',
        severity: 'High',
        mitigation_plan: '',
        status: 'Open',
        risk_owner: '',
        target_date: new Date().toISOString().slice(0, 10),
      });
    }
  };

  const handleSaveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    const proj = projectMap.get(newAction.project_id);
    if (!newAction.project_id || !newAction.decision_required.trim() || !proj) return;
    const ok = await createAction({
      ...newAction,
      department_id: proj.department_id,
    });
    if (ok) {
      setActionModalOpen(false);
      setNewAction({
        project_id: editableProjects[0]?.id ?? '',
        decision_required: '',
        required_by: '',
        decision_owner: '',
        due_date: new Date().toISOString().slice(0, 10),
        status: 'Pending Decision',
        impact_if_delayed: '',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const ok =
      confirmDelete.kind === 'risk'
        ? await deleteRisk(confirmDelete.id)
        : await deleteAction(confirmDelete.id);
    setDeleting(false);
    if (ok) setConfirmDelete(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Risks, Dependencies &amp; Leadership Actions
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Centralized governance registers scoped by department and project ownership.
          </p>
        </div>

        {editableProjects.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenRiskModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Log Risk
            </button>
            <button
              type="button"
              onClick={handleOpenActionModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gsl-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-gsl-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Log Leadership Action
            </button>
          </div>
        )}
      </div>

      {/* Tabs & Status Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('risks')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              tab === 'risks'
                ? 'bg-gsl-700 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            Risks &amp; Dependencies ({risks.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('actions')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              tab === 'actions'
                ? 'bg-gsl-700 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckSquare className="h-4 w-4" />
            Leadership Actions ({actions.length})
          </button>
        </div>

        {tab === 'risks' ? (
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskStatus | 'ALL')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
          >
            <option value="ALL">All Risk Statuses</option>
            <option value="Open">Open</option>
            <option value="Mitigated">Mitigated</option>
            <option value="Closed">Closed</option>
          </select>
        ) : (
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as ActionStatus | 'ALL')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
          >
            <option value="ALL">All Action Statuses</option>
            <option value="Pending Decision">Pending Decision</option>
            <option value="In Review">In Review</option>
            <option value="Overdue">Overdue</option>
            <option value="Closed">Closed</option>
          </select>
        )}
      </div>

      {tab === 'risks' ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Department / Project</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Risk &amp; Mitigation</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRisks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No risk entries match this filter.
                  </td>
                </tr>
              ) : (
                filteredRisks.map((risk) => {
                  const proj = projectMap.get(risk.project_id);
                  const editable = canModifyRecord(risk.project_id, risk.department_id);
                  const deletable = canDeleteRecord(risk.project_id, risk.department_id);
                  return (
                    <tr key={risk.id} className="hover:bg-slate-50/75">
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <DepartmentBadge name={getDepartmentName(risk.department_id)} />
                          {proj && <CampusBadge campus={proj.campus} />}
                        </div>
                        {proj ? (
                          <Link
                            to={`/projects/${proj.id}`}
                            className="mt-1 block font-mono text-[11px] font-bold text-gsl-700 hover:underline"
                          >
                            {proj.project_code} • {proj.name}
                          </Link>
                        ) : (
                          <span className="mt-1 block text-slate-400">Unknown Project</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        <SeverityBadge severity={risk.severity} />
                      </td>
                      <td className="max-w-md px-4 py-3.5 align-top">
                        <p className="font-semibold text-slate-900">{risk.description}</p>
                        <p className="mt-1 text-slate-500">
                          Mitigation: {risk.mitigation_plan || 'None recorded'}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 align-top text-slate-700">
                        {risk.risk_owner || 'Unassigned'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 align-top text-slate-600">
                        {formatDate(risk.target_date)}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        {editable ? (
                          <select
                            value={risk.status}
                            onChange={(e) =>
                              updateRisk(risk.id, {
                                status: e.target.value as RiskStatus,
                              })
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                          >
                            {(['Open', 'Mitigated', 'Closed'] as const).map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <RiskStatusBadge status={risk.status} />
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right align-top">
                        {deletable && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({
                                kind: 'risk',
                                id: risk.id,
                                label: risk.description,
                              })
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Department / Project</th>
                <th className="px-4 py-3">Decision Required &amp; Delay Impact</th>
                <th className="px-4 py-3">Decision Owner</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredActions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No leadership actions match this filter.
                  </td>
                </tr>
              ) : (
                filteredActions.map((act) => {
                  const proj = projectMap.get(act.project_id);
                  const editable = canModifyRecord(act.project_id, act.department_id);
                  const deletable = canDeleteRecord(act.project_id, act.department_id);
                  const overdue = act.status !== 'Closed' && isPastDue(act.due_date);
                  return (
                    <tr key={act.id} className="hover:bg-slate-50/75">
                      <td className="px-4 py-3.5 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <DepartmentBadge name={getDepartmentName(act.department_id)} />
                          {proj && <CampusBadge campus={proj.campus} />}
                        </div>
                        {proj ? (
                          <Link
                            to={`/projects/${proj.id}`}
                            className="mt-1 block font-mono text-[11px] font-bold text-gsl-700 hover:underline"
                          >
                            {proj.project_code} • {proj.name}
                          </Link>
                        ) : (
                          <span className="mt-1 block text-slate-400">Unknown Project</span>
                        )}
                      </td>
                      <td className="max-w-md px-4 py-3.5 align-top">
                        <p className="font-semibold text-slate-900">
                          {act.decision_required}
                        </p>
                        <p className="mt-1 text-slate-500">
                          Impact: {act.impact_if_delayed || 'Not specified'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 align-top text-slate-700">
                        <p className="font-medium">{act.decision_owner}</p>
                        <p className="text-[11px] text-slate-400">
                          Req. by {act.required_by}
                        </p>
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3.5 align-top font-semibold ${
                          overdue ? 'text-red-600' : 'text-slate-700'
                        }`}
                      >
                        {formatDate(act.due_date)}
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        {editable ? (
                          <select
                            value={act.status}
                            onChange={(e) =>
                              updateAction(act.id, {
                                status: e.target.value as ActionStatus,
                              })
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                          >
                            {(
                              [
                                'Pending Decision',
                                'In Review',
                                'Overdue',
                                'Closed',
                              ] as const
                            ).map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <ActionStatusBadge status={act.status} />
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right align-top">
                        {deletable && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({
                                kind: 'action',
                                id: act.id,
                                label: act.decision_required,
                              })
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Log Risk */}
      {riskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSaveRisk}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">
              Log Risk or Dependency
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Project *
              </label>
              <select
                required
                value={newRisk.project_id}
                onChange={(e) =>
                  setNewRisk({ ...newRisk, project_id: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                {editableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_code} — {p.name} ({getDepartmentName(p.department_id)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Risk Description *
              </label>
              <textarea
                required
                rows={2}
                value={newRisk.description}
                onChange={(e) =>
                  setNewRisk({ ...newRisk, description: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Severity
                </label>
                <select
                  value={newRisk.severity}
                  onChange={(e) =>
                    setNewRisk({
                      ...newRisk,
                      severity: e.target.value as RiskSeverity,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                >
                  {(['Critical', 'High', 'Medium', 'Low'] as const).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Risk Owner
                </label>
                <input
                  type="text"
                  value={newRisk.risk_owner}
                  onChange={(e) =>
                    setNewRisk({ ...newRisk, risk_owner: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Mitigation Plan
              </label>
              <input
                type="text"
                value={newRisk.mitigation_plan}
                onChange={(e) =>
                  setNewRisk({ ...newRisk, mitigation_plan: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRiskModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white"
              >
                Save Risk
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Log Leadership Action */}
      {actionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSaveAction}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-bold text-slate-900">
              Log Leadership Action
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Project *
              </label>
              <select
                required
                value={newAction.project_id}
                onChange={(e) =>
                  setNewAction({ ...newAction, project_id: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                {editableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_code} — {p.name} ({getDepartmentName(p.department_id)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Decision Required *
              </label>
              <textarea
                required
                rows={2}
                value={newAction.decision_required}
                onChange={(e) =>
                  setNewAction({
                    ...newAction,
                    decision_required: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Decision Owner
                </label>
                <input
                  type="text"
                  required
                  value={newAction.decision_owner}
                  onChange={(e) =>
                    setNewAction({ ...newAction, decision_owner: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={newAction.due_date}
                  onChange={(e) =>
                    setNewAction({ ...newAction, due_date: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Required By / Escalation Body
              </label>
              <input
                type="text"
                value={newAction.required_by}
                onChange={(e) =>
                  setNewAction({ ...newAction, required_by: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Impact If Delayed
              </label>
              <input
                type="text"
                value={newAction.impact_if_delayed}
                onChange={(e) =>
                  setNewAction({ ...newAction, impact_if_delayed: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white"
              >
                Save Action
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title={confirmDelete?.kind === 'risk' ? 'Delete Risk' : 'Delete Action'}
        message={`Permanently remove "${confirmDelete?.label}"?`}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

import React, { useMemo } from 'react';
import { ExternalLink, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { LeadershipAction, Project, Risk } from '../../types/portfolio';
import {
  ActionStatusBadge,
  CampusBadge,
  DepartmentBadge,
  ProcurementBadge,
  RagBadge,
  RiskStatusBadge,
  ScheduleBadge,
  SeverityBadge,
} from '../ui/Badges';

interface ProjectDetailDrawerProps {
  project: Project | null;
  risks: Risk[];
  actions: LeadershipAction[];
  departmentName: string;
  canEdit: boolean;
  onClose: () => void;
  onEditFull: (project: Project) => void;
}

export const ProjectDetailDrawer: React.FC<ProjectDetailDrawerProps> = ({
  project,
  risks,
  actions,
  departmentName,
  canEdit,
  onClose,
  onEditFull,
}) => {
  const linkedRisks = useMemo(
    () => (project ? risks.filter((r) => r.project_id === project.id) : []),
    [project, risks]
  );

  const linkedActions = useMemo(
    () => (project ? actions.filter((a) => a.project_id === project.id) : []),
    [actions, project]
  );

  if (!project) return null;

  const remaining = project.approved_budget - project.actual_spend;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gsl-700 px-6 py-5 text-white">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-emerald-200">
                {project.project_code}
              </span>
              <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
                {departmentName}
              </span>
              <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
                {project.campus}
              </span>
              <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
                {project.category}
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-bold">{project.name}</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-emerald-100 hover:bg-white/15"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <RagBadge status={project.rag_status} />
              <ScheduleBadge status={project.schedule_status} />
              <DepartmentBadge name={departmentName} />
              <CampusBadge campus={project.campus} />
              <ProcurementBadge status={project.procurement_status} />
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">Completion: </span>
              <span className="text-sm font-bold text-slate-900">
                {project.percent_complete}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="text-xs text-slate-500">Allocated Budget</p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {formatCurrency(project.approved_budget)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="text-xs text-slate-500">Actual Spend</p>
              <p className="mt-1 text-base font-bold text-slate-900">
                {formatCurrency(project.actual_spend)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="text-xs text-slate-500">Remaining Budget</p>
              <p
                className={`mt-1 text-base font-bold ${
                  remaining < 0 ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Weighted Priority Score
              </h4>
              <span className="font-mono text-base font-bold text-gsl-700">
                {Number(project.priority_score).toFixed(2)} / 5.00
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
              <div>Impact (35%): <strong>{project.business_impact}</strong></div>
              <div>Strategic (30%): <strong>{project.strategic_importance}</strong></div>
              <div>Urgency (20%): <strong>{project.urgency}</strong></div>
              <div>Risk (15%): <strong>{project.risk_level}</strong></div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
              <p className="font-semibold text-slate-500">
                Project Co-Owners (View &amp; Edit)
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(project.owner_names?.length ?? 0) > 0 ? (
                  project.owner_names!.map((name, idx) => (
                    <span
                      key={`${project.id}-drawer-owner-${idx}`}
                      className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800 ring-1 ring-inset ring-blue-200"
                    >
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="font-semibold text-slate-900">Unassigned</span>
                )}
              </div>
              {(project.owner_department_names?.length ?? 0) > 0 && (
                <div className="mt-2 border-t border-slate-200/80 pt-2">
                  <p className="text-[11px] font-semibold text-slate-500">
                    Department Owners (View Access)
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {project.owner_department_names!.map((deptName, idx) => (
                      <span
                        key={`${project.id}-drawer-dept-${idx}`}
                        className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-800 ring-1 ring-inset ring-teal-200"
                      >
                        {deptName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-semibold text-slate-500">Project Manager</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {project.project_manager_name || 'Unassigned'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-semibold text-slate-500">Technical Lead</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {project.technical_lead_name || '—'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-semibold text-slate-500">Approval Authority</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {project.approval_authority || '—'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-semibold text-slate-500">Next Milestone</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {project.next_milestone || '—'} ({formatDate(project.milestone_due_date)})
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="font-semibold text-slate-500">Target End Date</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {formatDate(project.target_end_date)}
              </p>
            </div>
          </div>

          <div className="space-y-2.5 rounded-xl border border-slate-200 p-4 text-xs">
            <h4 className="font-bold uppercase tracking-wide text-slate-500">
              Benefits &amp; Outcomes
            </h4>
            <div>
              <p className="font-semibold text-slate-700">Problem Solved</p>
              <p className="text-slate-600">{project.problem_solved || '—'}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Expected Benefit</p>
              <p className="text-slate-600">{project.expected_benefit || '—'}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">Savings &amp; Efficiency</p>
              <p className="text-slate-600">{project.savings_efficiency || '—'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Linked Risks ({linkedRisks.length})
            </h4>
            {linkedRisks.length === 0 ? (
              <p className="text-xs text-slate-400">No risks logged.</p>
            ) : (
              linkedRisks.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={r.severity} />
                    <RiskStatusBadge status={r.status} />
                    <span className="text-slate-500">Owner: {r.risk_owner}</span>
                  </div>
                  <p className="mt-1.5 font-medium text-slate-900">{r.description}</p>
                  {r.mitigation_plan && (
                    <p className="mt-1 text-slate-500">Mitigation: {r.mitigation_plan}</p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Leadership Actions ({linkedActions.length})
            </h4>
            {linkedActions.length === 0 ? (
              <p className="text-xs text-slate-400">No leadership actions logged.</p>
            ) : (
              linkedActions.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <ActionStatusBadge status={a.status} />
                    <span className="text-slate-500">Due: {formatDate(a.due_date)}</span>
                  </div>
                  <p className="mt-1.5 font-medium text-slate-900">
                    {a.decision_required}
                  </p>
                  <p className="mt-1 text-slate-500">Decision Owner: {a.decision_owner}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Link
            to={`/projects/${project.id}`}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gsl-700 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Full Charter &amp; Audit Log
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditFull(project);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white hover:bg-gsl-800"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Project
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

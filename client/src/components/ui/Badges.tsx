import React from 'react';
import {
  ACTION_STATUS_STYLES,
  BUDGET_STATUS_STYLES,
  PROCUREMENT_STYLES,
  RAG_COLORS,
  RAG_STATUSES,
  RISK_STATUS_STYLES,
  SCHEDULE_STYLES,
  SEVERITY_STYLES,
} from '../../lib/formatters';
import {
  ActionStatus,
  AppRole,
  BudgetStatus,
  Campus,
  ProcurementStatus,
  RagStatus,
  RiskSeverity,
  RiskStatus,
  ScheduleStatus,
} from '../../types/portfolio';

export const RagBadge: React.FC<{ status: RagStatus }> = ({ status }) => {
  const style = RAG_COLORS[status];
  return (
    <span
      title={style.label}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.pill}`}
    >
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
};

export const RagLegend: React.FC = () => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
    <span className="font-semibold text-slate-700">Status Key:</span>
    {RAG_STATUSES.map((status) => (
      <RagBadge key={status} status={status} />
    ))}
  </div>
);

export const BudgetStatusBadge: React.FC<{ status: BudgetStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BUDGET_STATUS_STYLES[status]}`}
  >
    {status}
  </span>
);

export const ScheduleBadge: React.FC<{ status: ScheduleStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${SCHEDULE_STYLES[status]}`}
  >
    {status}
  </span>
);

export const ProcurementBadge: React.FC<{ status: ProcurementStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${PROCUREMENT_STYLES[status]}`}
  >
    {status}
  </span>
);

export const SeverityBadge: React.FC<{ severity: RiskSeverity }> = ({ severity }) => (
  <span
    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLES[severity]}`}
  >
    {severity}
  </span>
);

export const RiskStatusBadge: React.FC<{ status: RiskStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${RISK_STATUS_STYLES[status]}`}
  >
    {status}
  </span>
);

export const ActionStatusBadge: React.FC<{ status: ActionStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ACTION_STATUS_STYLES[status]}`}
  >
    {status}
  </span>
);

export const CampusBadge: React.FC<{ campus: Campus }> = ({ campus }) => (
  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
    {campus}
  </span>
);

export const DepartmentBadge: React.FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center rounded-md bg-gsl-50 px-2 py-0.5 text-xs font-semibold text-gsl-700 ring-1 ring-inset ring-gsl-200">
    {name}
  </span>
);

export const RoleBadge: React.FC<{ role: AppRole }> = ({ role }) => {
  if (role === 'Super Admin') {
    return (
      <span className="inline-flex items-center rounded-full bg-gsl-100 px-2.5 py-0.5 text-xs font-semibold text-gsl-800 ring-1 ring-inset ring-gsl-200">
        Super Admin
      </span>
    );
  }
  if (role === 'Department Admin') {
    return (
      <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
        Department Admin
      </span>
    );
  }
  if (role === 'Project Manager') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
        Project Manager
      </span>
    );
  }
  if (role === 'Project Owner') {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800 ring-1 ring-inset ring-blue-200">
        Project Owner
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">
      Executive • Read-Only
    </span>
  );
};

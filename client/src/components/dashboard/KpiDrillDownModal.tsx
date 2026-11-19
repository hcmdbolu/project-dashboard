import React, { useMemo, useState } from 'react';
import { Download, Printer, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  CAMPUSES,
  formatCurrency,
  formatDate,
  getRagLabel,
  isProjectBehindSchedule,
} from '../../lib/formatters';
import {
  Campus,
  Department,
  DepartmentBudget,
  KpiMetricKey,
  LeadershipAction,
  Project,
  Risk,
} from '../../types/portfolio';
import {
  ActionStatusBadge,
  BudgetStatusBadge,
  CampusBadge,
  DepartmentBadge,
  RagBadge,
  RiskStatusBadge,
  ScheduleBadge,
  SeverityBadge,
} from '../ui/Badges';

interface KpiDrillDownModalProps {
  metric: KpiMetricKey | null;
  departments: Department[];
  budgets: DepartmentBudget[];
  projects: Project[];
  risks: Risk[];
  actions: LeadershipAction[];
  getDepartmentName: (id: string | null | undefined) => string;
  onClose: () => void;
}

const METRIC_META: Record<KpiMetricKey, { title: string; subtitle: string }> = {
  total_projects: {
    title: 'All Portfolio Initiatives',
    subtitle: 'Complete project inventory within active scope',
  },
  completed: {
    title: 'Completed Projects',
    subtitle: 'Initiatives delivered and certified complete',
  },
  on_track: {
    title: 'On Track Projects',
    subtitle: 'Initiatives progressing within schedule and budget tolerances',
  },
  attention_needed: {
    title: 'Attention Needed Projects',
    subtitle: 'Initiatives requiring proactive mitigation to stay on target',
  },
  at_risk: {
    title: 'Critical / At Risk Projects',
    subtitle: 'Projects with critical blockers, high priority scores, and open risks',
  },
  behind_schedule: {
    title: 'Behind Schedule Projects',
    subtitle: 'Open initiatives flagged behind schedule or past target end date',
  },
  avg_percent_complete: {
    title: 'Portfolio Delivery Progress (% Complete)',
    subtitle: 'Completion ranking across initiatives',
  },
  department_budget_ceiling: {
    title: 'Department Budget Ceiling vs. Allocations',
    subtitle: 'Approved fiscal ceilings compared against project allocations & actual spend',
  },
  allocated_budget: {
    title: 'Projects Allocated Budget Breakdown',
    subtitle: 'Capital and operational budget allocation by department, campus, and project',
  },
  actual_spend: {
    title: 'Actual Spend & Utilization Breakdown',
    subtitle: 'Spend-to-date versus allocated budget across campuses and departments',
  },
  remaining_budget: {
    title: 'Remaining Budget & Variance',
    subtitle: 'Unspent allocation and variance tracking across initiatives',
  },
  open_risks: {
    title: 'Open Risks & Mitigation Plans',
    subtitle: 'Active risks surfaced across the portfolio',
  },
  open_actions: {
    title: 'Open & Overdue Leadership Actions',
    subtitle: 'Pending executive decisions and escalation items',
  },
};

export const KpiDrillDownModal: React.FC<KpiDrillDownModalProps> = ({
  metric,
  departments,
  budgets,
  projects,
  risks,
  actions,
  getDepartmentName,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState<Campus | 'ALL'>('ALL');

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!metric) return [];
    const q = search.trim().toLowerCase();

    return projects
      .filter((p) => {
        if (campusFilter !== 'ALL' && p.campus !== campusFilter) return false;
        if (q) {
          const hay = `${p.project_code} ${p.name} ${p.owner_name ?? ''} ${p.project_manager_name ?? ''} ${p.category ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        switch (metric) {
          case 'completed':
            return (
              p.rag_status === 'Blue' ||
              p.schedule_status === 'Completed' ||
              p.percent_complete >= 100
            );
          case 'on_track':
            return p.rag_status === 'Green';
          case 'attention_needed':
            return p.rag_status === 'Amber';
          case 'at_risk':
            return p.rag_status === 'Red';
          case 'behind_schedule':
            return isProjectBehindSchedule(p);
          default:
            return true;
        }
      })
      .sort((a, b) => b.priority_score - a.priority_score);
  }, [campusFilter, metric, projects, search]);

  const filteredRisks = useMemo(() => {
    if (metric !== 'open_risks') return [];
    const q = search.trim().toLowerCase();
    return risks.filter((r) => {
      if (r.status === 'Closed') return false;
      const proj = projectMap.get(r.project_id);
      if (campusFilter !== 'ALL' && proj?.campus !== campusFilter) return false;
      if (q) {
        const hay = `${proj?.project_code ?? ''} ${proj?.name ?? ''} ${r.description} ${r.risk_owner} ${r.mitigation_plan}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [campusFilter, metric, projectMap, risks, search]);

  const filteredActions = useMemo(() => {
    if (metric !== 'open_actions') return [];
    const q = search.trim().toLowerCase();
    return actions
      .filter((a) => {
        if (a.status === 'Closed') return false;
        const proj = projectMap.get(a.project_id);
        if (campusFilter !== 'ALL' && proj?.campus !== campusFilter) return false;
        if (q) {
          const hay = `${proj?.project_code ?? ''} ${proj?.name ?? ''} ${a.decision_required} ${a.decision_owner} ${a.required_by}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [actions, campusFilter, metric, projectMap, search]);

  const deptBudgetRows = useMemo(() => {
    return departments
      .map((dept) => {
        const budget = budgets.find((b) => b.department_id === dept.id);
        const deptProjects = projects.filter((p) => p.department_id === dept.id);
        const allocated = deptProjects.reduce(
          (s, p) => s + Number(p.approved_budget || 0),
          0
        );
        const spent = deptProjects.reduce((s, p) => s + Number(p.actual_spend || 0), 0);
        const ceiling =
          budget && budget.status === 'Approved' ? Number(budget.approved_amount) : 0;
        return {
          dept,
          budget,
          ceiling,
          allocated,
          spent,
          unallocated: ceiling - allocated,
        };
      })
      .filter((r) => r.budget || r.allocated > 0);
  }, [budgets, departments, projects]);

  const campusBudgetBreakdown = useMemo(() => {
    return CAMPUSES.map((campus) => {
      const list = projects.filter((p) => p.campus === campus);
      const approved = list.reduce((s, p) => s + Number(p.approved_budget || 0), 0);
      const spent = list.reduce((s, p) => s + Number(p.actual_spend || 0), 0);
      return {
        campus,
        count: list.length,
        approved,
        spent,
        remaining: approved - spent,
      };
    });
  }, [projects]);

  if (!metric) return null;

  const isBudgetMetric =
    metric === 'department_budget_ceiling' ||
    metric === 'allocated_budget' ||
    metric === 'actual_spend' ||
    metric === 'remaining_budget';
  const meta = METRIC_META[metric];

  const handleExportCsv = () => {
    const escape = (val: string | number | null | undefined) => {
      const s = String(val ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    let headers: string[] = [];
    let rows: string[] = [];

    if (metric === 'open_risks') {
      headers = [
        'Department',
        'Project',
        'Severity',
        'Status',
        'Owner',
        'Target Date',
        'Description',
        'Mitigation Plan',
      ];
      rows = filteredRisks.map((r) =>
        [
          getDepartmentName(r.department_id),
          projectMap.get(r.project_id)?.project_code ?? '',
          r.severity,
          r.status,
          r.risk_owner,
          r.target_date ?? '',
          r.description,
          r.mitigation_plan,
        ]
          .map(escape)
          .join(',')
      );
    } else if (metric === 'open_actions') {
      headers = [
        'Department',
        'Project',
        'Decision Required',
        'Required By',
        'Decision Owner',
        'Due Date',
        'Status',
        'Impact if Delayed',
      ];
      rows = filteredActions.map((a) =>
        [
          getDepartmentName(a.department_id),
          projectMap.get(a.project_id)?.project_code ?? '',
          a.decision_required,
          a.required_by,
          a.decision_owner,
          a.due_date,
          a.status,
          a.impact_if_delayed,
        ]
          .map(escape)
          .join(',')
      );
    } else {
      headers = [
        'Department',
        'Project Code',
        'Name',
        'Campus',
        'Category',
        'Project Manager',
        'Project Owner',
        '% Complete',
        'Schedule Status',
        'Project Status',
        'Priority Score',
        'Allocated Budget',
        'Actual Spend',
        'Remaining Budget',
      ];
      rows = filteredProjects.map((p) =>
        [
          getDepartmentName(p.department_id),
          p.project_code,
          p.name,
          p.campus,
          p.category ?? '',
          p.project_manager_name ?? '',
          p.owner_name ?? '',
          p.percent_complete,
          p.schedule_status,
          getRagLabel(p.rag_status),
          p.priority_score,
          p.approved_budget,
          p.actual_spend,
          p.approved_budget - p.actual_spend,
        ]
          .map(escape)
          .join(',')
      );
    }

    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gsl-kpi-${metric}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gsl-700 px-6 py-4 text-white">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
              KPI Drill-Down Report
            </p>
            <h3 className="text-lg font-bold">{meta.title}</h3>
            <p className="text-xs text-emerald-100/85">{meta.subtitle}</p>
          </div>
          <div className="no-print flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gsl-800 hover:bg-emerald-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Print PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-emerald-100 hover:bg-white/15"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="no-print flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inside report..."
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs focus:border-gsl-600 focus:outline-none"
            />
          </div>
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value as Campus | 'ALL')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            <option value="ALL">All Campuses (Filter)</option>
            {CAMPUSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {isBudgetMetric && deptBudgetRows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Department</th>
                    <th className="px-4 py-2.5">Budget Status</th>
                    <th className="px-4 py-2.5 text-right">Approved Ceiling</th>
                    <th className="px-4 py-2.5 text-right">Allocated to Projects</th>
                    <th className="px-4 py-2.5 text-right">Actual Spend</th>
                    <th className="px-4 py-2.5 text-right">Unallocated Reserve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deptBudgetRows.map((row) => (
                    <tr key={row.dept.id}>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {row.dept.name}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.budget ? (
                          <BudgetStatusBadge status={row.budget.status} />
                        ) : (
                          <span className="text-slate-400">No proposal</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {formatCurrency(row.ceiling)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {formatCurrency(row.allocated)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {formatCurrency(row.spent)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold ${
                          row.unallocated < 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(row.unallocated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isBudgetMetric && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {campusBudgetBreakdown.map((b) => (
                <div
                  key={b.campus}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"
                >
                  <p className="text-xs font-bold text-slate-800">
                    {b.campus} ({b.count})
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Allocated: <strong>{formatCurrency(b.approved, true)}</strong>
                  </p>
                  <p className="text-xs text-slate-600">
                    Spent: <strong>{formatCurrency(b.spent, true)}</strong>
                  </p>
                  <p
                    className={`text-xs font-semibold ${
                      b.remaining < 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    Remaining: {formatCurrency(b.remaining, true)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {metric === 'open_risks' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Dept &amp; Project</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Risk &amp; Mitigation Plan</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRisks.map((r) => {
                    const p = projectMap.get(r.project_id);
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap px-4 py-3">
                          <DepartmentBadge name={getDepartmentName(r.department_id)} />
                          <p className="mt-1 font-mono font-semibold text-gsl-700">
                            {p?.project_code ?? '—'}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <SeverityBadge severity={r.severity} />
                        </td>
                        <td className="max-w-md px-4 py-3">
                          <p className="font-medium text-slate-900">{r.description}</p>
                          {r.mitigation_plan && (
                            <p className="mt-1 text-[11px] text-slate-500">
                              Mitigation: {r.mitigation_plan}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {r.risk_owner}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(r.target_date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <RiskStatusBadge status={r.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : metric === 'open_actions' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Dept &amp; Project</th>
                    <th className="px-4 py-3">Decision Required &amp; Impact</th>
                    <th className="px-4 py-3">Decision Owner</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActions.map((a) => {
                    const p = projectMap.get(a.project_id);
                    return (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap px-4 py-3">
                          <DepartmentBadge name={getDepartmentName(a.department_id)} />
                          <p className="mt-1 font-mono font-semibold text-gsl-700">
                            {p?.project_code ?? '—'}
                          </p>
                        </td>
                        <td className="max-w-md px-4 py-3">
                          <p className="font-medium text-slate-900">
                            {a.decision_required}
                          </p>
                          {a.impact_if_delayed && (
                            <p className="mt-1 text-[11px] text-red-700">
                              Impact if delayed: {a.impact_if_delayed}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {a.decision_owner}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDate(a.due_date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <ActionStatusBadge status={a.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Dept &amp; Campus</th>
                    <th className="px-4 py-3">PM / Owner</th>
                    <th className="px-4 py-3">%</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Priority</th>
                    <th className="px-4 py-3 text-right">Allocated</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProjects.map((p) => {
                    const rem = p.approved_budget - p.actual_spend;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link
                            to={`/projects/${p.id}`}
                            onClick={onClose}
                            className="font-mono font-semibold text-gsl-700 hover:underline"
                          >
                            {p.project_code}
                          </Link>
                          <p className="font-semibold text-slate-900">{p.name}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <DepartmentBadge name={getDepartmentName(p.department_id)} />
                            <CampusBadge campus={p.campus} />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          <p>PM: {p.project_manager_name}</p>
                          <p className="text-[11px] text-slate-500">
                            Owner: {p.owner_name}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold">
                          {p.percent_complete}%
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <ScheduleBadge status={p.schedule_status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <RagBadge status={p.rag_status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold">
                          {Number(p.priority_score).toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {formatCurrency(p.approved_budget, true)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                            rem < 0 ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {formatCurrency(rem, true)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

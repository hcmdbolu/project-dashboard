import React, { useMemo, useState } from 'react';
import {
  Building2,
  Download,
  FileSpreadsheet,
  Printer,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  ActionStatusBadge,
  CampusBadge,
  DepartmentBadge,
  RagBadge,
  RagLegend,
  SeverityBadge,
} from '../components/ui/Badges';
import { GslLogo } from '../components/ui/GslLogo';
import { useAuth } from '../context/AuthContext';
import { usePortfolio } from '../context/PortfolioContext';
import {
  CAMPUSES,
  computePortfolioKpis,
  formatCurrency,
  formatDate,
  getRagLabel,
  GOVERNANCE_META,
} from '../lib/formatters';
import { Campus } from '../types/portfolio';

export const ReportsPage: React.FC = () => {
  const { isOrgWide } = useAuth();
  const {
    departments,
    budgets,
    projects,
    risks,
    actions,
    selectedDepartmentId,
    setSelectedDepartmentId,
    activeDepartment,
    getDepartmentName,
  } = usePortfolio();
  const [campusFilter, setCampusFilter] = useState<Campus | 'ALL'>('ALL');

  const scopedProjects = useMemo(() => {
    if (campusFilter === 'ALL') return projects;
    return projects.filter(
      (p) => p.campus === campusFilter || p.campus === 'All Campuses'
    );
  }, [projects, campusFilter]);

  const scopedIds = useMemo(
    () => new Set(scopedProjects.map((p) => p.id)),
    [scopedProjects]
  );

  const scopedRisks = useMemo(
    () =>
      risks.filter(
        (r) =>
          scopedIds.has(r.project_id) &&
          r.status !== 'Closed' &&
          (r.severity === 'Critical' || r.severity === 'High')
      ),
    [risks, scopedIds]
  );

  const scopedActions = useMemo(
    () =>
      actions.filter(
        (a) => scopedIds.has(a.project_id) && a.status !== 'Closed'
      ),
    [actions, scopedIds]
  );

  const scopedBudgets = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return budgets;
    return budgets.filter((b) => b.department_id === selectedDepartmentId);
  }, [budgets, selectedDepartmentId]);

  const scopedKpis = useMemo(
    () =>
      computePortfolioKpis(
        scopedProjects,
        scopedRisks,
        scopedActions,
        scopedBudgets
      ),
    [scopedProjects, scopedRisks, scopedActions, scopedBudgets]
  );

  const campusFinancials = useMemo(() => {
    return CAMPUSES.map((campus) => {
      const items = projects.filter((p) => p.campus === campus);
      const budget = items.reduce((a, b) => a + b.approved_budget, 0);
      const spend = items.reduce((a, b) => a + b.actual_spend, 0);
      return {
        campus,
        count: items.length,
        budget,
        spend,
        remaining: budget - spend,
      };
    });
  }, [projects]);

  const departmentFinancials = useMemo(() => {
    const visibleDepts = activeDepartment ? [activeDepartment] : departments;
    return visibleDepts.map((dept) => {
      const deptProjects = scopedProjects.filter(
        (p) => p.department_id === dept.id
      );
      const ceiling = budgets
        .filter((b) => b.department_id === dept.id && b.status === 'Approved')
        .reduce((a, b) => a + b.approved_amount, 0);
      const allocated = deptProjects.reduce((a, p) => a + p.approved_budget, 0);
      const spend = deptProjects.reduce((a, p) => a + p.actual_spend, 0);
      return {
        dept,
        count: deptProjects.length,
        ceiling,
        allocated,
        spend,
        remaining: ceiling - allocated,
      };
    });
  }, [departments, activeDepartment, scopedProjects, budgets]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportBoardCsv = () => {
    const headers = [
      'Code',
      'Department',
      'Initiative',
      'Campus',
      'Category',
      'Status',
      '% Complete',
      'Schedule',
      'Priority Score',
      'Project Manager',
      'Project Owner',
      'Approved Budget (NGN)',
      'Actual Spend (NGN)',
      'Remaining Variance (NGN)',
      'Procurement',
      'Next Milestone',
      'Target End Date',
    ];
    const rows = scopedProjects.map((p) => [
      p.project_code,
      getDepartmentName(p.department_id),
      p.name,
      p.campus,
      p.category || '',
      getRagLabel(p.rag_status),
      String(p.percent_complete),
      p.schedule_status,
      p.priority_score.toFixed(2),
      p.project_manager_name || '',
      p.owner_name || '',
      String(p.approved_budget),
      String(p.actual_spend),
      String(p.approved_budget - p.actual_spend),
      p.procurement_status,
      p.next_milestone,
      p.target_end_date,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSL-Board-Pack-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Screen Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Executive Board Pack &amp; Reports
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Print-ready leadership briefing with department ceiling utilization, risks,
            and decision escalations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOrgWide && (
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5">
              <Building2 className="h-3.5 w-3.5 text-gsl-700" />
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value as Campus | 'ALL')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
          >
            <option value="ALL">All Campuses (Board Pack)</option>
            {CAMPUSES.map((c) => (
              <option key={c} value={c}>
                {c} Focus
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportBoardCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-gsl-800"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Board Report Body */}
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3.5">
            <GslLogo className="h-12 w-12 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gsl-700">
                {GOVERNANCE_META.organization} •{' '}
                {activeDepartment?.name ?? 'Enterprise Portfolio'}
              </p>
              <h3 className="text-xl font-bold text-slate-900">
                Portfolio Executive Governance Report
              </h3>
              <p className="text-xs text-slate-500">
                Scope: {activeDepartment?.name ?? 'All Departments'} • Campus:{' '}
                {campusFilter === 'ALL' ? 'School-wide' : campusFilter} • Generated:{' '}
                {formatDate(new Date().toISOString().slice(0, 10))} •{' '}
                {GOVERNANCE_META.version}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="font-semibold text-slate-800">
              Review Date: {GOVERNANCE_META.reviewDate}
            </p>
            <p>Governance Owner: {GOVERNANCE_META.owner}</p>
          </div>
        </div>

        {/* Summary Numbers */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            { label: 'Total Projects', value: String(scopedKpis.totalProjects) },
            { label: 'Avg Completion', value: `${scopedKpis.avgPercentComplete}%` },
            {
              label: 'Approved Ceiling',
              value: formatCurrency(scopedKpis.departmentBudgetCeiling, true),
            },
            {
              label: 'Allocated Budget',
              value: formatCurrency(scopedKpis.allocatedBudget, true),
            },
            {
              label: 'Actual Spend',
              value: formatCurrency(scopedKpis.totalActualSpend, true),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"
            >
              <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5">
          <RagLegend />
        </div>

        {/* Department Budget Governance Summary */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <Building2 className="h-4 w-4 text-gsl-700" />
            Department Budget Ceiling &amp; Utilization
          </h4>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5">Projects</th>
                  <th className="px-4 py-2.5">Approved Ceiling</th>
                  <th className="px-4 py-2.5">Allocated Budgets</th>
                  <th className="px-4 py-2.5">Actual Spend</th>
                  <th className="px-4 py-2.5">Unallocated Reserve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departmentFinancials.map((row) => (
                  <tr key={row.dept.id}>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {row.dept.name} ({row.dept.code})
                    </td>
                    <td className="px-4 py-2.5">{row.count}</td>
                    <td className="px-4 py-2.5 font-semibold text-gsl-700">
                      {formatCurrency(row.ceiling)}
                    </td>
                    <td className="px-4 py-2.5 font-semibold">
                      {formatCurrency(row.allocated)}
                    </td>
                    <td className="px-4 py-2.5">{formatCurrency(row.spend)}</td>
                    <td
                      className={`px-4 py-2.5 font-semibold ${
                        row.remaining < 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {formatCurrency(row.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Campus Financial Breakdown */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <TrendingUp className="h-4 w-4 text-gsl-700" />
            Campus Financial Allocation Summary
          </h4>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Campus</th>
                  <th className="px-4 py-2.5">Initiatives</th>
                  <th className="px-4 py-2.5">Allocated Budget</th>
                  <th className="px-4 py-2.5">Actual Spend</th>
                  <th className="px-4 py-2.5">Remaining Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campusFinancials.map((row) => (
                  <tr key={row.campus}>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">
                      {row.campus}
                    </td>
                    <td className="px-4 py-2.5">{row.count}</td>
                    <td className="px-4 py-2.5 font-semibold">
                      {formatCurrency(row.budget)}
                    </td>
                    <td className="px-4 py-2.5">{formatCurrency(row.spend)}</td>
                    <td
                      className={`px-4 py-2.5 font-semibold ${
                        row.remaining < 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {formatCurrency(row.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* High / Critical Risks */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            Open High &amp; Critical Risks ({scopedRisks.length})
          </h4>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {scopedRisks.length === 0 ? (
              <p className="p-4 text-xs text-slate-400">
                No open High/Critical risks in this scope.
              </p>
            ) : (
              scopedRisks.map((r) => {
                const proj = projects.find((p) => p.id === r.project_id);
                return (
                  <div key={r.id} className="p-3.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={r.severity} />
                      <DepartmentBadge name={getDepartmentName(r.department_id)} />
                      <span className="font-mono font-bold text-gsl-700">
                        {proj?.project_code}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {r.description}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-500">
                      Mitigation: {r.mitigation_plan} • Owner: {r.risk_owner}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Open Leadership Decisions */}
        <div>
          <h4 className="mb-3 text-sm font-bold text-slate-900">
            Pending Leadership Decisions ({scopedActions.length})
          </h4>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {scopedActions.length === 0 ? (
              <p className="p-4 text-xs text-slate-400">No open actions in this scope.</p>
            ) : (
              scopedActions.map((a) => {
                const proj = projects.find((p) => p.id === a.project_id);
                return (
                  <div key={a.id} className="p-3.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <ActionStatusBadge status={a.status} />
                      <DepartmentBadge name={getDepartmentName(a.department_id)} />
                      <span className="font-mono font-bold text-gsl-700">
                        {proj?.project_code}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {a.decision_required}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-500">
                      Decision Owner: {a.decision_owner} • Due:{' '}
                      {formatDate(a.due_date)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Portfolio Summary Table */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">
              Portfolio Schedule &amp; Budget Ledger ({scopedProjects.length})
            </h4>
            <button
              type="button"
              onClick={handleExportBoardCsv}
              className="no-print inline-flex items-center gap-1 text-xs font-semibold text-gsl-700 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Download Table CSV
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Initiative</th>
                  <th className="px-3 py-2.5">Campus</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">%</th>
                  <th className="px-3 py-2.5">Budget</th>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5">Next Milestone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopedProjects.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2.5 font-mono font-bold text-gsl-700">
                      {p.project_code}
                    </td>
                    <td className="px-3 py-2.5">
                      <DepartmentBadge name={getDepartmentName(p.department_id)} />
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      {p.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <CampusBadge campus={p.campus} />
                    </td>
                    <td className="px-3 py-2.5">
                      <RagBadge status={p.rag_status} />
                    </td>
                    <td className="px-3 py-2.5 font-semibold">
                      {p.percent_complete}%
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {formatCurrency(p.approved_budget)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold">
                      {p.priority_score.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{p.next_milestone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

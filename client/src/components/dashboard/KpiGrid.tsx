import React from 'react';
import {
  Activity,
  Banknote,
  CalendarClock,
  ClipboardList,
  FolderCheck,
  Landmark,
  Layers,
  PiggyBank,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { KpiMetricKey, PortfolioKpis } from '../../types/portfolio';

interface KpiGridProps {
  kpis: PortfolioKpis;
  onSelectKpi: (metric: KpiMetricKey) => void;
}

export const KpiGrid: React.FC<KpiGridProps> = ({ kpis, onSelectKpi }) => {
  const utilization =
    kpis.allocatedBudget > 0
      ? Math.round((kpis.totalActualSpend / kpis.allocatedBudget) * 100)
      : 0;

  const statusBreakdown: Array<{
    key: KpiMetricKey;
    meaning: string;
    count: number;
    containerClass: string;
    dotClass: string;
    textClass: string;
  }> = [
    {
      key: 'completed',
      meaning: 'Completed',
      count: kpis.completedProjects,
      containerClass:
        'border-blue-200 bg-blue-50/80 hover:border-blue-400 hover:bg-blue-100/80',
      dotClass: 'bg-blue-600',
      textClass: 'text-blue-800',
    },
    {
      key: 'on_track',
      meaning: 'On Track',
      count: kpis.onTrackProjects,
      containerClass:
        'border-emerald-200 bg-emerald-50/80 hover:border-emerald-400 hover:bg-emerald-100/80',
      dotClass: 'bg-emerald-600',
      textClass: 'text-emerald-800',
    },
    {
      key: 'attention_needed',
      meaning: 'Attention Needed',
      count: kpis.attentionNeededProjects,
      containerClass:
        'border-amber-200 bg-amber-50/80 hover:border-amber-400 hover:bg-amber-100/80',
      dotClass: 'bg-amber-500',
      textClass: 'text-amber-800',
    },
    {
      key: 'at_risk',
      meaning: 'Critical / At Risk',
      count: kpis.criticalProjects,
      containerClass:
        'border-red-200 bg-red-50/80 hover:border-red-400 hover:bg-red-100/80',
      dotClass: 'bg-red-600',
      textClass: 'text-red-800',
    },
  ];

  const renderStandardCard = (card: {
    key: KpiMetricKey;
    label: string;
    value: string;
    subtext: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    spanClass?: string;
  }) => {
    const Icon = card.icon;
    return (
      <button
        key={card.key}
        type="button"
        onClick={() => onSelectKpi(card.key)}
        className={`group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-gsl-600 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gsl-600/30 ${
          card.spanClass ?? ''
        }`}
      >
        <div className="flex w-full items-start justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-gsl-700">
            {card.label}
          </span>
          <span className={`rounded-xl border p-2 ${card.accent}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 w-full">
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            {card.value}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-slate-500" title={card.subtext}>
              {card.subtext}
            </p>
            <span className="shrink-0 text-[11px] font-semibold text-gsl-700 opacity-0 transition group-hover:opacity-100">
              Drill down →
            </span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {renderStandardCard({
        key: 'total_projects',
        label: 'Total Projects',
        value: String(kpis.totalProjects),
        subtext: 'Initiatives in active scope',
        icon: FolderCheck,
        accent: 'bg-gsl-50 text-gsl-700 border-gsl-200',
      })}

      {/* Unified Project Status Breakdown Card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectKpi('total_projects')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectKpi('total_projects');
          }
        }}
        className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-gsl-600 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gsl-600/30 sm:col-span-2"
      >
        <div className="flex w-full items-start justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 group-hover:text-gsl-700">
              Project Status Breakdown
            </span>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Click any status pill below to drill into those projects
            </p>
          </div>
          <span className="rounded-xl border border-gsl-200 bg-gsl-50 p-2 text-gsl-700">
            <Layers className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {statusBreakdown.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectKpi(item.key);
              }}
              className={`flex flex-col justify-between rounded-xl border px-3 py-2 text-left transition ${item.containerClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dotClass}`} />
                <span className={`text-lg font-extrabold leading-none ${item.textClass}`}>
                  {item.count}
                </span>
              </div>
              <span className={`mt-1.5 text-xs font-semibold leading-tight ${item.textClass}`}>
                {item.meaning}
              </span>
            </button>
          ))}
        </div>
      </div>

      {renderStandardCard({
        key: 'avg_percent_complete',
        label: 'Avg % Complete',
        value: `${kpis.avgPercentComplete}%`,
        subtext: 'Portfolio delivery average',
        icon: Activity,
        accent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      })}

      {renderStandardCard({
        key: 'department_budget_ceiling',
        label: 'Dept Budget Ceiling',
        value: formatCurrency(kpis.departmentBudgetCeiling, true),
        subtext: 'Super Admin approved ceiling',
        icon: Landmark,
        accent: 'bg-gsl-50 text-gsl-700 border-gsl-200',
      })}

      {renderStandardCard({
        key: 'allocated_budget',
        label: 'Projects Allocated',
        value: formatCurrency(kpis.allocatedBudget, true),
        subtext: formatCurrency(kpis.allocatedBudget),
        icon: Wallet,
        accent: 'bg-slate-100 text-slate-700 border-slate-200',
      })}

      {renderStandardCard({
        key: 'actual_spend',
        label: 'Actual Spend',
        value: formatCurrency(kpis.totalActualSpend, true),
        subtext: `${utilization}% of allocated budget`,
        icon: Banknote,
        accent: 'bg-slate-100 text-slate-700 border-slate-200',
      })}

      {renderStandardCard({
        key: 'remaining_budget',
        label: 'Remaining Budget',
        value: formatCurrency(kpis.remainingBudget, true),
        subtext:
          kpis.remainingBudget < 0 ? 'Over budget variance' : 'Unspent project allocation',
        icon: PiggyBank,
        accent:
          kpis.remainingBudget < 0
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      })}

      {renderStandardCard({
        key: 'behind_schedule',
        label: 'Behind Schedule',
        value: String(kpis.behindScheduleProjects),
        subtext: 'Delayed vs. target schedule',
        icon: CalendarClock,
        accent:
          kpis.behindScheduleProjects > 0
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      })}

      {renderStandardCard({
        key: 'open_risks',
        label: 'Open Risks',
        value: String(kpis.openRisks),
        subtext: `${kpis.openHighCriticalRisks} Critical / High severity`,
        icon: ShieldAlert,
        accent:
          kpis.openHighCriticalRisks > 0
            ? 'bg-orange-50 text-orange-700 border-orange-200'
            : 'bg-slate-100 text-slate-700 border-slate-200',
      })}

      {renderStandardCard({
        key: 'open_actions',
        label: 'Open Leadership Actions',
        value: String(kpis.openLeadershipActions),
        subtext: `${kpis.overdueLeadershipActions} overdue decisions`,
        icon: ClipboardList,
        accent:
          kpis.overdueLeadershipActions > 0
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-amber-50 text-amber-700 border-amber-200',
        spanClass: 'sm:col-span-2',
      })}
    </div>
  );
};

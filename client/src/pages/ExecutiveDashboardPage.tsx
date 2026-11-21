import React, { useMemo, useState } from 'react';
import { Building2, CalendarCheck2, Filter, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DepartmentBudgetChart } from '../components/dashboard/DepartmentBudgetChart';
import { KpiDrillDownModal } from '../components/dashboard/KpiDrillDownModal';
import { KpiGrid } from '../components/dashboard/KpiGrid';
import { OverdueActionsTable } from '../components/dashboard/OverdueActionsTable';
import { ProjectsByCampusChart } from '../components/dashboard/ProjectsByCampusChart';
import { ProjectsByCategoryChart } from '../components/dashboard/ProjectsByCategoryChart';
import { RagDistributionChart } from '../components/dashboard/RagDistributionChart';
import { TopRisksTable } from '../components/dashboard/TopRisksTable';
import { UpcomingMilestonesCard } from '../components/dashboard/UpcomingMilestonesCard';
import { PortfolioTable } from '../components/portfolio/PortfolioTable';
import { RagLegend } from '../components/ui/Badges';
import { GslLogo } from '../components/ui/GslLogo';
import { useAuth } from '../context/AuthContext';
import { usePortfolio } from '../context/PortfolioContext';
import {
  CAMPUSES,
  computePortfolioKpis,
  GOVERNANCE_META,
} from '../lib/formatters';
import { Campus, KpiMetricKey } from '../types/portfolio';

export const ExecutiveDashboardPage: React.FC = () => {
  const {
    role,
    isOrgWide,
    canEditProject,
    canDeleteProject,
    canViewBudgets,
    profile,
  } = useAuth();
  const {
    departments,
    budgets,
    projects,
    risks,
    actions,
    loading,
    selectedDepartmentId,
    setSelectedDepartmentId,
    activeDepartment,
    getDepartmentName,
    updateProjectInline,
  } = usePortfolio();

  const [selectedKpi, setSelectedKpi] = useState<KpiMetricKey | null>(null);
  const [campusFilter, setCampusFilter] = useState<Campus | 'ALL'>('ALL');

  const isOwnerScoped = role === 'Project Owner';

  const filteredProjects = useMemo(() => {
    if (campusFilter === 'ALL') return projects;
    return projects.filter(
      (p) => p.campus === campusFilter || p.campus === 'All Campuses'
    );
  }, [projects, campusFilter]);

  const filteredProjectIds = useMemo(
    () => new Set(filteredProjects.map((p) => p.id)),
    [filteredProjects]
  );

  const filteredRisks = useMemo(
    () => risks.filter((r) => filteredProjectIds.has(r.project_id)),
    [risks, filteredProjectIds]
  );

  const filteredActions = useMemo(
    () => actions.filter((a) => filteredProjectIds.has(a.project_id)),
    [actions, filteredProjectIds]
  );

  const visibleBudgets = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return budgets;
    return budgets.filter((b) => b.department_id === selectedDepartmentId);
  }, [budgets, selectedDepartmentId]);

  const dashboardKpis = useMemo(
    () =>
      computePortfolioKpis(
        filteredProjects,
        filteredRisks,
        filteredActions,
        visibleBudgets
      ),
    [filteredProjects, filteredRisks, filteredActions, visibleBudgets]
  );

  const activeDepartmentLabel = activeDepartment
    ? activeDepartment.name
    : 'Enterprise Portfolio (All Departments)';

  return (
    <div className="space-y-6">
      {/* 1. GSL Enterprise Header & Governance Cadence */}
      <section className="rounded-2xl border border-gsl-700/15 bg-gradient-to-r from-gsl-700 via-gsl-600 to-slate-800 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <GslLogo className="h-12 w-12 shrink-0" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                  {GOVERNANCE_META.organization} • {activeDepartmentLabel}
                </span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {GOVERNANCE_META.version}
                </span>
              </div>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight">
                {isOwnerScoped
                  ? 'My Assigned Projects — Portfolio Snapshot'
                  : activeDepartment
                  ? `${activeDepartment.name} — Portfolio Health Snapshot`
                  : 'Enterprise Portfolio Health & Department Summary'}
              </h2>
              <p className="mt-0.5 text-xs text-emerald-100/85">
                {activeDepartment?.description || `Owner: ${GOVERNANCE_META.owner}`} • Review Date:{' '}
                {GOVERNANCE_META.reviewDate}
              </p>
            </div>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            {canViewBudgets && (
              <Link
                to="/budgets"
                className="rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                Department Budgets
              </Link>
            )}
            {!isOwnerScoped && (
              <Link
                to="/reports"
                className="rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                Board Reports
              </Link>
            )}
            <Link
              to="/projects"
              className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-gsl-800 shadow-sm transition hover:bg-emerald-50"
            >
              {isOwnerScoped ? 'Open My Projects Tracker' : 'Open Master Portfolio'}
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-white/15 pt-4 md:grid-cols-3">
          {GOVERNANCE_META.cadence.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-2.5 rounded-xl bg-white/10 px-3.5 py-2.5"
            >
              <CalendarCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
              <div>
                <p className="text-xs font-semibold text-white">{item.label}</p>
                <p className="text-[11px] text-emerald-100/80">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Global Scope Bar: Department Selector & Campus Filter */}
      <section className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gsl-700" />
            <span className="text-xs font-semibold text-slate-600">Department:</span>
            {isOrgWide ? (
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                aria-label="Select Department Scope"
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-gsl-600 focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Departments ({departments.length})</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gsl-50 px-3 py-1 text-xs font-semibold text-gsl-800 ring-1 ring-inset ring-gsl-600/20">
                {activeDepartment?.name ?? 'Assigned Department'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">Campus:</span>
            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value as Campus | 'ALL')}
              aria-label="Filter Dashboard by Campus"
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-gsl-600 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Campuses</option>
              {CAMPUSES.map((campus) => (
                <option key={campus} value={campus}>
                  {campus}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Showing <strong className="text-slate-900">{filteredProjects.length}</strong>{' '}
          project(s) • <strong className="text-slate-900">{filteredRisks.length}</strong>{' '}
          risk(s) • <strong className="text-slate-900">{filteredActions.length}</strong>{' '}
          action(s)
        </p>
      </section>

      {isOwnerScoped && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900 shadow-sm">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 shrink-0 text-blue-700" />
            <span>
              <strong>Project Owner Scope:</strong> All portfolio views are filtered to
              the <strong>{filteredProjects.length}</strong> project(s) assigned to{' '}
              <strong>{profile?.full_name}</strong> or shared with your department.
            </span>
          </div>
          <Link to="/projects" className="font-semibold text-blue-700 hover:underline">
            Filter &amp; export my projects →
          </Link>
        </div>
      )}

      {loading && projects.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Loading portfolio metrics...
        </div>
      ) : (
        <>
          {/* 2. Clickable Executive KPIs & Status Key */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500">
                Click any KPI card below to open its detailed drill-down report &amp; export.
              </p>
            </div>
            <KpiGrid kpis={dashboardKpis} onSelectKpi={setSelectedKpi} />
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
              <RagLegend />
            </div>
          </section>

          {/* 3. Visual Analytics */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <RagDistributionChart projects={filteredProjects} />
            <ProjectsByCampusChart projects={filteredProjects} />
            <ProjectsByCategoryChart projects={filteredProjects} />
          </section>

          {isOrgWide && (
            <section>
              <DepartmentBudgetChart
                departments={activeDepartment ? [activeDepartment] : departments}
                budgets={visibleBudgets}
                projects={filteredProjects}
              />
            </section>
          )}

          {/* 4. Surfaced Governance Tables */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <TopRisksTable risks={filteredRisks} projects={filteredProjects} />
            <OverdueActionsTable actions={filteredActions} projects={filteredProjects} />
          </section>

          <section>
            <UpcomingMilestonesCard projects={filteredProjects} />
          </section>

          {/* 5. Detailed Portfolio Tracker */}
          <section className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isOwnerScoped
                    ? 'My Assigned Projects Tracker'
                    : activeDepartment
                    ? `${activeDepartment.name} Project Tracker`
                    : 'Enterprise Project Tracker'}
                </h3>
                <p className="text-xs text-slate-500">
                  Ranked by weighted Priority Score (Impact 35%, Strategic 30%, Urgency
                  20%, Risk 15%).
                </p>
              </div>
              <Link
                to="/projects"
                className="text-xs font-semibold text-gsl-700 hover:underline"
              >
                {isOwnerScoped ? 'Open My Projects Tracker →' : 'Open Master Portfolio →'}
              </Link>
            </div>

            <PortfolioTable
              projects={filteredProjects}
              canEditRow={canEditProject}
              canDeleteRow={canDeleteProject}
              getDepartmentName={getDepartmentName}
              currentUserId={profile?.id}
              currentUserDepartmentId={profile?.department_id}
              onInlineUpdate={updateProjectInline}
            />
          </section>
        </>
      )}

      <KpiDrillDownModal
        metric={selectedKpi}
        departments={departments}
        budgets={visibleBudgets}
        projects={filteredProjects}
        risks={filteredRisks}
        actions={filteredActions}
        getDepartmentName={getDepartmentName}
        onClose={() => setSelectedKpi(null)}
      />
    </div>
  );
};

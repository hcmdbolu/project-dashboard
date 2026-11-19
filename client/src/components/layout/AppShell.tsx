import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  FileBarChart2,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { DEMO_USERS } from '../../data/demoData';
import { GOVERNANCE_META } from '../../lib/formatters';
import { DepartmentBadge, RoleBadge } from '../ui/Badges';
import { GslLogo } from '../ui/GslLogo';
import { ToastContainer } from '../ui/ToastContainer';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Executive Portfolio Dashboard',
  '/projects': 'Master Portfolio Tracker',
  '/governance': 'Risks & Leadership Action Register',
  '/budgets': 'Department Budget Approvals',
  '/reports': 'Reports & Board Pack',
  '/admin/users': 'User Management (RBAC)',
  '/admin/departments': 'Departments Management',
};

export const AppShell: React.FC = () => {
  const {
    profile,
    role,
    departmentId,
    canManageUsers,
    canManageDepartments,
    canViewBudgets,
    isDemoMode,
    signOut,
    setDemoUserById,
  } = useAuth();
  const {
    realtimeConnected,
    refreshAll,
    loading,
    activeDepartment,
    getDepartmentName,
  } = usePortfolio();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentTitle =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith('/projects/')
      ? 'Project Charter & Audit Trail'
      : 'GSL Enterprise Portfolio');

  const userDeptName = departmentId ? getDepartmentName(departmentId) : 'All Departments';
  const activeScopeName = activeDepartment
    ? `${activeDepartment.name} Department`
    : 'All Departments';

  const navItems = [
    { to: '/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { to: '/projects', label: 'Master Portfolio', icon: FolderKanban },
    { to: '/governance', label: 'Risks & Actions', icon: AlertTriangle },
    ...(canViewBudgets
      ? [{ to: '/budgets', label: 'Department Budgets', icon: PiggyBank }]
      : []),
    ...(role !== 'Project Owner'
      ? [{ to: '/reports', label: 'Reports & Board Pack', icon: FileBarChart2 }]
      : []),
    ...(canManageUsers
      ? [{ to: '/admin/users', label: 'User Management', icon: Users }]
      : []),
    ...(canManageDepartments
      ? [{ to: '/admin/departments', label: 'Departments', icon: Building2 }]
      : []),
  ];

  const SidebarContent = (
    <div className="flex h-full flex-col bg-gsl-700 text-white">
      <div className="flex items-center gap-3 border-b border-gsl-600/70 px-5 py-5">
        <GslLogo className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-white/20" />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
            {GOVERNANCE_META.organization}
          </p>
          <h1 className="truncate text-sm font-bold tracking-tight text-white">
            Enterprise Portfolio • {GOVERNANCE_META.version}
          </h1>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gsl-600 text-white shadow-sm ring-1 ring-white/20'
                    : 'text-emerald-100/85 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {isDemoMode && (
        <div className="mx-3 mb-3 rounded-xl border border-emerald-300/30 bg-gsl-800/85 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
            Demo Mode • Test Personas
          </p>
          <label className="mt-1.5 block text-xs text-emerald-100/80" htmlFor="demo-user">
            Active User &amp; Role
          </label>
          <select
            id="demo-user"
            value={profile?.id ?? ''}
            onChange={(e) => setDemoUserById(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gsl-500 bg-gsl-700 px-2.5 py-1.5 text-xs font-medium text-white focus:border-emerald-300 focus:outline-none"
          >
            {DEMO_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.role}: {u.full_name.split(' (')[0]} (
                {u.department_id ? getDepartmentName(u.department_id) : 'All'})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="border-t border-gsl-600/70 p-4 text-[11px] text-emerald-100/80">
        <p className="font-semibold text-white">{GOVERNANCE_META.owner}</p>
        <p className="mt-0.5">Review Date: {GOVERNANCE_META.reviewDate}</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="no-print hidden w-64 shrink-0 lg:block">{SidebarContent}</aside>

      {sidebarOpen && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50 w-64 max-w-xs">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-emerald-100 hover:bg-white/10"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5 lg:hidden">
              <GslLogo className="h-8 w-8 rounded-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                {currentTitle}
              </h2>
              <p className="hidden text-xs text-slate-500 sm:block">
                {GOVERNANCE_META.organization} • {activeScopeName} • Lekki, Ikoyi, Anthos
                &amp; Anthony
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 md:inline-flex"
              title={
                isDemoMode
                  ? 'Running in local preview mode'
                  : realtimeConnected
                    ? 'Connected to Supabase Realtime'
                    : 'Connecting to Supabase Realtime'
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  realtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {isDemoMode ? 'Demo Mode' : realtimeConnected ? 'Live Sync' : 'Syncing'}
            </span>

            <button
              type="button"
              onClick={refreshAll}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              title="Refresh portfolio data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-slate-900">
                  {profile?.full_name || 'GSL User'}
                </p>
              </div>
              <DepartmentBadge name={userDeptName} />
              <RoleBadge role={role} />
            </div>

            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>

        <footer className="no-print border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-gsl-700">
                {GOVERNANCE_META.organization}
              </span>
              <span>•</span>
              <span>{activeScopeName}</span>
              <span>•</span>
              <span>Version {GOVERNANCE_META.version}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Owner: <strong className="text-slate-700">{GOVERNANCE_META.owner}</strong>
              </span>
              <span>•</span>
              <span>
                Review Date:{' '}
                <strong className="text-slate-700">{GOVERNANCE_META.reviewDate}</strong>
              </span>
            </div>
          </div>
        </footer>
      </div>

      <ToastContainer />
    </div>
  );
};

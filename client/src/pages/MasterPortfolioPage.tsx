import React, { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { ExcelImportModal } from '../components/portfolio/ExcelImportModal';
import { PortfolioTable } from '../components/portfolio/PortfolioTable';
import { PortfolioToolbar } from '../components/portfolio/PortfolioToolbar';
import { ProjectDetailDrawer } from '../components/portfolio/ProjectDetailDrawer';
import { ProjectFormModal } from '../components/portfolio/ProjectFormModal';
import { RagLegend } from '../components/ui/Badges';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency, getRagLabel } from '../lib/formatters';
import { Campus, Project, ProjectInput, RagStatus } from '../types/portfolio';

export const MasterPortfolioPage: React.FC = () => {
  const {
    role,
    profile,
    departmentId,
    isSuperAdmin,
    isOrgWide,
    canCreateProject,
    canManageOwnership,
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
    selectedDepartmentId,
    setSelectedDepartmentId,
    activeDepartment,
    getDepartmentName,
    createCategory,
    updateProjectInline,
    createProject,
    updateProject,
    bulkImportProjects,
    deleteProject,
  } = usePortfolio();

  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState<Campus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [ragFilter, setRagFilter] = useState<RagStatus | 'ALL'>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');

  const [drawerProject, setDrawerProject] = useState<Project | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isOwnerScoped = role === 'Project Owner';

  const ownerOptions = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => {
      (p.owner_ids ?? []).forEach((uid, idx) => {
        const label = p.owner_names?.[idx];
        if (uid && label) map.set(uid, label);
      });
      (p.owner_department_ids ?? []).forEach((did, idx) => {
        const deptLabel = p.owner_department_names?.[idx];
        if (did && deptLabel) map.set(`dept:${did}`, `Dept: ${deptLabel}`);
      });
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (campusFilter !== 'ALL' && p.campus !== campusFilter) return false;
      if (categoryFilter !== 'ALL' && p.category_id !== categoryFilter) return false;
      if (ragFilter !== 'ALL' && p.rag_status !== ragFilter) return false;
      if (ownerFilter !== 'ALL') {
        if (ownerFilter.startsWith('dept:')) {
          const deptId = ownerFilter.slice('dept:'.length);
          if (!p.owner_department_ids?.includes(deptId)) return false;
        } else if (!p.owner_ids?.includes(ownerFilter) && p.owner_id !== ownerFilter) {
          return false;
        }
      }
      if (!query) return true;
      return (
        p.project_code.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        p.problem_solved.toLowerCase().includes(query) ||
        p.expected_benefit.toLowerCase().includes(query) ||
        (p.project_manager_name || '').toLowerCase().includes(query) ||
        (p.owner_name || '').toLowerCase().includes(query) ||
        (p.owner_names || []).some((n) => n.toLowerCase().includes(query)) ||
        (p.owner_department_names || []).some((d) => d.toLowerCase().includes(query)) ||
        (p.category || '').toLowerCase().includes(query) ||
        getDepartmentName(p.department_id).toLowerCase().includes(query)
      );
    });
  }, [
    projects,
    campusFilter,
    categoryFilter,
    ragFilter,
    ownerFilter,
    search,
    getDepartmentName,
  ]);

  const filteredBudgetTotal = useMemo(
    () => filtered.reduce((acc, p) => acc + p.approved_budget, 0),
    [filtered]
  );

  const handleOpenAdd = () => {
    setEditingProject(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (project: Project) => {
    setEditingProject(project);
    setModalOpen(true);
  };

  const handleSaveProject = async (payload: ProjectInput): Promise<boolean> => {
    if (editingProject) {
      return updateProject(editingProject.id, payload);
    }
    return createProject(payload);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const ok = await deleteProject(confirmDelete.id);
    setDeleting(false);
    if (ok) {
      if (drawerProject?.id === confirmDelete.id) {
        setDrawerProject(null);
      }
      setConfirmDelete(null);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Project Code',
      'Department',
      'Project Name',
      'Campus',
      'Category',
      'Status',
      '% Complete',
      'Project Manager',
      'Project Co-Owners',
      'Department Owners',
      'Approved Budget (NGN)',
      'Actual Spend (NGN)',
      'Priority Score',
      'Schedule Status',
      'Target End Date',
      'Next Milestone',
    ];
    const rows = filtered.map((p) => [
      p.project_code,
      getDepartmentName(p.department_id),
      p.name,
      p.campus,
      p.category || '',
      getRagLabel(p.rag_status),
      String(p.percent_complete),
      p.project_manager_name || '',
      (p.owner_names ?? []).join('; '),
      (p.owner_department_names ?? []).join('; '),
      String(p.approved_budget),
      String(p.actual_spend),
      p.priority_score.toFixed(2),
      p.schedule_status,
      p.target_end_date,
      p.next_milestone || '',
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gsl-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const defaultImportDeptId = isSuperAdmin
    ? selectedDepartmentId === 'ALL'
      ? null
      : selectedDepartmentId
    : departmentId;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isOwnerScoped
              ? 'My Assigned Projects'
              : activeDepartment
              ? `${activeDepartment.name} — Master Portfolio`
              : 'Enterprise Master Project Portfolio'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isOwnerScoped
              ? 'Scoped to projects assigned to your account. Update progress and status inline.'
              : 'Interactive project tracker with multi-department governance, inline updates, Excel import, and full lifecycle CRUD.'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm">
          <p className="text-[11px] font-medium text-slate-500">Filtered Budget</p>
          <p className="text-sm font-bold text-gsl-700">
            {formatCurrency(filteredBudgetTotal)}
          </p>
        </div>
      </div>

      {isOwnerScoped && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-900">
          <Filter className="h-4 w-4 shrink-0 text-blue-700" />
          <span>
            Displaying the <strong>{projects.length}</strong> project(s) assigned to{' '}
            <strong>{profile?.full_name}</strong> or shared with your department.
          </span>
        </div>
      )}

      <PortfolioToolbar
        search={search}
        onSearchChange={setSearch}
        departmentFilter={selectedDepartmentId}
        onDepartmentFilterChange={setSelectedDepartmentId}
        showDepartmentFilter={isOrgWide}
        departments={departments}
        campusFilter={campusFilter}
        onCampusFilterChange={setCampusFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        ragFilter={ragFilter}
        onRagFilterChange={setRagFilter}
        ownerFilter={ownerFilter}
        onOwnerFilterChange={setOwnerFilter}
        categories={categories}
        owners={ownerOptions}
        canCreate={canCreateProject}
        onAddProject={handleOpenAdd}
        onImportExcel={() => setImportModalOpen(true)}
        onExportCsv={handleExportCsv}
        totalFiltered={filtered.length}
        totalCount={projects.length}
      />

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <RagLegend />
      </div>

      <PortfolioTable
        projects={filtered}
        canEditRow={canEditProject}
        canDeleteRow={canDeleteProject}
        getDepartmentName={getDepartmentName}
        currentUserId={profile?.id}
        currentUserDepartmentId={departmentId}
        onInlineUpdate={updateProjectInline}
        onOpenDrawer={setDrawerProject}
        onEditProject={handleOpenEdit}
        onDeleteProject={setConfirmDelete}
      />

      <ProjectDetailDrawer
        project={drawerProject}
        risks={risks}
        actions={actions}
        departmentName={
          drawerProject ? getDepartmentName(drawerProject.department_id) : ''
        }
        canEdit={drawerProject ? canEditProject(drawerProject) : false}
        onClose={() => setDrawerProject(null)}
        onEditFull={(proj) => {
          setDrawerProject(null);
          handleOpenEdit(proj);
        }}
      />

      <ProjectFormModal
        open={modalOpen}
        initialProject={editingProject}
        departments={departments}
        categories={categories}
        profiles={profiles}
        budgets={budgets}
        allProjects={allVisibleProjects}
        lockedDepartmentId={isSuperAdmin ? null : departmentId}
        canAddCategory={canCreateProject}
        canManageOwnership={canManageOwnership}
        onCreateCategory={createCategory}
        onClose={() => {
          setModalOpen(false);
          setEditingProject(null);
        }}
        onSubmit={handleSaveProject}
      />

      <ExcelImportModal
        open={importModalOpen}
        departments={departments}
        categories={categories}
        defaultDepartmentId={defaultImportDeptId}
        onClose={() => setImportModalOpen(false)}
        onImport={bulkImportProjects}
      />

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title="Delete Project"
        message={`Permanently delete ${confirmDelete?.project_code} (${confirmDelete?.name}) along with its linked risks and leadership actions?`}
        confirmLabel="Delete Project"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

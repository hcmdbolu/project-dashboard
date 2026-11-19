import React from 'react';
import { Download, FileSpreadsheet, Plus, Search, X } from 'lucide-react';
import { CAMPUSES, getRagLabel, RAG_STATUSES } from '../../lib/formatters';
import { Campus, CategoryItem, Department, RagStatus } from '../../types/portfolio';

interface PortfolioToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (val: string) => void;
  showDepartmentFilter: boolean;
  departments: Department[];
  campusFilter: Campus | 'ALL';
  onCampusFilterChange: (val: Campus | 'ALL') => void;
  categoryFilter: string;
  onCategoryFilterChange: (val: string) => void;
  ragFilter: RagStatus | 'ALL';
  onRagFilterChange: (val: RagStatus | 'ALL') => void;
  ownerFilter: string;
  onOwnerFilterChange: (val: string) => void;
  categories: CategoryItem[];
  owners: Array<{ id: string; name: string }>;
  canCreate: boolean;
  onAddProject: () => void;
  onImportExcel: () => void;
  onExportCsv: () => void;
  totalFiltered: number;
  totalCount: number;
}

export const PortfolioToolbar: React.FC<PortfolioToolbarProps> = ({
  search,
  onSearchChange,
  departmentFilter,
  onDepartmentFilterChange,
  showDepartmentFilter,
  departments,
  campusFilter,
  onCampusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  ragFilter,
  onRagFilterChange,
  ownerFilter,
  onOwnerFilterChange,
  categories,
  owners,
  canCreate,
  onAddProject,
  onImportExcel,
  onExportCsv,
  totalFiltered,
  totalCount,
}) => {
  const hasFilters =
    search !== '' ||
    (showDepartmentFilter && departmentFilter !== 'ALL') ||
    campusFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    ragFilter !== 'ALL' ||
    ownerFilter !== 'ALL';

  const resetFilters = () => {
    onSearchChange('');
    if (showDepartmentFilter) onDepartmentFilterChange('ALL');
    onCampusFilterChange('ALL');
    onCategoryFilterChange('ALL');
    onRagFilterChange('ALL');
    onOwnerFilterChange('ALL');
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[210px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search code, name, PM, owner..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-gsl-600 focus:bg-white focus:outline-none"
            />
          </div>

          {showDepartmentFilter && (
            <select
              value={departmentFilter}
              onChange={(e) => onDepartmentFilterChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-gsl-600 focus:outline-none"
              aria-label="Filter by department"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={campusFilter}
            onChange={(e) => onCampusFilterChange(e.target.value as Campus | 'ALL')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-gsl-600 focus:outline-none"
            aria-label="Filter by campus"
          >
            <option value="ALL">All Campuses (Filter)</option>
            {CAMPUSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-gsl-600 focus:outline-none"
            aria-label="Filter by category"
          >
            <option value="ALL">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={ragFilter}
            onChange={(e) => onRagFilterChange(e.target.value as RagStatus | 'ALL')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-gsl-600 focus:outline-none"
            aria-label="Filter by project status"
          >
            <option value="ALL">All Project Statuses</option>
            {RAG_STATUSES.map((rag) => (
              <option key={rag} value={rag}>
                {getRagLabel(rag)}
              </option>
            ))}
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => onOwnerFilterChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-gsl-600 focus:outline-none"
            aria-label="Filter by owner"
          >
            <option value="ALL">All Owners</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            Showing {totalFiltered} of {totalCount}
          </span>

          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>

          {canCreate && (
            <>
              <button
                type="button"
                onClick={onImportExcel}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gsl-600 bg-gsl-50 px-3 py-2 text-xs font-semibold text-gsl-700 transition hover:bg-gsl-100"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Import Excel
              </button>

              <button
                type="button"
                onClick={onAddProject}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gsl-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-gsl-800"
              >
                <Plus className="h-4 w-4" />
                New Project
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

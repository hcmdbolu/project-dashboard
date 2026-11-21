import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  formatCurrency,
  formatDate,
  hasUnconfirmedOwnership,
  isProjectBehindSchedule,
} from '../../lib/formatters';
import { Project, RagStatus } from '../../types/portfolio';
import {
  CampusBadge,
  DepartmentBadge,
  ProcurementBadge,
  ScheduleBadge,
} from '../ui/Badges';
import { InlinePercentEditor } from './InlinePercentEditor';
import { InlineRagSelect } from './InlineRagSelect';

type SortField =
  | 'project_code'
  | 'name'
  | 'priority_score'
  | 'percent_complete'
  | 'approved_budget'
  | 'target_end_date';

interface PortfolioTableProps {
  projects: Project[];
  canEditRow: (project: Project) => boolean;
  canDeleteRow: (project: Project) => boolean;
  getDepartmentName: (deptId: string | null | undefined) => string;
  currentUserId?: string;
  currentUserDepartmentId?: string | null;
  onInlineUpdate: (
    id: string,
    patch: Partial<Pick<Project, 'percent_complete' | 'rag_status' | 'schedule_status'>>
  ) => Promise<boolean>;
  onOpenDrawer?: (project: Project) => void;
  onEditProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
}

export const PortfolioTable: React.FC<PortfolioTableProps> = ({
  projects,
  canEditRow,
  canDeleteRow,
  getDepartmentName,
  currentUserId,
  currentUserDepartmentId,
  onInlineUpdate,
  onOpenDrawer,
  onEditProject,
  onDeleteProject,
}) => {
  const [sortField, setSortField] = useState<SortField>('priority_score');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(
        field === 'project_code' || field === 'name' || field === 'target_end_date'
      );
    }
  };

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [projects, sortAsc, sortField]);

  const SortButton: React.FC<{ field: SortField; label: string }> = ({ field, label }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900"
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs">
            <tr>
              <th className="whitespace-nowrap px-4 py-3.5">
                <SortButton field="project_code" label="Project" />
              </th>
              <th className="whitespace-nowrap px-4 py-3.5 font-semibold uppercase tracking-wide text-slate-500">
                Dept, Campus &amp; Category
              </th>
              <th className="whitespace-nowrap px-4 py-3.5 font-semibold uppercase tracking-wide text-slate-500">
                Ownership
              </th>
              <th className="whitespace-nowrap px-4 py-3.5">
                <SortButton field="percent_complete" label="% Complete" />
              </th>
              <th className="whitespace-nowrap px-4 py-3.5 font-semibold uppercase tracking-wide text-slate-500">
                Status &amp; Schedule
              </th>
              <th className="whitespace-nowrap px-4 py-3.5 text-right">
                <SortButton field="priority_score" label="Priority" />
              </th>
              <th className="whitespace-nowrap px-4 py-3.5 text-right">
                <SortButton field="approved_budget" label="Budget &amp; Procurement" />
              </th>
              <th className="whitespace-nowrap px-4 py-3.5">
                <SortButton field="target_end_date" label="Target / Milestone" />
              </th>
              <th className="whitespace-nowrap px-4 py-3.5 text-right font-semibold uppercase tracking-wide text-slate-500">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sortedProjects.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                  No projects match the current filters.
                </td>
              </tr>
            ) : (
              sortedProjects.map((project) => {
                const editable = canEditRow(project);
                const deletable = canDeleteRow(project);
                const isOwnProject =
                  Boolean(currentUserId) &&
                  (project.owner_ids?.includes(currentUserId!) ||
                    project.owner_id === currentUserId);
                const isDeptShared =
                  Boolean(currentUserDepartmentId) &&
                  project.owner_department_ids?.includes(currentUserDepartmentId!) &&
                  project.department_id !== currentUserDepartmentId;
                const ownerNames = project.owner_names ?? [];
                const deptOwnerNames = project.owner_department_names ?? [];
                const remaining = project.approved_budget - project.actual_spend;
                const overBudget = remaining < 0;
                const behindSchedule = isProjectBehindSchedule(project);
                const unconfirmedOwner = hasUnconfirmedOwnership(project);

                return (
                  <tr key={project.id} className="transition hover:bg-slate-50/75">
                    <td className="min-w-[220px] max-w-xs px-4 py-3.5 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          to={`/projects/${project.id}`}
                          className="font-mono text-xs font-semibold text-gsl-700 hover:underline"
                        >
                          {project.project_code}
                        </Link>
                        {isOwnProject && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                            Assigned to You
                          </span>
                        )}
                        {!isOwnProject && isDeptShared && (
                          <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                            Dept Shared
                          </span>
                        )}
                        {behindSchedule && (
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            Behind
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenDrawer?.(project)}
                        className="mt-0.5 block text-left font-semibold text-slate-900 hover:text-gsl-700"
                      >
                        {project.name}
                      </button>
                      {project.expected_benefit && (
                        <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">
                          {project.expected_benefit}
                        </p>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1">
                          <DepartmentBadge name={getDepartmentName(project.department_id)} />
                          <CampusBadge campus={project.campus} />
                        </div>
                        <span className="text-xs text-slate-600">{project.category}</span>
                      </div>
                    </td>

                    <td className="min-w-[205px] px-4 py-3.5 align-top text-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        {ownerNames.length > 0 ? (
                          <>
                            {ownerNames.slice(0, 2).map((name, idx) => (
                              <span
                                key={`${project.id}-owner-${idx}`}
                                className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800 ring-1 ring-inset ring-blue-200"
                              >
                                {name}
                              </span>
                            ))}
                            {ownerNames.length > 2 && (
                              <span
                                title={ownerNames.slice(2).join(', ')}
                                className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                              >
                                +{ownerNames.length - 2} more
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="font-semibold text-slate-500">
                            Owner: Unassigned
                          </span>
                        )}
                      </div>
                      {deptOwnerNames.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {deptOwnerNames.map((deptName, idx) => (
                            <span
                              key={`${project.id}-dept-owner-${idx}`}
                              title="Department-wide view access"
                              className="inline-flex items-center rounded-md bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 ring-1 ring-inset ring-teal-200"
                            >
                              Dept: {deptName}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 text-slate-600">PM: {project.project_manager_name}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        Tech: {project.technical_lead_name}
                      </p>
                      {unconfirmedOwner && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          <AlertTriangle className="h-3 w-3" />
                          Confirm ownership
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 align-top">
                      <InlinePercentEditor
                        value={project.percent_complete}
                        canEdit={editable}
                        onCommit={(val) =>
                          onInlineUpdate(project.id, { percent_complete: val })
                        }
                      />
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 align-top">
                      <div className="flex flex-col items-start gap-1.5">
                        <InlineRagSelect
                          value={project.rag_status}
                          canEdit={editable}
                          onCommit={(rag: RagStatus) =>
                            onInlineUpdate(project.id, { rag_status: rag })
                          }
                        />
                        <ScheduleBadge status={project.schedule_status} />
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 text-right align-top">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                        {Number(project.priority_score).toFixed(2)}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 text-right align-top">
                      <p className="text-xs font-semibold text-slate-900">
                        {formatCurrency(project.approved_budget, true)}
                      </p>
                      <p
                        className={`text-[11px] ${
                          overBudget ? 'font-semibold text-red-600' : 'text-slate-500'
                        }`}
                      >
                        Rem: {formatCurrency(remaining, true)}
                      </p>
                      <div className="mt-1">
                        <ProcurementBadge status={project.procurement_status} />
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 align-top text-xs">
                      <p
                        className={`font-semibold ${
                          behindSchedule ? 'text-red-600' : 'text-slate-700'
                        }`}
                      >
                        {formatDate(project.target_end_date)}
                      </p>
                      {project.next_milestone && (
                        <p className="max-w-[140px] truncate text-[11px] text-slate-500">
                          {project.next_milestone}
                        </p>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 text-right align-top">
                      <div className="inline-flex items-center gap-1">
                        {onOpenDrawer && (
                          <button
                            type="button"
                            onClick={() => onOpenDrawer(project)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-gsl-700"
                            title="Open Project Detail Drawer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {editable && onEditProject && (
                          <button
                            type="button"
                            onClick={() => onEditProject(project)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                            title="Edit full project details"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {deletable && onDeleteProject && (
                          <button
                            type="button"
                            onClick={() => onDeleteProject(project)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Delete project"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

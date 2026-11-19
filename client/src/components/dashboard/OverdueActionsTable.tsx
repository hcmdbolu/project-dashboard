import React, { useMemo } from 'react';
import { ArrowUpRight, ClockAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate, isPastDue } from '../../lib/formatters';
import { LeadershipAction, Project } from '../../types/portfolio';
import { ActionStatusBadge } from '../ui/Badges';

interface OverdueActionsTableProps {
  actions: LeadershipAction[];
  projects: Project[];
}

export const OverdueActionsTable: React.FC<OverdueActionsTableProps> = ({
  actions,
  projects,
}) => {
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const surfacedActions = useMemo(() => {
    return actions
      .filter((a) => a.status !== 'Closed')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 6);
  }, [actions]);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-amber-50 p-1.5 text-amber-600">
            <ClockAlert className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Pending &amp; Overdue Leadership Actions
            </h3>
            <p className="text-xs text-slate-500">
              Executive decisions requiring sign-off
            </p>
          </div>
        </div>
        <Link
          to="/governance"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gsl-700 hover:text-gsl-800"
        >
          Action Register <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Decision Required &amp; Impact</th>
              <th className="px-4 py-3">Decision Owner</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {surfacedActions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  No open leadership actions.
                </td>
              </tr>
            ) : (
              surfacedActions.map((action) => {
                const project = projectMap.get(action.project_id);
                const overdue = action.status === 'Overdue' || isPastDue(action.due_date);
                return (
                  <tr key={action.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      {project ? (
                        <Link
                          to={`/projects/${project.id}`}
                          className="font-mono text-xs font-semibold text-gsl-700 hover:underline"
                        >
                          {project.project_code}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {project && (
                        <p className="max-w-[130px] truncate text-xs text-slate-500">
                          Req by: {action.required_by}
                        </p>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 align-top text-xs leading-relaxed text-slate-800">
                      <p className="font-medium">{action.decision_required}</p>
                      {action.impact_if_delayed && (
                        <p className="mt-1 text-[11px] text-red-700">
                          Impact if delayed: {action.impact_if_delayed}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs font-medium text-slate-700">
                      {action.decision_owner}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 align-top text-xs font-semibold ${
                        overdue ? 'text-red-700' : 'text-slate-700'
                      }`}
                    >
                      {formatDate(action.due_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <ActionStatusBadge
                        status={overdue ? 'Overdue' : action.status}
                      />
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

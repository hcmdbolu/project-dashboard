import React, { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate, isPastDue } from '../../lib/formatters';
import { Project } from '../../types/portfolio';
import { CampusBadge, RagBadge } from '../ui/Badges';

interface UpcomingMilestonesCardProps {
  projects: Project[];
}

export const UpcomingMilestonesCard: React.FC<UpcomingMilestonesCardProps> = ({
  projects,
}) => {
  const milestones = useMemo(() => {
    return projects
      .filter((p) => p.rag_status !== 'Blue' && p.percent_complete < 100)
      .map((p) => ({
        project: p,
        date: p.milestone_due_date || p.target_end_date,
        label: p.next_milestone || 'Target Project Delivery',
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [projects]);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-gsl-50 p-1.5 text-gsl-700">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Upcoming Milestones</h3>
            <p className="text-xs text-slate-500">
              Chronological delivery checkpoints across active initiatives
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {milestones.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            All active milestones are completed.
          </p>
        ) : (
          milestones.map(({ project, date, label }) => {
            const late = isPastDue(date);
            return (
              <div
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/75"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/projects/${project.id}`}
                      className="font-mono text-xs font-semibold text-gsl-700 hover:underline"
                    >
                      {project.project_code}
                    </Link>
                    <CampusBadge campus={project.campus} />
                    <span className="truncate text-xs font-semibold text-slate-900">
                      {label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {project.name} • PM: {project.project_manager_name}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-semibold ${
                      late ? 'text-red-600' : 'text-slate-700'
                    }`}
                  >
                    {formatDate(date)}
                    {late ? ' (Past Due)' : ''}
                  </span>
                  <RagBadge status={project.rag_status} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

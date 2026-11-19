import React, { useMemo } from 'react';
import { ArrowUpRight, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Project, Risk } from '../../types/portfolio';
import { RiskStatusBadge, SeverityBadge } from '../ui/Badges';

interface TopRisksTableProps {
  risks: Risk[];
  projects: Project[];
}

const SEVERITY_RANK: Record<Risk['severity'], number> = {
  Critical: 1,
  High: 2,
  Medium: 3,
  Low: 4,
};

export const TopRisksTable: React.FC<TopRisksTableProps> = ({ risks, projects }) => {
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const topRisks = useMemo(() => {
    return risks
      .filter(
        (r) =>
          r.status !== 'Closed' && (r.severity === 'Critical' || r.severity === 'High')
      )
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
      .slice(0, 5);
  }, [risks]);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-red-50 p-1.5 text-red-600">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Top 5 Critical / High Risks
            </h3>
            <p className="text-xs text-slate-500">
              Active high-impact risks and mitigation plans
            </p>
          </div>
        </div>
        <Link
          to="/governance"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gsl-700 hover:text-gsl-800"
        >
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Risk &amp; Mitigation</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topRisks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  No open Critical or High risks.
                </td>
              </tr>
            ) : (
              topRisks.map((risk) => {
                const project = projectMap.get(risk.project_id);
                return (
                  <tr key={risk.id} className="hover:bg-slate-50/80">
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
                        <p className="max-w-[140px] truncate text-xs text-slate-500">
                          {project.name}
                        </p>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 align-top text-xs leading-relaxed text-slate-700">
                      <p className="font-medium text-slate-900">{risk.description}</p>
                      {risk.mitigation_plan && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          Mitigation: {risk.mitigation_plan}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <SeverityBadge severity={risk.severity} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-600">
                      {risk.risk_owner}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <RiskStatusBadge status={risk.status} />
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

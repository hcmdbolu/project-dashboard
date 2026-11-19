import React, { useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { RAG_COLORS, RAG_STATUSES } from '../../lib/formatters';
import { Project, RagStatus } from '../../types/portfolio';

interface RagDistributionChartProps {
  projects: Project[];
}

export const RagDistributionChart: React.FC<RagDistributionChartProps> = ({ projects }) => {
  const data = useMemo(() => {
    const counts: Record<RagStatus, number> = {
      Green: 0,
      Amber: 0,
      Red: 0,
      Blue: 0,
    };
    projects.forEach((p) => {
      if (counts[p.rag_status] !== undefined) {
        counts[p.rag_status] += 1;
      }
    });

    return RAG_STATUSES.map((status) => ({
      name: RAG_COLORS[status].label,
      shortName: status,
      value: counts[status],
      color: RAG_COLORS[status].hex,
    })).filter((item) => item.value > 0);
  }, [projects]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">
          Project Status Distribution
        </h3>
        <p className="text-xs text-slate-500">
          Completed, On Track, Attention Needed, and Critical / At Risk
        </p>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-slate-400">
          No project data available
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="46%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
              >
                {data.map((entry) => (
                  <Cell key={entry.shortName} fill={entry.color} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '0.75rem',
                  borderColor: '#e2e8f0',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [`${value} projects`, name]}
              />
              <Legend
                verticalAlign="bottom"
                height={42}
                iconType="circle"
                formatter={(value) => (
                  <span className="text-[11px] font-medium text-slate-700">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

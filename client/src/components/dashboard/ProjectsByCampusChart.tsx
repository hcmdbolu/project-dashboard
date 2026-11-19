import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CAMPUSES } from '../../lib/formatters';
import { Project } from '../../types/portfolio';

interface ProjectsByCampusChartProps {
  projects: Project[];
}

export const ProjectsByCampusChart: React.FC<ProjectsByCampusChartProps> = ({
  projects,
}) => {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    CAMPUSES.forEach((c) => {
      counts[c] = 0;
    });
    projects.forEach((p) => {
      counts[p.campus] = (counts[p.campus] ?? 0) + 1;
    });

    return CAMPUSES.map((campus) => ({
      campus,
      count: counts[campus] ?? 0,
    }));
  }, [projects]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">Projects by Campus</h3>
        <p className="text-xs text-slate-500">Initiative distribution across GSL campuses</p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="campus"
              tick={{ fontSize: 11, fill: '#475569' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#475569' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{
                borderRadius: '0.75rem',
                borderColor: '#e2e8f0',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value} projects`, 'Count']}
            />
            <Bar dataKey="count" fill="#14532d" radius={[6, 6, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

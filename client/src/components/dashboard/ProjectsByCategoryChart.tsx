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
import { Project } from '../../types/portfolio';

interface ProjectsByCategoryChartProps {
  projects: Project[];
}

export const ProjectsByCategoryChart: React.FC<ProjectsByCategoryChartProps> = ({
  projects,
}) => {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    projects.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [projects]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">Projects by Category</h3>
        <p className="text-xs text-slate-500">Strategic domain breakdown</p>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-slate-400">
          No categories to display
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 12, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#475569' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={118}
                tick={{ fontSize: 11, fill: '#334155' }}
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
              <Bar dataKey="count" fill="#1e293b" radius={[0, 6, 6, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

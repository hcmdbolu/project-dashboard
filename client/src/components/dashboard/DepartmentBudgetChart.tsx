import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '../../lib/formatters';
import { Department, DepartmentBudget, Project } from '../../types/portfolio';

interface DepartmentBudgetChartProps {
  departments: Department[];
  budgets: DepartmentBudget[];
  projects: Project[];
}

export const DepartmentBudgetChart: React.FC<DepartmentBudgetChartProps> = ({
  departments,
  budgets,
  projects,
}) => {
  const data = useMemo(() => {
    return departments.map((dept) => {
      const ceiling = budgets
        .filter((b) => b.department_id === dept.id && b.status === 'Approved')
        .reduce((s, b) => s + Number(b.approved_amount || 0), 0);

      const deptProjects = projects.filter((p) => p.department_id === dept.id);
      const allocated = deptProjects.reduce(
        (s, p) => s + Number(p.approved_budget || 0),
        0
      );
      const spend = deptProjects.reduce((s, p) => s + Number(p.actual_spend || 0), 0);

      return {
        department: dept.name,
        Ceiling: ceiling,
        Allocated: allocated,
        Spend: spend,
      };
    });
  }, [budgets, departments, projects]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">
          Department Budget vs. Spend Comparison
        </h3>
        <p className="text-xs text-slate-500">
          Approved Ceiling vs. Project Allocations &amp; Actual Spend
        </p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="department"
              tick={{ fontSize: 11, fill: '#334155' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `₦${Math.round(v / 1_000_000)}M`}
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
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend
              verticalAlign="bottom"
              height={30}
              formatter={(v) => (
                <span className="text-[11px] font-medium text-slate-700">{v}</span>
              )}
            />
            <Bar dataKey="Ceiling" fill="#1b4332" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="Allocated" fill="#2d6a4f" radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="Spend" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

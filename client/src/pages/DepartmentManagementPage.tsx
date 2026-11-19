import React, { useMemo, useState } from 'react';
import { Building2, Edit3, Plus, Trash2, X } from 'lucide-react';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../lib/formatters';
import { Department } from '../types/portfolio';

export const DepartmentManagementPage: React.FC = () => {
  const {
    departments,
    profiles,
    budgets,
    allVisibleProjects,
    createDepartment,
    updateDepartment,
    deleteDepartment,
  } = usePortfolio();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const statsMap = useMemo(() => {
    const map = new Map<
      string,
      { users: number; projects: number; ceiling: number; allocated: number }
    >();
    departments.forEach((d) => {
      map.set(d.id, { users: 0, projects: 0, ceiling: 0, allocated: 0 });
    });
    profiles.forEach((p) => {
      if (p.department_id && map.has(p.department_id)) {
        map.get(p.department_id)!.users += 1;
      }
    });
    allVisibleProjects.forEach((proj) => {
      const entry = map.get(proj.department_id);
      if (entry) {
        entry.projects += 1;
        entry.allocated += Number(proj.approved_budget || 0);
      }
    });
    budgets.forEach((b) => {
      if (b.status === 'Approved' && map.has(b.department_id)) {
        map.get(b.department_id)!.ceiling += Number(b.approved_amount || 0);
      }
    });
    return map;
  }, [departments, profiles, allVisibleProjects, budgets]);

  const openCreate = () => {
    setEditingDept(null);
    setName('');
    setCode('');
    setDescription('');
    setModalOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setCode(dept.code);
    setDescription(dept.description || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
    };
    const ok = editingDept
      ? await updateDepartment(editingDept.id, payload)
      : await createDepartment(payload);
    setSaving(false);
    if (ok) {
      setModalOpen(false);
      setEditingDept(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const ok = await deleteDepartment(confirmDelete.id);
    setDeleting(false);
    if (ok) {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Department Administration
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Create and manage operational departments across Greensprings School
            portfolios.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-gsl-800"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Department
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Projects</th>
              <th className="px-4 py-3">Approved Ceiling</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {departments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No departments defined yet.
                </td>
              </tr>
            ) : (
              departments.map((dept) => {
                const stats = statsMap.get(dept.id) ?? {
                  users: 0,
                  projects: 0,
                  ceiling: 0,
                  allocated: 0,
                };
                return (
                  <tr key={dept.id} className="hover:bg-slate-50/75">
                    <td className="whitespace-nowrap px-4 py-3.5 font-bold text-slate-900">
                      <span className="inline-flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gsl-700" />
                        {dept.name}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                        {dept.code}
                      </span>
                    </td>
                    <td className="max-w-sm px-4 py-3.5 text-slate-600">
                      {dept.description || '—'}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {stats.users}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {stats.projects}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <p className="font-semibold text-gsl-800">
                        {formatCurrency(stats.ceiling)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Allocated: {formatCurrency(stats.allocated)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(dept)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-gsl-700"
                          title="Edit department"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(dept)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete department"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingDept ? 'Edit Department' : 'Create Operational Department'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Department Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Security & Safety"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Short Code *
              </label>
              <input
                type="text"
                required
                maxLength={12}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SEC"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Portfolio Scope Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of department operations and initiatives..."
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white hover:bg-gsl-800 disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : editingDept
                  ? 'Save Changes'
                  : 'Create Department'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmDelete)}
        title="Delete Department"
        message={`Delete "${confirmDelete?.name}" (${confirmDelete?.code})? Departments with active projects or users cannot be removed in live database mode until reassigned.`}
        confirmLabel="Delete Department"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, X } from 'lucide-react';
import {
  CAMPUSES,
  computePriorityScore,
  formatCurrency,
  getRagLabel,
  PROCUREMENT_STATUSES,
  RAG_STATUSES,
  SCHEDULE_STATUSES,
} from '../../lib/formatters';
import {
  Campus,
  CategoryItem,
  Department,
  DepartmentBudget,
  ProcurementStatus,
  Profile,
  Project,
  ProjectInput,
  RagStatus,
  ScheduleStatus,
} from '../../types/portfolio';

interface ProjectFormModalProps {
  open: boolean;
  initialProject?: Project | null;
  departments: Department[];
  categories: CategoryItem[];
  profiles: Profile[];
  budgets: DepartmentBudget[];
  allProjects: Project[];
  lockedDepartmentId: string | null;
  canAddCategory: boolean;
  canManageOwnership?: boolean;
  onCreateCategory: (
    name: string,
    departmentId: string | null
  ) => Promise<CategoryItem | null>;
  onClose: () => void;
  onSubmit: (input: ProjectInput) => Promise<boolean>;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  open,
  initialProject,
  departments,
  categories,
  profiles,
  budgets,
  allProjects,
  lockedDepartmentId,
  canAddCategory,
  canManageOwnership = true,
  onCreateCategory,
  onClose,
  onSubmit,
}) => {
  const defaultDeptId =
    lockedDepartmentId || departments[0]?.id || '';

  const buildEmpty = (): ProjectInput => ({
    department_id: defaultDeptId,
    category_id: categories[0]?.id ?? null,
    name: '',
    campus: 'All Campuses',
    project_manager_id: null,
    owner_id: null,
    owner_ids: [],
    owner_department_ids: [],
    technical_lead_name: '',
    approval_authority: '',
    problem_solved: '',
    expected_benefit: '',
    savings_efficiency: '',
    percent_complete: 0,
    schedule_status: 'Not Started',
    rag_status: 'Green',
    next_milestone: '',
    milestone_due_date: new Date().toISOString().slice(0, 10),
    target_end_date: new Date().toISOString().slice(0, 10),
    business_impact: 4.0,
    risk_level: 3.5,
    urgency: 3.5,
    strategic_importance: 4.0,
    approved_budget: 0,
    actual_spend: 0,
    procurement_status: 'Not Started',
  });

  const [form, setForm] = useState<ProjectInput>(buildEmpty);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValidationError(null);
    setAddingCat(false);
    setNewCatName('');
    setOwnerSearch('');
    if (initialProject) {
      const initOwners =
        initialProject.owner_ids && initialProject.owner_ids.length > 0
          ? initialProject.owner_ids
          : initialProject.owner_id
          ? [initialProject.owner_id]
          : [];
      setForm({
        department_id: initialProject.department_id,
        category_id: initialProject.category_id,
        name: initialProject.name,
        campus: initialProject.campus,
        project_manager_id: initialProject.project_manager_id ?? null,
        owner_id: initOwners[0] ?? null,
        owner_ids: initOwners,
        owner_department_ids: initialProject.owner_department_ids ?? [],
        technical_lead_name: initialProject.technical_lead_name,
        approval_authority: initialProject.approval_authority,
        problem_solved: initialProject.problem_solved,
        expected_benefit: initialProject.expected_benefit,
        savings_efficiency: initialProject.savings_efficiency,
        percent_complete: initialProject.percent_complete,
        schedule_status: initialProject.schedule_status,
        rag_status: initialProject.rag_status,
        next_milestone: initialProject.next_milestone,
        milestone_due_date:
          initialProject.milestone_due_date || initialProject.target_end_date,
        target_end_date: initialProject.target_end_date,
        business_impact: initialProject.business_impact,
        risk_level: initialProject.risk_level,
        urgency: initialProject.urgency,
        strategic_importance: initialProject.strategic_importance,
        approved_budget: initialProject.approved_budget,
        actual_spend: initialProject.actual_spend,
        procurement_status: initialProject.procurement_status,
      });
    } else {
      setForm(buildEmpty());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject, open]);

  // Eligible Project Managers: Primary department PM/Dept Admin + all Super Admins
  const eligiblePms = useMemo(() => {
    return profiles.filter(
      (u) =>
        u.role === 'Super Admin' ||
        (u.department_id === form.department_id &&
          (u.role === 'Project Manager' || u.role === 'Department Admin'))
    );
  }, [form.department_id, profiles]);

  // Eligible Individual Co-Owners: Primary dept + tagged Department Owners + all Super Admins
  const eligibleOwners = useMemo(() => {
    const allowedDeptIds = new Set<string>([
      form.department_id,
      ...(form.owner_department_ids ?? []),
    ]);
    return profiles.filter(
      (u) =>
        u.role === 'Super Admin' ||
        (Boolean(u.department_id) &&
          allowedDeptIds.has(u.department_id!) &&
          (u.role === 'Project Owner' ||
            u.role === 'Project Manager' ||
            u.role === 'Department Admin'))
    );
  }, [form.department_id, form.owner_department_ids, profiles]);

  const filteredEligibleOwners = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    if (!q) return eligibleOwners;
    return eligibleOwners.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [eligibleOwners, ownerSearch]);

  const availableCategories = useMemo(() => {
    return categories.filter(
      (c) => c.department_id === null || c.department_id === form.department_id
    );
  }, [categories, form.department_id]);

  // Check Department Budget Ceiling overrun
  const budgetWarning = useMemo(() => {
    const approvedDeptCeiling = budgets
      .filter(
        (b) => b.department_id === form.department_id && b.status === 'Approved'
      )
      .reduce((s, b) => s + Number(b.approved_amount || 0), 0);

    if (approvedDeptCeiling <= 0) return null;

    const otherProjectsTotal = allProjects
      .filter(
        (p) =>
          p.department_id === form.department_id && p.id !== initialProject?.id
      )
      .reduce((s, p) => s + Number(p.approved_budget || 0), 0);

    const projectedTotal = otherProjectsTotal + Number(form.approved_budget || 0);
    if (projectedTotal > approvedDeptCeiling) {
      return `Projected department allocations (${formatCurrency(projectedTotal)}) exceed the approved department ceiling (${formatCurrency(approvedDeptCeiling)}) by ${formatCurrency(projectedTotal - approvedDeptCeiling)}.`;
    }
    return null;
  }, [allProjects, budgets, form.approved_budget, form.department_id, initialProject?.id]);

  if (!open) return null;

  const computedPriority = computePriorityScore(
    form.business_impact,
    form.risk_level,
    form.urgency,
    form.strategic_importance
  );

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return;
    const created = await onCreateCategory(newCatName.trim(), form.department_id || null);
    if (created) {
      setForm((curr) => ({ ...curr, category_id: created.id }));
      setNewCatName('');
      setAddingCat(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!form.department_id) {
      setValidationError('Please select a department.');
      return;
    }

    const textCheck = [form.technical_lead_name, form.approval_authority];
    if (
      textCheck.some((v) => ['confirm', 'tbd', ''].includes(v.trim().toLowerCase()))
    ) {
      setValidationError(
        'Please specify Technical Lead and Approval Authority (avoid "Confirm" or "TBD").'
      );
      return;
    }

    setSubmitting(true);
    const ok = await onSubmit({
      ...form,
      owner_id: form.owner_ids[0] ?? null,
      percent_complete: Math.max(0, Math.min(100, Math.round(form.percent_complete))),
    });
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {initialProject
                  ? `Edit Project ${initialProject.project_code}`
                  : 'New Portfolio Project'}
              </h3>
              {!initialProject && (
                <span className="rounded-full bg-gsl-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-gsl-700 ring-1 ring-inset ring-gsl-200">
                  Auto Code: GSL-PROJECT-XXX
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Assign department, dynamic category, eligible PM &amp; Owner, and exact Naira budget
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {validationError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
              {validationError}
            </div>
          )}

          {budgetWarning && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>{budgetWarning}</span>
            </div>
          )}

          <section className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gsl-700">
              1. Department, Initiative &amp; Schedule
            </h4>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Department
                </label>
                <select
                  required
                  disabled={Boolean(lockedDepartmentId) || !canManageOwnership}
                  value={form.department_id}
                  onChange={(e) => {
                    const nextDeptId = e.target.value;
                    const currCat = categories.find((c) => c.id === form.category_id);
                    const keepCat =
                      currCat &&
                      (currCat.department_id === null ||
                        currCat.department_id === nextDeptId);
                    const fallbackCat =
                      categories.find(
                        (c) =>
                          c.department_id === null || c.department_id === nextDeptId
                      )?.id ?? null;

                    const selectedPm = profiles.find(
                      (u) => u.id === form.project_manager_id
                    );
                    const keepPm =
                      selectedPm &&
                      (selectedPm.role === 'Super Admin' ||
                        selectedPm.department_id === nextDeptId);

                    const nextAllowedDepts = new Set<string>([
                      nextDeptId,
                      ...(form.owner_department_ids ?? []),
                    ]);
                    const nextOwnerIds = form.owner_ids.filter((uid) => {
                      const u = profiles.find((p) => p.id === uid);
                      return (
                        u &&
                        (u.role === 'Super Admin' ||
                          (u.department_id && nextAllowedDepts.has(u.department_id)))
                      );
                    });

                    setForm({
                      ...form,
                      department_id: nextDeptId,
                      category_id: keepCat ? form.category_id : fallbackCat,
                      project_manager_id: keepPm ? form.project_manager_id : null,
                      owner_ids: nextOwnerIds,
                      owner_id: nextOwnerIds[0] ?? null,
                    });
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Campus</label>
                <select
                  value={form.campus}
                  onChange={(e) => setForm({ ...form, campus: e.target.value as Campus })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                >
                  {CAMPUSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Category
                  </label>
                  {canAddCategory && (
                    <button
                      type="button"
                      onClick={() => setAddingCat((prev) => !prev)}
                      className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-gsl-700 hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      Add New Category
                    </button>
                  )}
                </div>
                {addingCat ? (
                  <div className="mt-1 flex gap-1.5">
                    <input
                      type="text"
                      placeholder="New category name..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="flex-1 rounded-xl border border-gsl-600 px-3 py-1.5 text-xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCategory}
                      className="rounded-xl bg-gsl-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gsl-800"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <select
                    value={form.category_id ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, category_id: e.target.value || null })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    % Complete
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={form.percent_complete}
                    onChange={(e) =>
                      setForm({ ...form, percent_complete: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Status
                  </label>
                  <select
                    value={form.rag_status}
                    onChange={(e) =>
                      setForm({ ...form, rag_status: e.target.value as RagStatus })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-xs focus:border-gsl-600 focus:outline-none"
                  >
                    {RAG_STATUSES.map((r) => (
                      <option key={r} value={r}>
                        {getRagLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Schedule
                  </label>
                  <select
                    value={form.schedule_status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        schedule_status: e.target.value as ScheduleStatus,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-xs focus:border-gsl-600 focus:outline-none"
                  >
                    {SCHEDULE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Next Milestone
                </label>
                <input
                  type="text"
                  placeholder="e.g., UAT Sign-off"
                  value={form.next_milestone}
                  onChange={(e) => setForm({ ...form, next_milestone: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Milestone Due Date
                  </label>
                  <input
                    type="date"
                    value={form.milestone_due_date || ''}
                    onChange={(e) =>
                      setForm({ ...form, milestone_due_date: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Target End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.target_end_date}
                    onChange={(e) =>
                      setForm({ ...form, target_end_date: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gsl-700">
                2. Ownership &amp; Accountability
              </h4>
              {!canManageOwnership && (
                <span className="text-[11px] font-medium text-slate-500">
                  Co-owner &amp; department ownership assignments are managed by Admins/PMs
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Project Manager
                </label>
                <select
                  value={form.project_manager_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, project_manager_id: e.target.value || null })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                >
                  <option value="">Select Project Manager...</option>
                  {eligiblePms.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Technical Lead
                </label>
                <input
                  type="text"
                  required
                  value={form.technical_lead_name}
                  onChange={(e) =>
                    setForm({ ...form, technical_lead_name: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Approval Authority
                </label>
                <input
                  type="text"
                  required
                  value={form.approval_authority}
                  onChange={(e) =>
                    setForm({ ...form, approval_authority: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                />
              </div>

              {/* Multiple Individual Co-Owners (View & Edit) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-800">
                    Individual Co-Owners (View &amp; Edit)
                  </label>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    {form.owner_ids.length} selected
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Includes primary dept, tagged departments, and Super Admins across all depts.
                </p>

                {form.owner_ids.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.owner_ids.map((uid) => {
                      const user = profiles.find((p) => p.id === uid);
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800 ring-1 ring-inset ring-blue-200"
                        >
                          {user?.full_name || uid}
                          {canManageOwnership && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = form.owner_ids.filter((id) => id !== uid);
                                setForm({
                                  ...form,
                                  owner_ids: next,
                                  owner_id: next[0] ?? null,
                                });
                              }}
                              className="rounded-full p-0.5 hover:bg-blue-200/70"
                              aria-label={`Remove ${user?.full_name || 'owner'}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  disabled={!canManageOwnership}
                  value={ownerSearch}
                  onChange={(e) => setOwnerSearch(e.target.value)}
                  placeholder="Search co-owners by name, email, or role..."
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-gsl-600 focus:outline-none disabled:bg-slate-100"
                />

                <div className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
                  {filteredEligibleOwners.length === 0 ? (
                    <p className="py-2 text-center text-[11px] text-slate-400">
                      No matching users found.
                    </p>
                  ) : (
                    filteredEligibleOwners.map((u) => {
                      const checked = form.owner_ids.includes(u.id);
                      const deptName =
                        departments.find((d) => d.id === u.department_id)?.code ?? 'ALL';
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs ${
                            canManageOwnership
                              ? 'cursor-pointer hover:bg-white'
                              : 'cursor-not-allowed opacity-70'
                          } ${checked ? 'bg-white ring-1 ring-blue-200' : ''}`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              disabled={!canManageOwnership}
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...form.owner_ids, u.id]
                                  : form.owner_ids.filter((id) => id !== u.id);
                                setForm({
                                  ...form,
                                  owner_ids: next,
                                  owner_id: next[0] ?? null,
                                });
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-gsl-700 focus:ring-gsl-600"
                            />
                            <span className="truncate font-medium text-slate-800">
                              {u.full_name}
                            </span>
                          </span>
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {u.role === 'Super Admin' ? 'Super Admin' : `${deptName} • ${u.role}`}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Department Owners (Department-Wide View Access) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-800">
                    Department Owners (View Access)
                  </label>
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                    {form.owner_department_ids.length} selected
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Everyone in selected department(s) can view this project and pick co-owners from them.
                </p>

                <div className="mt-2.5 space-y-1.5">
                  {departments.map((d) => {
                    const checked = form.owner_department_ids.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                          canManageOwnership
                            ? 'cursor-pointer hover:bg-white'
                            : 'cursor-not-allowed opacity-70'
                        } ${checked ? 'bg-white ring-1 ring-teal-200' : ''}`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={!canManageOwnership}
                            checked={checked}
                            onChange={(e) => {
                              const nextDepts = e.target.checked
                                ? [...form.owner_department_ids, d.id]
                                : form.owner_department_ids.filter((id) => id !== d.id);
                              const nextAllowedDepts = new Set<string>([
                                form.department_id,
                                ...nextDepts,
                              ]);
                              const nextOwners = form.owner_ids.filter((uid) => {
                                const u = profiles.find((p) => p.id === uid);
                                return (
                                  u &&
                                  (u.role === 'Super Admin' ||
                                    (u.department_id && nextAllowedDepts.has(u.department_id)))
                                );
                              });
                              setForm({
                                ...form,
                                owner_department_ids: nextDepts,
                                owner_ids: nextOwners,
                                owner_id: nextOwners[0] ?? null,
                              });
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-gsl-700 focus:ring-gsl-600"
                          />
                          <span className="font-medium text-slate-800">{d.name}</span>
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                          {d.code}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gsl-700">
                3. Weighted Priority Scoring (1–5) &amp; Exact Naira Financials
              </h4>
              <span className="rounded-lg bg-gsl-50 px-2.5 py-1 text-xs font-bold text-gsl-800">
                Weighted Priority: {computedPriority.toFixed(2)} / 5.00
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['business_impact', 'Impact (35%)'],
                  ['strategic_importance', 'Strategic (30%)'],
                  ['urgency', 'Urgency (20%)'],
                  ['risk_level', 'Risk (15%)'],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs font-semibold text-slate-700">
                    {label}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    step={0.1}
                    required
                    value={form[field]}
                    onChange={(e) =>
                      setForm({ ...form, [field]: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Allocated Budget (₦ exact)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  required
                  placeholder="e.g., 50000 or 12500000"
                  value={form.approved_budget}
                  onChange={(e) =>
                    setForm({ ...form, approved_budget: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Actual Spend (₦ exact)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={form.actual_spend}
                  onChange={(e) =>
                    setForm({ ...form, actual_spend: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Procurement Status
                </label>
                <select
                  value={form.procurement_status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      procurement_status: e.target.value as ProcurementStatus,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-gsl-600 focus:outline-none"
                >
                  {PROCUREMENT_STATUSES.map((ps) => (
                    <option key={ps} value={ps}>
                      {ps}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gsl-700">
              4. Benefits &amp; Outcomes
            </h4>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Problem Solved
                </label>
                <textarea
                  rows={2}
                  value={form.problem_solved}
                  onChange={(e) => setForm({ ...form, problem_solved: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-gsl-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Expected Benefit
                </label>
                <textarea
                  rows={2}
                  value={form.expected_benefit}
                  onChange={(e) =>
                    setForm({ ...form, expected_benefit: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-gsl-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Savings &amp; Efficiency
                </label>
                <textarea
                  rows={2}
                  value={form.savings_efficiency}
                  onChange={(e) =>
                    setForm({ ...form, savings_efficiency: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-gsl-600 focus:outline-none"
                />
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-gsl-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gsl-800 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : initialProject ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

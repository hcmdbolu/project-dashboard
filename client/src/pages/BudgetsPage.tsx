import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Plus,
  Send,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { BudgetStatusBadge, DepartmentBadge } from '../components/ui/Badges';
import { useAuth } from '../context/AuthContext';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../lib/formatters';
import { DepartmentBudget } from '../types/portfolio';

export const BudgetsPage: React.FC = () => {
  const {
    departmentId,
    isSuperAdmin,
    isOrgWide,
    canProposeBudgets,
    canApproveBudgets,
  } = useAuth();
  const {
    departments,
    budgets,
    allVisibleProjects,
    selectedDepartmentId,
    setSelectedDepartmentId,
    getDepartmentName,
    getProfileName,
    submitDepartmentBudget,
    reviewDepartmentBudget,
  } = usePortfolio();

  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalDeptId, setProposalDeptId] = useState<string>('');
  const [fiscalPeriod, setFiscalPeriod] = useState<string>('FY 2026');
  const [proposedAmount, setProposedAmount] = useState<string>('');
  const [proposalNotes, setProposalNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [reviewTarget, setReviewTarget] = useState<DepartmentBudget | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'Approved' | 'Rejected'>(
    'Approved'
  );
  const [approvedAmountInput, setApprovedAmountInput] = useState<string>('');
  const [reviewNotesInput, setReviewNotesInput] = useState<string>('');
  const [reviewBusy, setReviewBusy] = useState(false);

  const visibleBudgets = useMemo(() => {
    const scoped = isOrgWide
      ? selectedDepartmentId === 'ALL'
        ? budgets
        : budgets.filter((b) => b.department_id === selectedDepartmentId)
      : budgets.filter((b) => b.department_id === departmentId);

    return [...scoped].sort((a, b) =>
      `${b.fiscal_period}-${a.department_id}`.localeCompare(
        `${a.fiscal_period}-${b.department_id}`
      )
    );
  }, [budgets, isOrgWide, selectedDepartmentId, departmentId]);

  const metrics = useMemo(() => {
    const scopeDeptIds = new Set(
      isOrgWide
        ? selectedDepartmentId === 'ALL'
          ? departments.map((d) => d.id)
          : [selectedDepartmentId]
        : departmentId
        ? [departmentId]
        : []
    );

    const totalCeiling = visibleBudgets
      .filter((b) => b.status === 'Approved')
      .reduce((sum, b) => sum + Number(b.approved_amount || 0), 0);

    const scopedProjects = allVisibleProjects.filter((p) =>
      scopeDeptIds.has(p.department_id)
    );
    const totalAllocated = scopedProjects.reduce(
      (sum, p) => sum + Number(p.approved_budget || 0),
      0
    );
    const totalSpend = scopedProjects.reduce(
      (sum, p) => sum + Number(p.actual_spend || 0),
      0
    );
    const pendingCount = visibleBudgets.filter(
      (b) => b.status === 'Pending Approval'
    ).length;

    return {
      totalCeiling,
      totalAllocated,
      totalSpend,
      unallocatedReserve: totalCeiling - totalAllocated,
      pendingCount,
    };
  }, [
    visibleBudgets,
    allVisibleProjects,
    departments,
    isOrgWide,
    selectedDepartmentId,
    departmentId,
  ]);

  const allocatedByDept = useMemo(() => {
    const map = new Map<string, { allocated: number; spend: number }>();
    allVisibleProjects.forEach((p) => {
      const current = map.get(p.department_id) ?? { allocated: 0, spend: 0 };
      map.set(p.department_id, {
        allocated: current.allocated + Number(p.approved_budget || 0),
        spend: current.spend + Number(p.actual_spend || 0),
      });
    });
    return map;
  }, [allVisibleProjects]);

  const openNewProposal = (prefill?: DepartmentBudget) => {
    if (prefill) {
      setProposalDeptId(prefill.department_id);
      setFiscalPeriod(prefill.fiscal_period);
      setProposedAmount(String(prefill.proposed_amount));
      setProposalNotes(prefill.review_notes || '');
    } else {
      const defaultDept = isSuperAdmin
        ? selectedDepartmentId !== 'ALL'
          ? selectedDepartmentId
          : departments[0]?.id ?? ''
        : departmentId ?? '';
      setProposalDeptId(defaultDept);
      setFiscalPeriod('FY 2026');
      setProposedAmount('');
      setProposalNotes('');
    }
    setProposalOpen(true);
  };

  const handleProposalSubmit = async (status: 'Draft' | 'Pending Approval') => {
    const parsedAmount = Number(proposedAmount);
    if (!proposalDeptId || !fiscalPeriod.trim() || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return;
    }
    setSubmitting(true);
    const ok = await submitDepartmentBudget(
      proposalDeptId,
      fiscalPeriod.trim(),
      parsedAmount,
      status,
      proposalNotes.trim()
    );
    setSubmitting(false);
    if (ok) {
      setProposalOpen(false);
    }
  };

  const openReviewModal = (
    budget: DepartmentBudget,
    decision: 'Approved' | 'Rejected'
  ) => {
    setReviewTarget(budget);
    setReviewDecision(decision);
    setApprovedAmountInput(
      decision === 'Approved'
        ? String(budget.proposed_amount || budget.approved_amount || 0)
        : '0'
    );
    setReviewNotesInput(budget.review_notes || '');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    const parsedApproved =
      reviewDecision === 'Approved' ? Number(approvedAmountInput) : 0;
    if (!Number.isFinite(parsedApproved) || parsedApproved < 0) return;

    setReviewBusy(true);
    const ok = await reviewDepartmentBudget(
      reviewTarget.id,
      reviewDecision,
      parsedApproved,
      reviewNotesInput.trim()
    );
    setReviewBusy(false);
    if (ok) {
      setReviewTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Department Budgets &amp; Ceilings
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isSuperAdmin
              ? 'Review, approve, or adjust annual Naira budget ceilings across operational departments.'
              : canProposeBudgets
              ? 'Propose department budget ceilings and track Super Admin approvals against project allocations.'
              : 'School-wide visibility into approved department budget ceilings and actual portfolio utilization.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOrgWide && (
            <select
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {canProposeBudgets && (
            <button
              type="button"
              onClick={() => openNewProposal()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-gsl-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Propose Department Budget
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Approved Budget Ceiling
            </span>
            <Wallet className="h-4 w-4 text-gsl-700" />
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatCurrency(metrics.totalCeiling)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {metrics.pendingCount} proposal(s) awaiting approval
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Allocated to Projects
            </span>
            <Coins className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatCurrency(metrics.totalAllocated)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Sum of project budgets in scope
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500">
            Actual Spend to Date
          </span>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatCurrency(metrics.totalSpend)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {metrics.totalAllocated > 0
              ? `${Math.round((metrics.totalSpend / metrics.totalAllocated) * 100)}% of allocated`
              : '0% of allocated'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-medium text-slate-500">
            Unallocated Ceiling Reserve
          </span>
          <p
            className={`mt-2 text-xl font-bold ${
              metrics.unallocatedReserve < 0 ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {formatCurrency(metrics.unallocatedReserve)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Ceiling minus allocated project budgets
          </p>
        </div>
      </div>

      {/* Budgets Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Fiscal Period</th>
              <th className="px-4 py-3">Proposed (NGN)</th>
              <th className="px-4 py-3">Approved Ceiling</th>
              <th className="px-4 py-3">Project Allocations</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Governance Notes</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleBudgets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No department budget proposals found in this scope.
                </td>
              </tr>
            ) : (
              visibleBudgets.map((budget) => {
                const deptStats = allocatedByDept.get(budget.department_id) ?? {
                  allocated: 0,
                  spend: 0,
                };
                const overCeiling =
                  budget.status === 'Approved' &&
                  deptStats.allocated > budget.approved_amount;

                return (
                  <tr key={budget.id} className="hover:bg-slate-50/75">
                    <td className="px-4 py-3.5 align-top">
                      <DepartmentBadge
                        name={getDepartmentName(budget.department_id)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 align-top font-semibold text-slate-900">
                      {budget.fiscal_period}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 align-top font-medium text-slate-700">
                      {formatCurrency(budget.proposed_amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 align-top font-bold text-gsl-800">
                      {formatCurrency(budget.approved_amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 align-top">
                      <p
                        className={`font-semibold ${
                          overCeiling ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {formatCurrency(deptStats.allocated)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Spend: {formatCurrency(deptStats.spend)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <BudgetStatusBadge status={budget.status} />
                    </td>
                    <td className="max-w-xs px-4 py-3.5 align-top text-slate-600">
                      <p>{budget.review_notes || '—'}</p>
                      {budget.submitted_by && (
                        <p className="mt-1 text-[10px] text-slate-400">
                          Submitted by {getProfileName(budget.submitted_by)}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right align-top">
                      <div className="inline-flex items-center gap-1.5">
                        {canProposeBudgets &&
                          (isSuperAdmin || budget.department_id === departmentId) && (
                            <button
                              type="button"
                              onClick={() => openNewProposal(budget)}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Update
                            </button>
                          )}

                        {canApproveBudgets && (
                          <>
                            <button
                              type="button"
                              onClick={() => openReviewModal(budget, 'Approved')}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Approve
                            </button>
                            {budget.status !== 'Rejected' && (
                              <button
                                type="button"
                                onClick={() => openReviewModal(budget, 'Rejected')}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                              >
                                <XCircle className="h-3 w-3" />
                                Reject
                              </button>
                            )}
                          </>
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

      {/* Proposal Modal */}
      {proposalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Department Budget Proposal
                </h3>
                <p className="text-xs text-slate-500">
                  Enter any exact Naira amount and submit for Super Admin approval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProposalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Department *
                </label>
                {isSuperAdmin ? (
                  <select
                    value={proposalDeptId}
                    onChange={(e) => setProposalDeptId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
                    {getDepartmentName(proposalDeptId)}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Fiscal Period *
                  </label>
                  <input
                    type="text"
                    required
                    value={fiscalPeriod}
                    onChange={(e) => setFiscalPeriod(e.target.value)}
                    placeholder="FY 2026"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Proposed Ceiling (NGN) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={proposedAmount}
                    onChange={(e) => setProposedAmount(e.target.value)}
                    placeholder="e.g. 14250000"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Justification / Notes
                </label>
                <textarea
                  rows={3}
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  placeholder="Outline strategic priorities covered by this ceiling..."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setProposalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !proposedAmount}
                onClick={() => handleProposalSubmit('Draft')}
                className="rounded-xl border border-gsl-300 bg-gsl-50 px-4 py-2 text-xs font-semibold text-gsl-800 hover:bg-gsl-100 disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={submitting || !proposedAmount}
                onClick={() => handleProposalSubmit('Pending Approval')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white hover:bg-gsl-800 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleReviewSubmit}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {reviewDecision === 'Approved'
                  ? 'Approve Department Budget Ceiling'
                  : 'Reject Budget Proposal'}
              </h3>
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-bold text-slate-900">
                {getDepartmentName(reviewTarget.department_id)} •{' '}
                {reviewTarget.fiscal_period}
              </p>
              <p className="mt-1">
                Proposed Amount:{' '}
                <strong>{formatCurrency(reviewTarget.proposed_amount)}</strong>
              </p>
            </div>

            {reviewDecision === 'Approved' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Approved Ceiling Amount (NGN) *
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={approvedAmountInput}
                  onChange={(e) => setApprovedAmountInput(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Executive Review Notes
              </label>
              <textarea
                rows={3}
                value={reviewNotesInput}
                onChange={(e) => setReviewNotesInput(e.target.value)}
                placeholder="Document conditions or rationale..."
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reviewBusy}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                  reviewDecision === 'Approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {reviewBusy
                  ? 'Saving...'
                  : reviewDecision === 'Approved'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

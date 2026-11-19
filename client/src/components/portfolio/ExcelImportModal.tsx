import React, { useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  CAMPUSES,
  PROCUREMENT_STATUSES,
  RAG_STATUSES,
  SCHEDULE_STATUSES,
} from '../../lib/formatters';
import {
  Campus,
  CategoryItem,
  Department,
  ProcurementStatus,
  ProjectInput,
  RagStatus,
  ScheduleStatus,
} from '../../types/portfolio';
import { RagBadge } from '../ui/Badges';

interface ExcelImportModalProps {
  open: boolean;
  departments: Department[];
  categories: CategoryItem[];
  defaultDepartmentId: string | null;
  onClose: () => void;
  onImport: (projects: ProjectInput[]) => Promise<number>;
}

interface ParsedRow {
  rowNumber: number;
  departmentName: string;
  categoryName: string;
  data: ProjectInput;
  errors: string[];
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function pickField(row: Record<string, unknown>, candidates: string[]): string {
  for (const key of Object.keys(row)) {
    const norm = normalizeKey(key);
    if (candidates.includes(norm)) {
      return String(row[key] ?? '').trim();
    }
  }
  return '';
}

function pickNumber(row: Record<string, unknown>, candidates: string[], fallback: number): number {
  const raw = pickField(row, candidates);
  if (!raw) return fallback;
  const cleaned = Number(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(cleaned) ? cleaned : fallback;
}

function matchEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T
): { val: T; matched: boolean } {
  if (!value) return { val: fallback, matched: false };
  const found = allowed.find((item) => item.toLowerCase() === value.trim().toLowerCase());
  return found ? { val: found, matched: true } : { val: fallback, matched: false };
}

function matchProjectStatus(raw: string): { val: RagStatus; matched: boolean } {
  if (!raw) return { val: 'Green', matched: false };
  const norm = raw.trim().toLowerCase();
  const aliasMap: Record<string, RagStatus> = {
    green: 'Green',
    'on track': 'Green',
    amber: 'Amber',
    'attention needed': 'Amber',
    red: 'Red',
    'critical / at risk': 'Red',
    'critical issue': 'Red',
    'at risk': 'Red',
    critical: 'Red',
    blue: 'Blue',
    completed: 'Blue',
  };
  if (aliasMap[norm]) return { val: aliasMap[norm], matched: true };
  return matchEnum<RagStatus>(raw, RAG_STATUSES, 'Green');
}

function formatExcelDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 25000) {
    const utcDays = Math.floor(serial - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  open,
  departments,
  categories,
  defaultDepartmentId,
  onClose,
  onImport,
}) => {
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  const validRows = parsedRows.filter((r) => r.errors.length === 0);

  const handleDownloadTemplate = () => {
    const defaultDept =
      departments.find((d) => d.id === defaultDepartmentId)?.name ||
      departments[0]?.name ||
      'IT';

    const templateRow = {
      'Project Code (Optional)': '',
      Department: defaultDept,
      'Project Name': 'Smart Library RFID Checkout System',
      Category: categories[0]?.name || 'Service Delivery',
      Campus: 'Anthony',
      'Technical Lead': 'Seyi Lawal',
      'Approval Authority': 'Chief Operating Officer',
      '% Complete': 25,
      'Schedule Status': 'On Schedule',
      'Project Status': 'On Track',
      'Business Impact (1-5)': 4.2,
      'Risk Level (1-5)': 3.0,
      'Urgency (1-5)': 3.8,
      'Strategic Importance (1-5)': 4.4,
      'Allocated Budget': 250000,
      'Actual Spend': 50000,
      'Procurement Status': 'RFQ / Tendering',
      'Next Milestone': 'Vendor Demo & Tag Pilot',
      'Milestone Due Date': '2026-12-05',
      'Target End Date': '2027-01-30',
      'Problem Solved': 'Manual book checkout causes queues during break periods.',
      'Expected Benefit': 'Self-service RFID kiosks with automated overdue alerts.',
      'Savings & Efficiency': 'Saves 15 librarian hours/week.',
    };

    const ws = XLSX.utils.json_to_sheet([templateRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');
    XLSX.writeFile(wb, 'GSL-Portfolio-Import-Template.xlsx');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });

    const parsed: ParsedRow[] = jsonRows.map((raw, idx) => {
      const errors: string[] = [];
      const project_code = pickField(raw, [
        'project_code',
        'project_code_optional',
        'project_id',
        'code',
      ]);
      const name = pickField(raw, ['project_name', 'name', 'title', 'initiative']);
      if (!name) errors.push('Missing Project Name');

      const rawDept = pickField(raw, ['department', 'dept']);
      let resolvedDept =
        departments.find(
          (d) =>
            d.name.toLowerCase() === rawDept.toLowerCase() ||
            d.code.toLowerCase() === rawDept.toLowerCase()
        ) ?? departments.find((d) => d.id === defaultDepartmentId);

      if (defaultDepartmentId && resolvedDept && resolvedDept.id !== defaultDepartmentId) {
        resolvedDept = departments.find((d) => d.id === defaultDepartmentId);
      }

      if (!resolvedDept) {
        errors.push(`Unknown Department "${rawDept || 'empty'}"`);
      }

      const rawCat = pickField(raw, ['category', 'project_category']);
      const matchedCat =
        categories.find((c) => c.name.toLowerCase() === rawCat.toLowerCase()) ??
        categories[0];

      const rawCampus = pickField(raw, ['campus']);
      const campusMatch = matchEnum<Campus>(rawCampus, CAMPUSES, 'All Campuses');
      if (rawCampus && !campusMatch.matched) {
        errors.push(`Unknown Campus "${rawCampus}"`);
      }

      const rawStatus = pickField(raw, ['project_status', 'status', 'rag_status']);
      const ragMatch = matchProjectStatus(rawStatus);
      if (rawStatus && !ragMatch.matched) {
        errors.push(`Invalid Project Status "${rawStatus}"`);
      }

      const rawSched = pickField(raw, ['schedule_status', 'schedule']);
      const schedMatch = matchEnum<ScheduleStatus>(
        rawSched,
        SCHEDULE_STATUSES,
        'On Schedule'
      );

      const rawProc = pickField(raw, ['procurement_status', 'procurement']);
      const procMatch = matchEnum<ProcurementStatus>(
        rawProc,
        PROCUREMENT_STATUSES,
        'Not Started'
      );

      const percent_complete = Math.max(
        0,
        Math.min(100, Math.round(pickNumber(raw, ['percent_complete', 'complete', 'progress'], 0)))
      );

      const clampScore = (val: number) => Math.max(1, Math.min(5, val));
      const business_impact = clampScore(
        pickNumber(raw, ['business_impact', 'business_impact_1_5', 'impact'], 3)
      );
      const risk_level = clampScore(
        pickNumber(raw, ['risk_level', 'risk_level_1_5', 'risk'], 3)
      );
      const urgency = clampScore(pickNumber(raw, ['urgency', 'urgency_1_5'], 3));
      const strategic_importance = clampScore(
        pickNumber(raw, ['strategic_importance', 'strategic_importance_1_5', 'strategic'], 3)
      );

      const approved_budget = Math.max(
        0,
        pickNumber(raw, ['allocated_budget', 'approved_budget', 'budget'], 0)
      );
      const actual_spend = Math.max(0, pickNumber(raw, ['actual_spend', 'spend'], 0));

      const milestoneRaw = pickField(raw, ['milestone_due_date', 'milestone_date']);
      const targetRaw = pickField(raw, ['target_end_date', 'target_date', 'end_date']);

      const data: ProjectInput = {
        ...(project_code ? { project_code } : {}),
        department_id: resolvedDept?.id ?? '',
        category_id: matchedCat?.id ?? null,
        name,
        campus: campusMatch.val,
        project_manager_id: null,
        owner_id: null,
        technical_lead_name:
          pickField(raw, ['technical_lead', 'technical_lead_name']) || 'Department Lead',
        approval_authority:
          pickField(raw, ['approval_authority', 'approver']) || 'Executive Leadership',
        problem_solved: pickField(raw, ['problem_solved', 'problem']),
        expected_benefit: pickField(raw, ['expected_benefit', 'benefit']),
        savings_efficiency: pickField(raw, [
          'savings_efficiency',
          'savings_&_efficiency',
          'savings',
        ]),
        percent_complete,
        schedule_status: schedMatch.val,
        rag_status: ragMatch.val,
        business_impact,
        risk_level,
        urgency,
        strategic_importance,
        approved_budget,
        actual_spend,
        procurement_status: procMatch.val,
        next_milestone: pickField(raw, ['next_milestone', 'milestone']),
        milestone_due_date: milestoneRaw ? formatExcelDate(milestoneRaw) : null,
        target_end_date: formatExcelDate(targetRaw),
      };

      return {
        rowNumber: idx + 2,
        departmentName: resolvedDept?.name ?? '—',
        categoryName: matchedCat?.name ?? '—',
        data,
        errors,
      };
    });

    setParsedRows(parsed);
  };

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    const count = await onImport(validRows.map((r) => r.data));
    setImporting(false);
    if (count > 0) {
      setParsedRows([]);
      setFileName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gsl-700 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-emerald-200" />
            <div>
              <h3 className="text-base font-bold">
                Import Projects from Excel (.xlsx / .csv)
              </h3>
              <p className="text-xs text-emerald-100/85">
                Leave Project Code blank to auto-generate GSL-PROJECT-XXX
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-emerald-100 hover:bg-white/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-bold text-slate-900">
                Standard GSL Multi-Department Excel Template
              </p>
              <p className="text-xs text-slate-500">
                Supports Department, Category, Campus (incl. Anthony), and exact Naira budgets.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gsl-600 bg-white px-3.5 py-2 text-xs font-semibold text-gsl-700 hover:bg-gsl-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download Excel Template
            </button>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 text-center transition hover:border-gsl-600 hover:bg-gsl-50/30">
            <Upload className="h-8 w-8 text-gsl-700" />
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {fileName
                ? `Selected: ${fileName}`
                : 'Click to choose an Excel (.xlsx, .xls) or CSV file'}
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  Preview: {validRows.length} valid row(s) of {parsedRows.length} parsed
                </span>
                {parsedRows.length - validRows.length > 0 && (
                  <span className="font-semibold text-red-600">
                    {parsedRows.length - validRows.length} row(s) skipped due to errors
                  </span>
                )}
              </div>

              <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Department</th>
                      <th className="px-3 py-2">Project Name</th>
                      <th className="px-3 py-2">Campus</th>
                      <th className="px-3 py-2">%</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={row.errors.length > 0 ? 'bg-red-50/70' : ''}
                      >
                        <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-gsl-700">
                          {row.data.project_code || 'Auto'}
                        </td>
                        <td className="px-3 py-2">{row.departmentName}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {row.data.name || '—'}
                        </td>
                        <td className="px-3 py-2">{row.data.campus}</td>
                        <td className="px-3 py-2">{row.data.percent_complete}%</td>
                        <td className="px-3 py-2">
                          <RagBadge status={row.data.rag_status} />
                        </td>
                        <td className="px-3 py-2">
                          {row.errors.length === 0 ? (
                            <span className="font-semibold text-emerald-700">Ready</span>
                          ) : (
                            <span className="font-semibold text-red-700">
                              {row.errors.join('; ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={validRows.length === 0 || importing}
            onClick={handleConfirmImport}
            className="rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white hover:bg-gsl-800 disabled:opacity-50"
          >
            {importing
              ? 'Importing...'
              : `Import ${validRows.length} Project${validRows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
};

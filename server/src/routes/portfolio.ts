import { Router } from 'express';
import { z } from 'zod';
import { syncOverdueLeadershipActions } from '../jobs/overdueActions.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

const bulkImportSchema = z.object({
  projects: z
    .array(
      z.object({
        project_code: z.string().optional().default(''),
        department_id: z.string().uuid().optional(),
        category_id: z.string().uuid().nullable().optional(),
        name: z.string().min(1),
        campus: z.enum(['Lekki', 'Ikoyi', 'Anthos', 'Anthony', 'All Campuses']),
        project_manager_id: z.string().uuid().nullable().optional(),
        owner_id: z.string().uuid().nullable().optional(),
        technical_lead_name: z.string().default(''),
        approval_authority: z.string().default(''),
        problem_solved: z.string().default(''),
        expected_benefit: z.string().default(''),
        savings_efficiency: z.string().default(''),
        percent_complete: z.number().int().min(0).max(100),
        schedule_status: z
          .enum(['On Schedule', 'Behind Schedule', 'Completed', 'Not Started'])
          .default('On Schedule'),
        rag_status: z.enum(['Green', 'Amber', 'Red', 'Blue']),
        business_impact: z.number().min(1).max(5).default(3),
        risk_level: z.number().min(1).max(5).default(3),
        urgency: z.number().min(1).max(5).default(3),
        strategic_importance: z.number().min(1).max(5).default(3),
        approved_budget: z.number().min(0),
        actual_spend: z.number().min(0),
        procurement_status: z
          .enum([
            'Not Started',
            'RFQ / Tendering',
            'Vendor Selected',
            'PO Issued',
            'Delivered',
            'N/A',
          ])
          .default('Not Started'),
        next_milestone: z.string().default(''),
        milestone_due_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        target_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .min(1)
    .max(200),
});

const STATUS_LABEL_MAP: Record<string, string> = {
  Green: 'On Track',
  Amber: 'Attention Needed',
  Red: 'Critical / At Risk',
  Blue: 'Completed',
};

function escapeCsv(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

router.use(authenticate);

router.get('/summary', async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    let projectsQuery = supabase.from('projects').select('*');
    if (req.user?.role === 'Department Admin' || req.user?.role === 'Project Manager') {
      if (!req.user.departmentId) {
        res.json({
          totalProjects: 0,
          completedProjects: 0,
          onTrackProjects: 0,
          attentionProjects: 0,
          criticalProjects: 0,
          behindScheduleProjects: 0,
          avgPercentComplete: 0,
          totalApprovedBudget: 0,
          totalActualSpend: 0,
          remainingBudget: 0,
          openRisks: 0,
          openLeadershipActions: 0,
        });
        return;
      }
      projectsQuery = projectsQuery.eq('department_id', req.user.departmentId);
    } else if (req.user?.role === 'Project Owner') {
      if (!req.user.departmentId) {
        res.json({
          totalProjects: 0,
          completedProjects: 0,
          onTrackProjects: 0,
          attentionProjects: 0,
          criticalProjects: 0,
          behindScheduleProjects: 0,
          avgPercentComplete: 0,
          totalApprovedBudget: 0,
          totalActualSpend: 0,
          remainingBudget: 0,
          openRisks: 0,
          openLeadershipActions: 0,
        });
        return;
      }
      projectsQuery = projectsQuery
        .eq('department_id', req.user.departmentId)
        .eq('owner_id', req.user.id);
    }

    const [projectsRes, risksRes, actionsRes] = await Promise.all([
      projectsQuery,
      supabase.from('risks').select('*'),
      supabase.from('leadership_actions').select('*'),
    ]);

    if (projectsRes.error) throw projectsRes.error;
    if (risksRes.error) throw risksRes.error;
    if (actionsRes.error) throw actionsRes.error;

    const projects = projectsRes.data ?? [];
    const projectIds = new Set(projects.map((p) => p.id));
    const risks = (risksRes.data ?? []).filter((r) => projectIds.has(r.project_id));
    const actions = (actionsRes.data ?? []).filter((a) => projectIds.has(a.project_id));

    const totalProjects = projects.length;
    const completedProjects = projects.filter(
      (p) =>
        p.rag_status === 'Blue' ||
        p.schedule_status === 'Completed' ||
        Number(p.percent_complete) === 100
    ).length;

    const avgPercentComplete =
      totalProjects > 0
        ? Math.round(
            projects.reduce((sum, p) => sum + Number(p.percent_complete || 0), 0) /
              totalProjects
          )
        : 0;

    const totalApprovedBudget = projects.reduce(
      (sum, p) => sum + Number(p.approved_budget || 0),
      0
    );
    const totalActualSpend = projects.reduce(
      (sum, p) => sum + Number(p.actual_spend || 0),
      0
    );

    res.json({
      totalProjects,
      completedProjects,
      onTrackProjects: projects.filter((p) => p.rag_status === 'Green').length,
      attentionProjects: projects.filter((p) => p.rag_status === 'Amber').length,
      criticalProjects: projects.filter((p) => p.rag_status === 'Red').length,
      behindScheduleProjects: projects.filter(
        (p) => p.schedule_status === 'Behind Schedule'
      ).length,
      avgPercentComplete,
      totalApprovedBudget,
      totalActualSpend,
      remainingBudget: totalApprovedBudget - totalActualSpend,
      openRisks: risks.filter((r) => r.status !== 'Closed').length,
      openLeadershipActions: actions.filter((a) => a.status !== 'Closed').length,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('projects')
      .select('*')
      .order('priority_score', { ascending: false });

    let data: Array<Record<string, unknown>> = [];
    const role = req.user?.role;
    const isUnassignedScoped =
      (role === 'Department Admin' ||
        role === 'Project Manager' ||
        role === 'Project Owner') &&
      !req.user?.departmentId;

    if (!isUnassignedScoped) {
      if (role === 'Department Admin' || role === 'Project Manager') {
        query = query.eq('department_id', req.user!.departmentId!);
      } else if (role === 'Project Owner') {
        query = query
          .eq('department_id', req.user!.departmentId!)
          .eq('owner_id', req.user!.id);
      }

      const resData = await query;
      if (resData.error) throw resData.error;
      data = (resData.data ?? []) as Array<Record<string, unknown>>;
    }

    const headers = [
      'Project Code',
      'Project Name',
      'Campus',
      'Technical Lead',
      'Approval Authority',
      '% Complete',
      'Schedule Status',
      'Project Status',
      'Priority Score',
      'Approved Budget',
      'Actual Spend',
      'Remaining Budget',
      'Procurement Status',
      'Next Milestone',
      'Milestone Due Date',
      'Target End Date',
      'Expected Benefit',
    ];

    const rows = (data ?? []).map((p) =>
      [
        p.project_code,
        p.name,
        p.campus,
        p.technical_lead_name,
        p.approval_authority,
        p.percent_complete,
        p.schedule_status,
        STATUS_LABEL_MAP[String(p.rag_status ?? '')] ?? p.rag_status,
        p.priority_score,
        p.approved_budget,
        p.actual_spend,
        Number(p.approved_budget || 0) - Number(p.actual_spend || 0),
        p.procurement_status,
        p.next_milestone,
        p.milestone_due_date,
        p.target_end_date,
        p.expected_benefit,
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gsl-enterprise-portfolio.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/import',
  requireRole(['Super Admin', 'Department Admin', 'Project Manager']),
  async (req, res, next) => {
    try {
      const parsed = bulkImportSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: 'Invalid import payload', details: parsed.error.flatten() });
        return;
      }

      const supabase = getSupabaseAdmin();
      const results = [];

      for (const item of parsed.data.projects) {
        const deptId =
          req.user?.role === 'Super Admin'
            ? item.department_id
            : req.user?.departmentId;

        if (!deptId) continue;

        const row = {
          ...item,
          department_id: deptId,
          updated_by: req.user?.id,
        };

        const trimmedCode = item.project_code?.trim() || '';
        if (trimmedCode !== '') {
          if (req.user?.role !== 'Super Admin') {
            const { data: existing } = await supabase
              .from('projects')
              .select('id, department_id')
              .eq('project_code', trimmedCode)
              .maybeSingle();

            if (existing && existing.department_id !== deptId) {
              res.status(403).json({
                error: `Cannot overwrite ${trimmedCode}: belongs to another department.`,
              });
              return;
            }
          }

          const { data, error } = await supabase
            .from('projects')
            .upsert({ ...row, project_code: trimmedCode }, { onConflict: 'project_code' })
            .select('id, project_code')
            .single();
          if (error) throw error;
          if (data) results.push(data);
        } else {
          const { project_code: _omit, ...insertRow } = row;
          const { data, error } = await supabase
            .from('projects')
            .insert(insertRow)
            .select('id, project_code')
            .single();
          if (error) throw error;
          if (data) results.push(data);
        }
      }

      res.status(200).json({
        importedCount: results.length,
        projects: results,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/sync-overdue',
  requireRole(['Super Admin', 'Department Admin', 'Project Manager']),
  async (_req, res, next) => {
    try {
      const updatedCount = await syncOverdueLeadershipActions();
      res.json({ updatedCount });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

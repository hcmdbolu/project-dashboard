import { Router } from 'express';
import { z } from 'zod';
import { syncOverdueLeadershipActions } from '../jobs/overdueActions.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { AuthenticatedUser, authenticate, requireRole } from '../middleware/auth.js';

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
        owner_ids: z.array(z.string().uuid()).optional(),
        owner_department_ids: z.array(z.string().uuid()).optional(),
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

async function fetchVisibleProjectsForUser(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  user: AuthenticatedUser
): Promise<Array<Record<string, unknown>>> {
  if (user.role === 'Super Admin' || user.role === 'Executive') {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('priority_score', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  const [coOwnerRes, deptOwnerRes] = await Promise.all([
    supabase.from('project_owners').select('project_id').eq('user_id', user.id),
    user.departmentId
      ? supabase
          .from('project_department_owners')
          .select('project_id')
          .eq('department_id', user.departmentId)
      : Promise.resolve({ data: [] as Array<{ project_id: string }>, error: null }),
  ]);

  if (coOwnerRes.error) throw coOwnerRes.error;
  if (deptOwnerRes.error) throw deptOwnerRes.error;

  const extraIds = Array.from(
    new Set([
      ...(coOwnerRes.data ?? []).map((r) => String(r.project_id)),
      ...(deptOwnerRes.data ?? []).map((r) => String(r.project_id)),
    ])
  );

  let query = supabase
    .from('projects')
    .select('*')
    .order('priority_score', { ascending: false });

  if (user.role === 'Department Admin' || user.role === 'Project Manager') {
    if (user.departmentId && extraIds.length > 0) {
      query = query.or(
        `department_id.eq.${user.departmentId},id.in.(${extraIds.join(',')})`
      );
    } else if (user.departmentId) {
      query = query.eq('department_id', user.departmentId);
    } else if (extraIds.length > 0) {
      query = query.in('id', extraIds);
    } else {
      return [];
    }
  } else if (user.role === 'Project Owner') {
    if (extraIds.length > 0) {
      query = query.or(`id.in.(${extraIds.join(',')}),owner_id.eq.${user.id}`);
    } else {
      query = query.eq('owner_id', user.id);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

router.use(authenticate);

router.get('/summary', async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const projects = await fetchVisibleProjectsForUser(supabase, req.user!);

    const [risksRes, actionsRes] = await Promise.all([
      supabase.from('risks').select('*'),
      supabase.from('leadership_actions').select('*'),
    ]);

    if (risksRes.error) throw risksRes.error;
    if (actionsRes.error) throw actionsRes.error;

    const projectIds = new Set(projects.map((p) => String(p.id)));
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
    const data = await fetchVisibleProjectsForUser(supabase, req.user!);
    const projectIds = data.map((p) => String(p.id));

    const [coOwnersRes, deptOwnersRes, profilesRes, deptsRes] = await Promise.all([
      projectIds.length > 0
        ? supabase.from('project_owners').select('project_id, user_id').in('project_id', projectIds)
        : Promise.resolve({ data: [] as Array<{ project_id: string; user_id: string }>, error: null }),
      projectIds.length > 0
        ? supabase
            .from('project_department_owners')
            .select('project_id, department_id')
            .in('project_id', projectIds)
        : Promise.resolve({ data: [] as Array<{ project_id: string; department_id: string }>, error: null }),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('departments').select('id, name'),
    ]);

    if (coOwnersRes.error) throw coOwnersRes.error;
    if (deptOwnersRes.error) throw deptOwnersRes.error;
    if (profilesRes.error) throw profilesRes.error;
    if (deptsRes.error) throw deptsRes.error;

    const profileMap = new Map(
      (profilesRes.data ?? []).map((u) => [String(u.id), String(u.full_name || '')])
    );
    const deptMap = new Map(
      (deptsRes.data ?? []).map((d) => [String(d.id), String(d.name || '')])
    );

    const coOwnersByProj = new Map<string, string[]>();
    (coOwnersRes.data ?? []).forEach((row) => {
      const pid = String(row.project_id);
      const label = profileMap.get(String(row.user_id));
      if (label) {
        coOwnersByProj.set(pid, [...(coOwnersByProj.get(pid) ?? []), label]);
      }
    });

    const deptOwnersByProj = new Map<string, string[]>();
    (deptOwnersRes.data ?? []).forEach((row) => {
      const pid = String(row.project_id);
      const label = deptMap.get(String(row.department_id));
      if (label) {
        deptOwnersByProj.set(pid, [...(deptOwnersByProj.get(pid) ?? []), label]);
      }
    });

    const headers = [
      'Project Code',
      'Project Name',
      'Campus',
      'Project Owners',
      'Department Owners',
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

    const rows = data.map((p) => {
      const pid = String(p.id);
      const owners = coOwnersByProj.get(pid)?.join('; ') || '';
      const deptOwners = deptOwnersByProj.get(pid)?.join('; ') || '';
      return [
        p.project_code,
        p.name,
        p.campus,
        owners,
        deptOwners,
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
        .join(',');
    });

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

        const { owner_ids, owner_department_ids, ...restItem } = item;
        const primaryOwnerId =
          owner_ids && owner_ids.length > 0 ? owner_ids[0] : (restItem.owner_id ?? null);

        const row = {
          ...restItem,
          owner_id: primaryOwnerId,
          department_id: deptId,
          updated_by: req.user?.id,
        };

        let savedProject: { id: string; project_code: string } | null = null;
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
          if (data) savedProject = data;
        } else {
          const { project_code: _omit, ...insertRow } = row;
          const { data, error } = await supabase
            .from('projects')
            .insert(insertRow)
            .select('id, project_code')
            .single();
          if (error) throw error;
          if (data) savedProject = data;
        }

        if (savedProject) {
          results.push(savedProject);
          const resolvedOwnerIds =
            owner_ids ?? (primaryOwnerId ? [primaryOwnerId] : []);
          if (owner_ids !== undefined || primaryOwnerId) {
            await supabase
              .from('project_owners')
              .delete()
              .eq('project_id', savedProject.id);
            if (resolvedOwnerIds.length > 0) {
              await supabase.from('project_owners').insert(
                Array.from(new Set(resolvedOwnerIds)).map((uid) => ({
                  project_id: savedProject!.id,
                  user_id: uid,
                }))
              );
            }
          }
          if (owner_department_ids !== undefined) {
            await supabase
              .from('project_department_owners')
              .delete()
              .eq('project_id', savedProject.id);
            if (owner_department_ids.length > 0) {
              await supabase.from('project_department_owners').insert(
                Array.from(new Set(owner_department_ids)).map((did) => ({
                  project_id: savedProject!.id,
                  department_id: did,
                }))
              );
            }
          }
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

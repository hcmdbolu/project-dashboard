import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

const upsertBudgetSchema = z.object({
  department_id: z.string().uuid(),
  fiscal_period: z.string().min(3).max(60),
  proposed_amount: z.number().min(0),
  status: z.enum(['Draft', 'Pending Approval']).default('Pending Approval'),
  review_notes: z.string().max(500).default(''),
});

const reviewBudgetSchema = z.object({
  status: z.enum(['Approved', 'Rejected']),
  approved_amount: z.number().min(0),
  review_notes: z.string().max(500).default(''),
});

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('department_budgets')
      .select('*')
      .order('updated_at', { ascending: false });

    if (req.user?.role !== 'Super Admin' && req.user?.role !== 'Executive') {
      if (!req.user?.departmentId) {
        res.json({ budgets: [] });
        return;
      }
      query = query.eq('department_id', req.user.departmentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ budgets: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requireRole(['Super Admin', 'Department Admin']),
  async (req, res, next) => {
    try {
      const parsed = upsertBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid budget payload', details: parsed.error.flatten() });
        return;
      }

      const departmentId =
        req.user?.role === 'Department Admin'
          ? req.user.departmentId
          : parsed.data.department_id;

      if (!departmentId) {
        res.status(400).json({ error: 'Department ID is required.' });
        return;
      }

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('department_budgets')
        .upsert(
          {
            department_id: departmentId,
            fiscal_period: parsed.data.fiscal_period,
            proposed_amount: parsed.data.proposed_amount,
            status: parsed.data.status,
            submitted_by: req.user?.id,
            review_notes: parsed.data.review_notes,
          },
          { onConflict: 'department_id,fiscal_period' }
        )
        .select('*')
        .single();

      if (error) throw error;
      res.status(200).json({ budget: data });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:id/review',
  requireRole(['Super Admin']),
  async (req, res, next) => {
    try {
      const parsed = reviewBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid review payload', details: parsed.error.flatten() });
        return;
      }

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('department_budgets')
        .update({
          status: parsed.data.status,
          approved_amount:
            parsed.data.status === 'Approved' ? parsed.data.approved_amount : 0,
          approved_by: req.user?.id,
          review_notes: parsed.data.review_notes,
        })
        .eq('id', req.params.id)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'Budget proposal not found.' });
        return;
      }
      res.json({ budget: data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

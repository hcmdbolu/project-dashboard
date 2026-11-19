import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

const departmentSchema = z.object({
  name: z.string().min(2).max(80),
  code: z.string().min(2).max(12).toUpperCase(),
  description: z.string().max(400).default(''),
});

router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json({ departments: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole(['Super Admin']), async (req, res, next) => {
  try {
    const parsed = departmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid department payload', details: parsed.error.flatten() });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('departments')
      .insert(parsed.data)
      .select('*')
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(201).json({ department: data });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRole(['Super Admin']), async (req, res, next) => {
  try {
    const parsed = departmentSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid department update', details: parsed.error.flatten() });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('departments')
      .update(parsed.data)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ department: data });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole(['Super Admin']), async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('departments').delete().eq('id', req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ deletedId: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { AppRole, authenticate, requireRole } from '../middleware/auth';

const router = Router();

const allRolesEnum = z.enum([
  'Super Admin',
  'Executive',
  'Department Admin',
  'Project Manager',
  'Project Owner',
]);
const deptAllowedRoles: AppRole[] = ['Department Admin', 'Project Manager', 'Project Owner'];
const campusEnum = z.enum(['Lekki', 'Ikoyi', 'Anthos', 'Anthony', 'All Campuses']);

const createUserSchema = z.object({
  full_name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: allRolesEnum,
  department_id: z.string().uuid().nullable().optional(),
  campus: campusEnum.default('All Campuses'),
});

const updateRoleSchema = z.object({
  role: allRolesEnum,
  department_id: z.string().uuid().nullable().optional(),
  campus: campusEnum.optional(),
});

router.use(authenticate);
router.use(requireRole(['Super Admin', 'Department Admin']));

router.get('/users', async (req, res, next) => {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('profiles')
      .select('id, email, full_name, role, department_id, campus, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (req.user?.role === 'Department Admin') {
      if (!req.user.departmentId) {
        res.json({ users: [] });
        return;
      }
      query = query.eq('department_id', req.user.departmentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ users: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid user payload', details: parsed.error.flatten() });
      return;
    }

    const { full_name, email, password, campus } = parsed.data;
    let targetRole = parsed.data.role;
    let targetDeptId = parsed.data.department_id ?? null;

    if (req.user?.role === 'Department Admin') {
      if (!req.user.departmentId) {
        res.status(403).json({ error: 'Department Admin is not assigned to a department.' });
        return;
      }
      if (!deptAllowedRoles.includes(targetRole)) {
        res.status(403).json({
          error: 'Department Admins can only assign Department Admin, Project Manager, or Project Owner roles.',
        });
        return;
      }
      targetDeptId = req.user.departmentId;
    }

    const supabase = getSupabaseAdmin();
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !created.user) {
      res.status(400).json({ error: createError?.message || 'Failed to create Auth user.' });
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: created.user.id,
          email,
          full_name,
          role: targetRole,
          department_id: targetDeptId,
          campus,
        },
        { onConflict: 'id' }
      )
      .select('id, email, full_name, role, department_id, campus, created_at, updated_at')
      .single();

    if (profileError) {
      await supabase.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }

    res.status(201).json({ user: profile });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid role payload', details: parsed.error.flatten() });
      return;
    }

    const targetUserId = req.params.id;
    if (req.user?.id === targetUserId && parsed.data.role !== req.user.role) {
      res.status(400).json({ error: 'You cannot demote your own active session role.' });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: existing, error: existingErr } = await supabase
      .from('profiles')
      .select('id, role, department_id')
      .eq('id', targetUserId)
      .single();

    if (existingErr || !existing) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    if (req.user?.role === 'Department Admin') {
      if (existing.department_id !== req.user.departmentId) {
        res.status(403).json({ error: 'Cannot modify users outside your department.' });
        return;
      }
      if (
        !deptAllowedRoles.includes(existing.role as AppRole) ||
        !deptAllowedRoles.includes(parsed.data.role)
      ) {
        res.status(403).json({
          error: 'Department Admins cannot modify or assign Super Admin or Executive roles.',
        });
        return;
      }
    }

    const patch: Record<string, string | null> = { role: parsed.data.role };
    if (parsed.data.campus) patch.campus = parsed.data.campus;
    if (req.user?.role === 'Super Admin' && parsed.data.department_id !== undefined) {
      patch.department_id = parsed.data.department_id;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', targetUserId)
      .select('id, email, full_name, role, department_id, campus, updated_at')
      .single();

    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    if (req.user?.id === targetUserId) {
      res.status(400).json({ error: 'You cannot delete your own active account.' });
      return;
    }

    const supabase = getSupabaseAdmin();
    if (req.user?.role === 'Department Admin') {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id, role, department_id')
        .eq('id', targetUserId)
        .single();

      if (!existing || existing.department_id !== req.user.departmentId) {
        res.status(403).json({ error: 'Cannot delete users outside your department.' });
        return;
      }
      if (!deptAllowedRoles.includes(existing.role as AppRole)) {
        res.status(403).json({ error: 'Department Admins cannot delete Super Admin or Executive users.' });
        return;
      }
    }

    const { error } = await supabase.auth.admin.deleteUser(targetUserId);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ deletedId: targetUserId });
  } catch (err) {
    next(err);
  }
});

export default router;

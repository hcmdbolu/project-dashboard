import { NextFunction, Request, Response } from 'express';
import { getSupabaseAdmin, getSupabaseAuthClient } from '../lib/supabaseAdmin';

export type AppRole =
  | 'Super Admin'
  | 'Executive'
  | 'Department Admin'
  | 'Project Manager'
  | 'Project Owner';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
  departmentId: string | null;
  campus: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header.' });
      return;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ error: 'Empty bearer token.' });
      return;
    }

    const supabaseAuth = getSupabaseAuthClient();
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !userData.user) {
      res.status(401).json({ error: 'Invalid or expired authentication token.' });
      return;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, department_id, campus')
      .eq('id', userData.user.id)
      .single();

    if (profileError || !profile) {
      res.status(403).json({ error: 'User profile not provisioned.' });
      return;
    }

    req.user = {
      id: profile.id,
      email: profile.email,
      role: profile.role as AppRole,
      fullName: profile.full_name,
      departmentId: profile.department_id ?? null,
      campus: profile.campus,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(allowedRoles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: requires role [${allowedRoles.join(', ')}], current role is '${req.user.role}'.`,
      });
      return;
    }

    next();
  };
}

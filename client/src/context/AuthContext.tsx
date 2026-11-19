import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { DEMO_USERS } from '../data/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AppRole, Profile, Project } from '../types/portfolio';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  role: AppRole;
  departmentId: string | null;
  isSuperAdmin: boolean;
  isExecutive: boolean;
  isDepartmentAdmin: boolean;
  isOrgWide: boolean;
  canCreateProject: boolean;
  canManageUsers: boolean;
  canManageDepartments: boolean;
  canViewBudgets: boolean;
  canProposeBudgets: boolean;
  canApproveBudgets: boolean;
  canEditProject: (project: Pick<Project, 'department_id' | 'owner_id'>) => boolean;
  canDeleteProject: (project: Pick<Project, 'department_id'>) => boolean;
  loading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  setDemoUserById: (profileId: string) => void;
  setDemoRole: (role: AppRole) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_PROFILE_BY_ROLE: Record<AppRole, Profile> = {
  'Super Admin': DEMO_USERS.find((u) => u.role === 'Super Admin')!,
  Executive: DEMO_USERS.find((u) => u.role === 'Executive')!,
  'Department Admin': DEMO_USERS.find((u) => u.role === 'Department Admin')!,
  'Project Manager': DEMO_USERS.find((u) => u.role === 'Project Manager')!,
  'Project Owner': DEMO_USERS.find((u) => u.role === 'Project Owner')!,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(
    isSupabaseConfigured ? null : DEMO_PROFILE_BY_ROLE['Super Admin']
  );
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  const loadProfile = useCallback(async (userId: string, fallbackEmail = '') => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, department_id, campus, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
    } else {
      setProfile({
        id: userId,
        email: fallbackEmail,
        full_name: fallbackEmail.split('@')[0] || 'GSL User',
        role: 'Executive',
        department_id: null,
        campus: 'All Campuses',
      });
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id, data.session.user.email ?? '');
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await loadProfile(newSession.user.id, newSession.user.email ?? '');
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      setProfile(DEMO_PROFILE_BY_ROLE['Super Admin']);
      return {};
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) {
      return { error: 'Sign up requires Supabase configuration.' };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    return error ? { error: error.message } : {};
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      setProfile(DEMO_PROFILE_BY_ROLE.Executive);
      return;
    }
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const setDemoUserById = useCallback((profileId: string) => {
    if (isSupabaseConfigured) return;
    const found = DEMO_USERS.find((u) => u.id === profileId);
    if (found) setProfile(found);
  }, []);

  const setDemoRole = useCallback((nextRole: AppRole) => {
    if (isSupabaseConfigured) return;
    setProfile(DEMO_PROFILE_BY_ROLE[nextRole]);
  }, []);

  const role: AppRole = profile?.role ?? 'Executive';
  const departmentId = profile?.department_id ?? null;

  const isSuperAdmin = role === 'Super Admin';
  const isExecutive = role === 'Executive';
  const isDepartmentAdmin = role === 'Department Admin';
  const isOrgWide = isSuperAdmin || isExecutive;

  const canCreateProject =
    isSuperAdmin || isDepartmentAdmin || role === 'Project Manager';
  const canManageUsers = isSuperAdmin || isDepartmentAdmin;
  const canManageDepartments = isSuperAdmin;
  const canViewBudgets = isSuperAdmin || isExecutive || isDepartmentAdmin;
  const canProposeBudgets = isSuperAdmin || isDepartmentAdmin;
  const canApproveBudgets = isSuperAdmin;

  const canEditProject = useCallback(
    (project: Pick<Project, 'department_id' | 'owner_id'>): boolean => {
      if (isSuperAdmin) return true;
      if (isExecutive) return false;
      if (!departmentId || project.department_id !== departmentId) return false;
      if (isDepartmentAdmin || role === 'Project Manager') return true;
      if (role === 'Project Owner' && profile?.id && project.owner_id === profile.id) {
        return true;
      }
      return false;
    },
    [departmentId, isDepartmentAdmin, isExecutive, isSuperAdmin, profile?.id, role]
  );

  const canDeleteProject = useCallback(
    (project: Pick<Project, 'department_id'>): boolean => {
      if (isSuperAdmin) return true;
      if (isDepartmentAdmin && departmentId && project.department_id === departmentId) {
        return true;
      }
      return false;
    },
    [departmentId, isDepartmentAdmin, isSuperAdmin]
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        role,
        departmentId,
        isSuperAdmin,
        isExecutive,
        isDepartmentAdmin,
        isOrgWide,
        canCreateProject,
        canManageUsers,
        canManageDepartments,
        canViewBudgets,
        canProposeBudgets,
        canApproveBudgets,
        canEditProject,
        canDeleteProject,
        loading,
        isDemoMode: !isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        setDemoUserById,
        setDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

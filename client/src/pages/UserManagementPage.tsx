import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Shield, Trash2, X } from 'lucide-react';
import {
  CampusBadge,
  DepartmentBadge,
  RoleBadge,
} from '../components/ui/Badges';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { usePortfolio } from '../context/PortfolioContext';
import {
  APP_ROLES,
  CAMPUSES,
  DEPT_ADMIN_ASSIGNABLE_ROLES,
} from '../lib/formatters';
import { AppRole, Campus, Profile } from '../types/portfolio';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://localhost:4000';

export const UserManagementPage: React.FC = () => {
  const {
    session,
    isDemoMode,
    profile,
    departmentId,
    isSuperAdmin,
    isDepartmentAdmin,
  } = useAuth();
  const { departments, profiles, getDepartmentName, pushToast, refreshAll } =
    usePortfolio();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('Project Manager');
  const [newDeptId, setNewDeptId] = useState<string>(departmentId ?? '');
  const [newCampus, setNewCampus] = useState<Campus>('All Campuses');
  const [creating, setCreating] = useState(false);

  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const assignableRoles = useMemo(
    () =>
      isDepartmentAdmin && !isSuperAdmin
        ? DEPT_ADMIN_ASSIGNABLE_ROLES
        : APP_ROLES,
    [isDepartmentAdmin, isSuperAdmin]
  );

  const roleRequiresDepartment = (r: AppRole) =>
    r === 'Department Admin' ||
    r === 'Project Manager' ||
    r === 'Project Owner';

  const loadUsers = useCallback(async () => {
    if (isDemoMode) {
      const scoped =
        isDepartmentAdmin && !isSuperAdmin
          ? profiles.filter((u) => u.department_id === departmentId)
          : profiles;
      setUsers(scoped);
      setLoading(false);
      return;
    }

    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch users.');
      }
      setUsers(json.users ?? []);
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'User Load Failed',
        message: err instanceof Error ? err.message : 'Server unreachable.',
      });
    } finally {
      setLoading(false);
    }
  }, [
    isDemoMode,
    profiles,
    isDepartmentAdmin,
    isSuperAdmin,
    departmentId,
    session?.access_token,
    pushToast,
  ]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleOpenCreate = () => {
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('Project Manager');
    setNewDeptId(
      isSuperAdmin ? departments[0]?.id ?? '' : departmentId ?? ''
    );
    setNewCampus('All Campuses');
    setCreateOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedDept = roleRequiresDepartment(newRole)
      ? isSuperAdmin
        ? newDeptId || null
        : departmentId
      : null;

    if (roleRequiresDepartment(newRole) && !resolvedDept) {
      pushToast({
        type: 'error',
        title: 'Department Required',
        message: 'Select a department for this role.',
      });
      return;
    }

    if (isDemoMode) {
      const demoCreated: Profile = {
        id: `demo-user-${Date.now()}`,
        full_name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        department_id: resolvedDept,
        campus: newCampus,
      };
      setUsers((prev) => [...prev, demoCreated]);
      setCreateOpen(false);
      pushToast({
        type: 'success',
        title: 'Demo User Created',
        message: `${demoCreated.full_name} added (${demoCreated.role}).`,
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          full_name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          role: newRole,
          department_id: resolvedDept,
          campus: newCampus,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Unable to create user.');
      }
      setUsers((prev) => [...prev, json.user]);
      setCreateOpen(false);
      pushToast({
        type: 'success',
        title: 'User Created',
        message: `${json.user.full_name} (${json.user.role}) has been created.`,
      });
      await refreshAll();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Create User Failed',
        message: err instanceof Error ? err.message : 'Unknown error.',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (
    targetUser: Profile,
    nextRole: AppRole,
    nextDeptId: string | null
  ) => {
    const resolvedDept = roleRequiresDepartment(nextRole) ? nextDeptId : null;

    if (isDemoMode) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? { ...u, role: nextRole, department_id: resolvedDept }
            : u
        )
      );
      pushToast({
        type: 'success',
        title: 'User Updated (Demo)',
        message: `${targetUser.full_name} updated to ${nextRole}.`,
      });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${targetUser.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          role: nextRole,
          department_id: resolvedDept,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Role update failed.');
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, ...json.user } : u))
      );
      pushToast({
        type: 'success',
        title: 'Access Updated',
        message: `${targetUser.full_name} is now ${nextRole}.`,
      });
      await refreshAll();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Update Failed',
        message: err instanceof Error ? err.message : 'Unable to update user.',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    if (isDemoMode) {
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      setDeletingUser(null);
      pushToast({ type: 'success', title: 'Demo User Removed' });
      return;
    }

    setDeletingBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed.');
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      setDeletingUser(null);
      pushToast({
        type: 'success',
        title: 'User Deleted',
        message: `${deletingUser.full_name} removed from GSL Portfolio.`,
      });
      await refreshAll();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Unable to delete user.',
      });
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            User &amp; Role Administration
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isSuperAdmin
              ? 'Manage school-wide user accounts, 5-tier RBAC roles, and department assignments.'
              : `Scoped to ${getDepartmentName(departmentId)} — manage Department Admins, Project Managers, and Project Owners in your department.`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-gsl-800"
        >
          <Plus className="h-3.5 w-3.5" />
          Add User Account
        </button>
      </div>

      {/* Role Reference Strip */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {[
          {
            role: 'Super Admin' as AppRole,
            summary: 'Global control across departments, budgets, and users.',
          },
          {
            role: 'Executive' as AppRole,
            summary: 'School-wide read-only visibility across all portfolios.',
          },
          {
            role: 'Department Admin' as AppRole,
            summary: 'Full CRUD, budgets, and user management in own dept.',
          },
          {
            role: 'Project Manager' as AppRole,
            summary: 'Creates & edits projects, risks, actions in own dept.',
          },
          {
            role: 'Project Owner' as AppRole,
            summary: 'Scoped strictly to own assigned projects; no /reports.',
          },
        ].map((item) => (
          <div
            key={item.role}
            className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
          >
            <RoleBadge role={item.role} />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
              {item.summary}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Staff Member</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Campus</th>
              <th className="px-4 py-3">Role Assignment</th>
              <th className="px-4 py-3 text-right">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Loading user directory...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No user accounts found in this department.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.id === profile?.id;
                const lockedByDeptAdmin =
                  isDepartmentAdmin &&
                  !isSuperAdmin &&
                  !(DEPT_ADMIN_ASSIGNABLE_ROLES as readonly AppRole[]).includes(
                    u.role
                  );

                return (
                  <tr key={u.id} className="hover:bg-slate-50/75">
                    <td className="px-4 py-3.5 font-semibold text-slate-900">
                      {u.full_name}
                      {isSelf && (
                        <span className="ml-2 rounded bg-gsl-100 px-1.5 py-0.5 text-[10px] font-bold text-gsl-800">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3.5">
                      {isSuperAdmin && roleRequiresDepartment(u.role) ? (
                        <select
                          aria-label={`Change department for ${u.full_name}`}
                          value={u.department_id ?? ''}
                          disabled={isSelf}
                          onChange={(e) =>
                            handleUpdateUser(u, u.role, e.target.value || null)
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-60"
                        >
                          <option value="">Unassigned</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      ) : u.department_id ? (
                        <DepartmentBadge name={getDepartmentName(u.department_id)} />
                      ) : (
                        <span className="text-[11px] font-medium text-slate-500">
                          School-Wide
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <CampusBadge campus={u.campus} />
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        aria-label={`Change role for ${u.full_name}`}
                        value={u.role}
                        disabled={isSelf || lockedByDeptAdmin}
                        onChange={(e) => {
                          const nextRole = e.target.value as AppRole;
                          const fallbackDept =
                            u.department_id ||
                            departmentId ||
                            departments[0]?.id ||
                            null;
                          handleUpdateUser(u, nextRole, fallbackDept);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-60"
                      >
                        {assignableRoles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        disabled={isSelf || lockedByDeptAdmin}
                        onClick={() => setDeletingUser(u)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title={
                          isSelf
                            ? 'Cannot delete active session user'
                            : 'Delete user'
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleCreateUser}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gsl-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Create Staff Account
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Chinedu Okonkwo"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                School Email *
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@greenspringsschool.com"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Temporary Password *
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Role *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AppRole)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                >
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Primary Campus
                </label>
                <select
                  value={newCampus}
                  onChange={(e) => setNewCampus(e.target.value as Campus)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                >
                  {CAMPUSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {roleRequiresDepartment(newRole) && (
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Assigned Department *
                </label>
                {isSuperAdmin ? (
                  <select
                    required
                    value={newDeptId}
                    onChange={(e) => setNewDeptId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="">Select department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
                    {getDepartmentName(departmentId)}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-gsl-700 px-4 py-2 text-xs font-semibold text-white hover:bg-gsl-800 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deletingUser)}
        title="Delete User Account"
        message={`Permanently remove ${deletingUser?.full_name} (${deletingUser?.email}) from GSL Enterprise Portfolio?`}
        confirmLabel="Delete User"
        busy={deletingBusy}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingUser(null)}
      />
    </div>
  );
};

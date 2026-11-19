import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppRole } from '../../types/portfolio';

interface AuthGuardProps {
  allowedRoles?: AppRole[];
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ allowedRoles }) => {
  const { session, loading, isDemoMode, role } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-gsl-700 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Loading GSL Portfolio...</p>
        </div>
      </div>
    );
  }

  if (!isDemoMode && !session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

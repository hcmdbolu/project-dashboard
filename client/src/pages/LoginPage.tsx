import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { GslLogo } from '../components/ui/GslLogo';
import { useAuth } from '../context/AuthContext';
import { GOVERNANCE_META } from '../lib/formatters';

export const LoginPage: React.FC = () => {
  const { session, isDemoMode, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isDemoMode || session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);

    if (mode === 'signin') {
      const res = await signIn(email.trim(), password);
      if (res.error) setError(res.error);
    } else {
      const res = await signUp(email.trim(), password, fullName.trim());
      if (res.error) {
        setError(res.error);
      } else {
        setNotice(
          'Account created with Executive (read-only) access. Check your inbox if email confirmation is enabled.'
        );
        setMode('signin');
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gsl-900 via-gsl-700 to-slate-800 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <GslLogo className="h-11 w-11 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gsl-700">
              {GOVERNANCE_META.organization} • Enterprise Operations
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              Enterprise Portfolio Management
            </h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-slate-600">
          {mode === 'signin'
            ? 'Sign in with your GSL credentials to access department portfolios across Lekki, Ikoyi, Anthos, and Anthony.'
            : 'Create an account. New accounts default to Executive (read-only) access.'}
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Adaeze Okafor"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-gsl-600 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700">Email</label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@greenspringsschool.com"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3.5 text-sm focus:border-gsl-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Password</label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-10 text-sm focus:border-gsl-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gsl-700 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gsl-600 disabled:opacity-60"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'signin'
                ? 'Sign In'
                : 'Create Account'}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-100 pt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
            className="text-xs font-semibold text-gsl-700 hover:underline"
          >
            {mode === 'signin'
              ? 'Need an account? Register here'
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

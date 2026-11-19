import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { usePortfolio } from '../../context/PortfolioContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = usePortfolio();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
              ? AlertCircle
              : Info;
        const colorClasses =
          toast.type === 'success'
            ? 'border-emerald-200 bg-white text-slate-900'
            : toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-slate-200 bg-white text-slate-900';

        const iconColor =
          toast.type === 'success'
            ? 'text-emerald-600'
            : toast.type === 'error'
              ? 'text-red-600'
              : 'text-slate-600';

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl border p-3.5 shadow-lg ${colorClasses}`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.message && (
                <p className="mt-0.5 text-xs text-slate-600">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};


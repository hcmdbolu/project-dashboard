import React, { useEffect, useState } from 'react';

interface InlinePercentEditorProps {
  value: number;
  canEdit: boolean;
  onCommit: (nextValue: number) => Promise<boolean>;
}

export const InlinePercentEditor: React.FC<InlinePercentEditorProps> = ({
  value,
  canEdit,
  onCommit,
}) => {
  const [draft, setDraft] = useState<string>(String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = async () => {
    const parsed = Number(draft);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(parsed)));
    setDraft(String(clamped));
    if (clamped === value) return;

    setSaving(true);
    const ok = await onCommit(clamped);
    setSaving(false);
    if (!ok) {
      setDraft(String(value));
    }
  };

  if (!canEdit) {
    return (
      <div className="flex min-w-[120px] items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gsl-700 transition-all"
            style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          />
        </div>
        <span className="w-9 text-right text-xs font-semibold text-slate-700">
          {value}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-[136px] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gsl-700 transition-all"
          style={{ width: `${Math.max(0, Math.min(100, Number(draft) || 0))}%` }}
        />
      </div>
      <div className="relative flex items-center">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          disabled={saving}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setDraft(String(value));
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Percent complete"
          className="w-14 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-right text-xs font-semibold text-slate-800 focus:border-gsl-600 focus:bg-white focus:outline-none disabled:opacity-60"
        />
        <span className="ml-1 text-xs text-slate-500">%</span>
      </div>
    </div>
  );
};


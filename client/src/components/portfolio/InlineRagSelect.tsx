import React, { useState } from 'react';
import { getRagLabel, RAG_COLORS, RAG_STATUSES } from '../../lib/formatters';
import { RagStatus } from '../../types/portfolio';
import { RagBadge } from '../ui/Badges';

interface InlineRagSelectProps {
  value: RagStatus;
  canEdit: boolean;
  onCommit: (nextStatus: RagStatus) => Promise<boolean>;
}

export const InlineRagSelect: React.FC<InlineRagSelectProps> = ({
  value,
  canEdit,
  onCommit,
}) => {
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return <RagBadge status={value} />;
  }

  const style = RAG_COLORS[value];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${style.pill}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
      <select
        value={value}
        disabled={saving}
        aria-label="Project status"
        onChange={async (e) => {
          const next = e.target.value as RagStatus;
          if (next === value) return;
          setSaving(true);
          await onCommit(next);
          setSaving(false);
        }}
        className="cursor-pointer bg-transparent text-xs font-semibold focus:outline-none disabled:opacity-60"
      >
        {RAG_STATUSES.map((status) => (
          <option key={status} value={status} className="bg-white text-slate-900">
            {getRagLabel(status)}
          </option>
        ))}
      </select>
    </div>
  );
};

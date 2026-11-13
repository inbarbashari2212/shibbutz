import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { SlotStatus } from '../types/schedule';

interface StatusBadgeProps {
  status: SlotStatus;
  compact?: boolean;
  labelOverride?: string;
}

export function StatusBadge({
  status,
  compact = false,
  labelOverride,
}: StatusBadgeProps) {
  if (status === 'green') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
        {!compact && <span>{labelOverride ?? 'תקין'}</span>}
      </span>
    );
  }
  if (status === 'yellow') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-300/90">
        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
        {!compact && <span>{labelOverride ?? 'רצף כפול (אזהרה)'}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-300">
      <XCircle className="h-3 w-3 shrink-0 text-rose-600" />
      {!compact && <span>{labelOverride ?? 'התנגשות / חסום'}</span>}
    </span>
  );
}

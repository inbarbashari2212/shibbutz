import { ArrowLeftRight, ArrowUpDown, Trash2, Users, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { COLOR_THEMES } from '../data/presets';
import { DAY_LABELS, DAYS_ORDER, formatRange } from '../engine/timeUtils';
import {
  Kid,
  Professional,
  ScheduleState,
  Session,
  SlotEvaluation,
} from '../types/schedule';
import { StatusBadge } from './StatusBadge';

interface FlatTableViewProps {
  state: ScheduleState;
  filteredSessions: Session[];
  evaluations: Record<string, SlotEvaluation>;
  onSelectSession: (session: Session) => void;
  onDeleteSession: (sessionId: string) => void;
}

type SortKey = 'time' | 'prof' | 'type' | 'status';

export function FlatTableView({
  state,
  filteredSessions,
  evaluations,
  onSelectSession,
  onDeleteSession,
}: FlatTableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortAsc, setSortAsc] = useState(true);

  const profMap = useMemo(
    () => new Map<string, Professional>(state.professionals.map((p) => [p.id, p])),
    [state.professionals],
  );
  const kidMap = useMemo(
    () => new Map<string, Kid>(state.kids.map((k) => [k.id, k])),
    [state.kids],
  );

  const sortedSessions = useMemo(() => {
    const rankStatus = { red: 0, yellow: 1, green: 2 } as const;
    const copy = [...filteredSessions];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'time') {
        cmp = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
        if (cmp === 0) cmp = a.startMin - b.startMin;
      } else if (sortKey === 'prof') {
        const pa = profMap.get(a.professionalId)?.name ?? '';
        const pb = profMap.get(b.professionalId)?.name ?? '';
        cmp = pa.localeCompare(pb, 'he');
      } else if (sortKey === 'type') {
        cmp = a.type.localeCompare(b.type);
      } else if (sortKey === 'status') {
        const sa = evaluations[a.id]?.status ?? 'green';
        const sb = evaluations[b.id]?.status ?? 'green';
        cmp = rankStatus[sa] - rankStatus[sb];
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filteredSessions, sortKey, sortAsc, profMap, evaluations]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/90 text-xs font-bold text-slate-600">
            <tr>
              <th className="px-4 py-3 text-start">
                <button
                  type="button"
                  onClick={() => toggleSort('time')}
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                >
                  <span>יום ושעה</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-start">
                <button
                  type="button"
                  onClick={() => toggleSort('prof')}
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                >
                  <span>מטפלת ומקצוע</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-start">
                <button
                  type="button"
                  onClick={() => toggleSort('type')}
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                >
                  <span>סוג טיפול</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-start">ילד / משתתפים</th>
              <th className="px-4 py-3 text-start">
                <button
                  type="button"
                  onClick={() => toggleSort('status')}
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                >
                  <span>סטטוס וכללים</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="no-print px-4 py-3 text-end">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedSessions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-10 text-center text-sm text-slate-500"
                >
                  לא נמצאו טיפולים התואמים את הסינון הנוכחי.
                </td>
              </tr>
            ) : (
              sortedSessions.map((session) => {
                const prof = profMap.get(session.professionalId);
                const theme = prof ? COLOR_THEMES[prof.color] : COLOR_THEMES.teal;
                const ev = evaluations[session.id];
                const kidNames = session.kidIds
                  .map((id) => kidMap.get(id)?.name ?? id)
                  .join(', ');

                return (
                  <tr
                    key={session.id}
                    className={`transition hover:bg-slate-50/90 ${
                      ev?.status === 'red'
                        ? 'bg-rose-50/35'
                        : ev?.status === 'yellow'
                          ? 'bg-amber-50/30'
                          : ''
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        {DAY_LABELS[session.day].full}
                      </div>
                      <div className="text-xs font-medium text-slate-500 tabular-nums">
                        {formatRange(session.startMin, session.endMin)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${theme.badge}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                        <span>{prof?.name ?? 'לא ידוע'}</span>
                        <span className="font-normal opacity-80">
                          • {prof?.profession}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {session.type === 'group' ? (
                          <>
                            <Users className="h-3.5 w-3.5 text-slate-500" />
                            <span>קבוצתי</span>
                          </>
                        ) : (
                          <>
                            <User className="h-3.5 w-3.5 text-slate-500" />
                            <span>פרטני 1:1</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">
                        {session.type === 'group' && session.groupLabel
                          ? session.groupLabel
                          : kidNames}
                      </div>
                      {session.type === 'group' && (
                        <div className="text-xs text-slate-500">{kidNames}</div>
                      )}
                      {session.notes && (
                        <div className="mt-0.5 text-xs text-slate-400">
                          הערה: {session.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ev && <StatusBadge status={ev.status} />}
                      {ev?.reasons.map((r, i) => (
                        <div key={i} className="mt-1 text-xs text-rose-700">
                          {r}
                        </div>
                      ))}
                      {ev?.warnings.map((w, i) => (
                        <div key={i} className="mt-1 text-xs text-amber-800">
                          {w}
                        </div>
                      ))}
                    </td>
                    <td className="no-print px-4 py-3 text-end whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectSession(session)}
                          className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-100"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                          <span>הזז / ערוך</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSession(session.id)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          title="מחק טיפול"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

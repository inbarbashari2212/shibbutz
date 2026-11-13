import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Coffee,
  Plus,
  Sparkles,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { COLOR_THEMES } from '../data/presets';
import {
  createId,
  DAY_LABELS,
  DAYS_ORDER,
  formatRange,
  parseTimeToMinutes,
} from '../engine/timeUtils';
import {
  BlockedSlot,
  DayKey,
  Kid,
  ScheduleState,
  Session,
  SlotEvaluation,
} from '../types/schedule';
import { StatusBadge } from './StatusBadge';

interface TherapistsViewProps {
  state: ScheduleState;
  evaluations: Record<string, SlotEvaluation>;
  onSelectSession: (session: Session) => void;
  onCreateAtSlot: (prefill: {
    professionalId: string;
    day: DayKey;
    startMin: number;
  }) => void;
  onAddBlockedSlot: (profId: string, block: BlockedSlot) => void;
  onUnblockSlot: (profId: string, blockId: string) => void;
}

export function TherapistsView({
  state,
  evaluations,
  onSelectSession,
  onCreateAtSlot,
  onAddBlockedSlot,
  onUnblockSlot,
}: TherapistsViewProps) {
  const [selectedProfId, setSelectedProfId] = useState<string>(
    () => state.professionals[0]?.id ?? '',
  );
  const [blockDay, setBlockDay] = useState<DayKey>('sun');
  const [blockStart, setBlockStart] = useState('09:00');
  const [blockEnd, setBlockEnd] = useState('09:45');
  const [blockReason, setBlockReason] = useState('');

  const activeProf =
    state.professionals.find((p) => p.id === selectedProfId) ??
    state.professionals[0];

  const kidMap = useMemo(
    () => new Map<string, Kid>(state.kids.map((k) => [k.id, k])),
    [state.kids],
  );

  if (!activeProf) return null;

  const profTheme = COLOR_THEMES[activeProf.color];
  const profSessions = state.sessions.filter(
    (s) => s.professionalId === activeProf.id,
  );

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const startMin = parseTimeToMinutes(blockStart);
    const endMin = parseTimeToMinutes(blockEnd);
    if (startMin === null || endMin === null || endMin <= startMin) return;

    onAddBlockedSlot(activeProf.id, {
      id: createId('blk'),
      day: blockDay,
      startMin,
      endMin,
      reason: blockReason.trim() || 'זמן חסום ידנית',
    });
    setBlockReason('');
  };

  return (
    <div className="space-y-4">
      {/* Therapist Selector Pills */}
      <div className="flex flex-wrap gap-2">
        {state.professionals.map((p) => {
          const theme = COLOR_THEMES[p.color];
          const active = p.id === activeProf.id;
          const count = state.sessions.filter(
            (s) => s.professionalId === p.id,
          ).length;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProfId(p.id)}
              className={`flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-start transition ${
                active
                  ? `${theme.badge} shadow-xs ring-2 ${theme.ring}/30`
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className={`h-3 w-3 rounded-full ${theme.dot}`} />
              <div>
                <div className="text-sm font-bold">{p.name}</div>
                <div className="text-[11px] opacity-80">
                  {p.profession} • {count} מפגשים
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Therapist Summary + Block Slot Tool */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Work Days & Schedule Columns */}
        <div className="space-y-3 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {DAYS_ORDER.map((day) => {
              const windows = activeProf.workSchedule[day] ?? [];
              const daySessions = profSessions
                .filter((s) => s.day === day)
                .sort((a, b) => a.startMin - b.startMin);
              const dayBlocks = activeProf.blockedSlots.filter(
                (b) => b.day === day,
              );

              if (windows.length === 0 && daySessions.length === 0) {
                return null;
              }

              return (
                <div
                  key={day}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <h4 className="font-bold text-slate-900">
                        {DAY_LABELS[day].full}
                      </h4>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {windows.length > 0
                          ? windows
                              .map((w) => formatRange(w.startMin, w.endMin))
                              .join(' • ')
                          : 'יום חופשי'}
                      </p>
                    </div>
                    {windows.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          onCreateAtSlot({
                            professionalId: activeProf.id,
                            day,
                            startMin: windows[0].startMin,
                          })
                        }
                        className="rounded-lg bg-teal-50 p-1.5 text-teal-700 hover:bg-teal-100"
                        title="הוסף טיפול ביום זה"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-2.5 space-y-2">
                    {daySessions.map((s) => {
                      const ev = evaluations[s.id];
                      const kidsText =
                        s.type === 'group'
                          ? s.groupLabel ?? `קבוצתי (${s.kidIds.length})`
                          : s.kidIds
                              .map((id) => kidMap.get(id)?.name ?? id)
                              .join(', ');

                      return (
                        <div key={s.id} className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectSession(s)}
                            className={`w-full rounded-xl border p-2.5 text-start transition hover:shadow-xs ${
                              ev?.status === 'red'
                                ? 'border-rose-300 bg-rose-50/70'
                                : ev?.status === 'yellow'
                                  ? 'border-amber-300 bg-amber-50/70'
                                  : `${profTheme.border} ${profTheme.bgSoft}`
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold tabular-nums text-slate-800">
                                {formatRange(s.startMin, s.endMin)}
                              </span>
                              {ev && <StatusBadge status={ev.status} compact />}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                              {s.type === 'group' ? (
                                <Users className="h-3.5 w-3.5 text-slate-500" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-slate-500" />
                              )}
                              <span>{kidsText}</span>
                            </div>
                            {ev?.warnings.map((w, i) => (
                              <p
                                key={i}
                                className="mt-1 text-[11px] font-medium text-amber-800"
                              >
                                {w}
                              </p>
                            ))}
                            {ev?.reasons.map((r, i) => (
                              <p
                                key={i}
                                className="mt-1 text-[11px] font-medium text-rose-700"
                              >
                                {r}
                              </p>
                            ))}
                            <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-teal-700">
                              <Sparkles className="h-3 w-3" />
                              <span>שנה משבצת / חפש חלופה</span>
                            </div>
                          </button>

                          {ev?.requiredRecoveryBreak &&
                            ev.requiredRecoveryBreak.startMin === s.endMin && (
                              <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 py-1 text-[11px] font-semibold text-amber-800">
                                <Coffee className="h-3 w-3" />
                                <span className="tabular-nums">
                                  הפסקה נדרשת:{' '}
                                  {formatRange(
                                    ev.requiredRecoveryBreak.startMin,
                                    ev.requiredRecoveryBreak.endMin,
                                  )}
                                </span>
                              </div>
                            )}
                        </div>
                      );
                    })}

                    {dayBlocks.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between rounded-xl border border-dashed border-rose-300 bg-rose-50/70 px-2.5 py-2 text-xs text-rose-800"
                      >
                        <div className="flex items-center gap-1.5">
                          <Ban className="h-3.5 w-3.5 shrink-0" />
                          <div>
                            <div className="font-bold tabular-nums">
                              {formatRange(b.startMin, b.endMin)}
                            </div>
                            <div className="text-[11px] opacity-80">
                              {b.reason || 'חסום'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onUnblockSlot(activeProf.id, b.id)}
                          className="rounded-lg p-1 text-rose-600 hover:bg-rose-100"
                          title="הסר חסימה"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Availability / Block Time Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CalendarClock className="h-4 w-4 text-teal-600" />
              <span>חסימת שעה לא פנויה עבור {activeProf.name}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              סמנו שעות שבהן {activeProf.name} לא פנויה (פגישה, התנדבות, ישיבה).
              המערכת תתרע על שיבוצים קיימים ותסתיר שעות אלו בהצעות החלופיות.
            </p>

            <form onSubmit={handleAddBlock} className="mt-3 space-y-2.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  יום בשבוע
                </label>
                <select
                  value={blockDay}
                  onChange={(e) => setBlockDay(e.target.value as DayKey)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium focus:border-teal-500 focus:outline-none"
                >
                  {DAYS_ORDER.map((d) => (
                    <option key={d} value={d}>
                      {DAY_LABELS[d].full}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    משעה
                  </label>
                  <input
                    type="time"
                    value={blockStart}
                    onChange={(e) => setBlockStart(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm tabular-nums focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    עד שעה
                  </label>
                  <input
                    type="time"
                    value={blockEnd}
                    onChange={(e) => setBlockEnd(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm tabular-nums focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  סיבה (אופציונלי)
                </label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="למשל: הדרכה / ישיבת צוות"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-rose-700 active:scale-[0.99]"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>חסום טווח שעות זה</span>
              </button>
            </form>

            {activeProf.blockedSlots.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="mb-2 text-xs font-bold text-slate-600">
                  חסימות פעילות ({activeProf.blockedSlots.length})
                </div>
                <div className="space-y-1.5">
                  {activeProf.blockedSlots.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800">
                          יום {DAY_LABELS[b.day].short} •{' '}
                          <span className="tabular-nums">
                            {formatRange(b.startMin, b.endMin)}
                          </span>
                        </span>
                        {b.reason && (
                          <div className="text-[11px] text-slate-500">
                            {b.reason}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onUnblockSlot(activeProf.id, b.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeProf.blockedSlots.length === 0 && (
              <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-50/70 px-3 py-2 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>אין שעות חסומות מעבר לשעות העבודה הקבועות.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

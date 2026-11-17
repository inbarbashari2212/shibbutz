import { AlertTriangle, Ban, Coffee, Plus, Sparkles, Users, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { COLOR_THEMES } from '../data/presets';
import {
  DAY_LABELS,
  DAYS_ORDER,
  formatRange,
  formatTime,
  formatVisibleDaysRange,
  getVisibleDaysOrder,
  isContainedInWindows,
} from '../engine/timeUtils';
import { ScheduleFilters } from '../types/filters';
import {
  DayKey,
  Kid,
  Professional,
  ScheduleState,
  Session,
  SlotEvaluation,
} from '../types/schedule';
import { StatusBadge } from './StatusBadge';

interface WeeklyCalendarViewProps {
  state: ScheduleState;
  filteredSessions: Session[];
  evaluations: Record<string, SlotEvaluation>;
  filters: ScheduleFilters;
  onSelectSession: (session: Session) => void;
  onCreateAtSlot: (prefill: {
    professionalId: string;
    day: DayKey;
    startMin: number;
  }) => void;
  onUnblockSlot: (professionalId: string, blockId: string) => void;
  onShowAllDays?: () => void;
}

const PX_PER_MIN = 1.45; // 45 mins = 65.25px, 60 mins = 87px (super crisp & roomy)

export function WeeklyCalendarView({
  state,
  filteredSessions,
  evaluations,
  filters,
  onSelectSession,
  onCreateAtSlot,
  onUnblockSlot,
  onShowAllDays,
}: WeeklyCalendarViewProps) {
  const configuredDays = useMemo(
    () => getVisibleDaysOrder(state.rules.displayDaysCount),
    [state.rules.displayDaysCount],
  );

  const [mobileDay, setMobileDay] = useState<DayKey>(() =>
    filters.day !== 'all' ? filters.day : configuredDays[0] ?? 'sun',
  );

  const activeMobileDay: DayKey =
    filters.day !== 'all'
      ? filters.day
      : configuredDays.includes(mobileDay)
        ? mobileDay
        : configuredDays[0] ?? 'sun';

  const profMap = useMemo(
    () => new Map<string, Professional>(state.professionals.map((p) => [p.id, p])),
    [state.professionals],
  );
  const kidMap = useMemo(
    () => new Map<string, Kid>(state.kids.map((k) => [k.id, k])),
    [state.kids],
  );

  const visibleDays = useMemo(
    () =>
      filters.day === 'all'
        ? configuredDays
        : DAYS_ORDER.filter((d) => d === filters.day),
    [filters.day, configuredDays],
  );

  const hiddenSessionsCount = useMemo(() => {
    if (filters.day !== 'all' || configuredDays.length >= DAYS_ORDER.length) {
      return 0;
    }
    const shownSet = new Set(configuredDays);
    return filteredSessions.filter((s) => !shownSet.has(s.day)).length;
  }, [filters.day, configuredDays, filteredSessions]);

  const visibleProfs = useMemo(
    () =>
      filters.professionalIds.length === 0
        ? state.professionals
        : state.professionals.filter((p) => filters.professionalIds.includes(p.id)),
    [state.professionals, filters.professionalIds],
  );

  // Determine timeline segments: split morning and afternoon if 12:30-14:00 is unused
  const timelineConfig = useMemo(() => {
    const lunchStart = 12 * 60 + 30;
    const lunchEnd = 14 * 60;
    const anySpansLunch =
      state.sessions.some(
        (s) => s.startMin < lunchEnd && s.endMin > lunchStart,
      ) ||
      state.professionals.some((p) =>
        DAYS_ORDER.some((d) =>
          (p.workSchedule[d] ?? []).some(
            (w) => w.startMin < lunchEnd && w.endMin > lunchStart,
          ),
        ),
      );

    if (anySpansLunch) {
      return {
        splitLunch: false,
        segments: [{ id: 'full', startMin: 8 * 60, endMin: 15 * 60 + 30 }],
      };
    }

    return {
      splitLunch: true,
      segments: [
        { id: 'morning', startMin: 8 * 60, endMin: 12 * 60 + 30 },
        { id: 'afternoon', startMin: 14 * 60, endMin: 15 * 60 + 30 },
      ],
    };
  }, [state.sessions, state.professionals]);

  const getSessionsForMobileDay = (day: DayKey) =>
    filteredSessions
      .filter((s) => s.day === day)
      .sort((a, b) => a.startMin - b.startMin);

  const renderSessionSummaryKids = (session: Session) => {
    if (session.type === 'group') {
      return (
        session.groupLabel ??
        `קבוצתי (${session.kidIds.length} ילדים)`
      );
    }
    return session.kidIds
      .map((id) => kidMap.get(id)?.name ?? id)
      .join(', ');
  };

  return (
    <div className="space-y-4">
      {/* Legend Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-xs text-slate-600 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-slate-700">מקרא:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>ירוק — שיבוץ תקין (מרווח 15+ דק׳)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-amber-200" />
            <span>צהוב — 2 טיפולי 1:1 ברצף (+ הפסקת 30 דק׳)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>אדום — התנגשות / חריגה</span>
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          לחצו על כל שיבוץ לשינוי שעה או החלפה חכמה
        </span>
      </div>

      {/* Hidden Days Notice (if displayDaysCount < 6 and sessions exist on hidden days) */}
      {hiddenSessionsCount > 0 && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-900">
          <span>
            מוצגים כרגע{' '}
            <strong>
              {configuredDays.length} ימים ({formatVisibleDaysRange(configuredDays)})
            </strong>
            . קיימים <strong>{hiddenSessionsCount}</strong> שיבוצים בימים שאינם
            מוצגים כעת.
          </span>
          {onShowAllDays && (
            <button
              type="button"
              onClick={onShowAllDays}
              className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-300 transition hover:bg-amber-100"
            >
              הצג 6 ימים (א׳–ו׳)
            </button>
          )}
        </div>
      )}

      {/* MOBILE VIEW (< lg) */}
      <div className="space-y-3 lg:hidden">
        {filters.day === 'all' && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {configuredDays.map((day) => {
              const count = filteredSessions.filter((s) => s.day === day).length;
              const isActive = activeMobileDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setMobileDay(day)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>יום {DAY_LABELS[day].short}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Day Agenda Cards */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {DAY_LABELS[activeMobileDay].full}
              </h3>
              <p className="text-xs text-slate-500">
                {(() => {
                  const kg = state.rules.kindergartenHours[activeMobileDay];
                  return kg
                    ? `שעות פעילות הגן: ${formatRange(kg.startMin, kg.endMin)}`
                    : 'הגן סגור ביום זה';
                })()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const workingProf = visibleProfs.find(
                  (p) => (p.workSchedule[activeMobileDay] ?? []).length > 0,
                ) ?? visibleProfs[0];
                if (workingProf) {
                  onCreateAtSlot({
                    professionalId: workingProf.id,
                    day: activeMobileDay,
                    startMin: 480,
                  });
                }
              }}
              className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 ring-1 ring-teal-200 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>הוסף טיפול</span>
            </button>
          </div>

          {(() => {
            const daySessions = getSessionsForMobileDay(activeMobileDay);
            const activeProfsToday = visibleProfs.filter(
              (p) => (p.workSchedule[activeMobileDay] ?? []).length > 0,
            );

            if (daySessions.length === 0) {
              return (
                <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                  {activeProfsToday.length === 0
                    ? 'אין מטפלות משובצות ביום זה (ניתן להוסיף שעות בהגדרות).'
                    : 'אין טיפולים תואמים לסינון הנוכחי ביום זה.'}
                </div>
              );
            }

            return (
              <div className="space-y-2.5">
                {daySessions.map((session, idx) => {
                  const prof = profMap.get(session.professionalId);
                  if (!prof) return null;
                  const theme = COLOR_THEMES[prof.color];
                  const ev = evaluations[session.id];
                  const prev = daySessions[idx - 1];
                  const showLunchDivider =
                    prev && prev.endMin <= 750 && session.startMin >= 840;

                  return (
                    <div key={session.id}>
                      {showLunchDivider && (
                        <div className="my-2.5 flex items-center gap-2 rounded-lg bg-slate-100/80 px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                          <Coffee className="h-3.5 w-3.5" />
                          <span>12:30–14:00 הפסקת צהריים ומנוחה בגן</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => onSelectSession(session)}
                        className={`w-full rounded-xl border p-3 text-start transition active:scale-[0.99] ${
                          ev?.status === 'red'
                            ? 'border-rose-300 bg-rose-50/50'
                            : ev?.status === 'yellow'
                              ? 'border-amber-300 bg-amber-50/50'
                              : `${theme.border} bg-white hover:bg-slate-50/70`
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${theme.badge}`}
                            >
                              {formatRange(session.startMin, session.endMin)}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                                {session.type === 'group' ? (
                                  <Users className="h-3.5 w-3.5 text-slate-500" />
                                ) : (
                                  <User className="h-3.5 w-3.5 text-slate-500" />
                                )}
                                <span>{renderSessionSummaryKids(session)}</span>
                              </div>
                              <div className="text-xs text-slate-500">
                                {prof.name} • {prof.profession} •{' '}
                                {session.type === 'group' ? 'קבוצתי' : 'פרטני 1:1'}
                              </div>
                            </div>
                          </div>
                          {ev && <StatusBadge status={ev.status} />}
                        </div>

                        {(ev?.reasons.length || ev?.warnings.length) ? (
                          <div className="mt-2 space-y-1 border-t border-slate-200/70 pt-2 text-[11px]">
                            {ev.reasons.map((r, i) => (
                              <p key={i} className="font-medium text-rose-700">
                                • {r}
                              </p>
                            ))}
                            {ev.warnings.map((w, i) => (
                              <p key={i} className="font-medium text-amber-800">
                                • {w}
                              </p>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-2 flex items-center justify-end text-[11px] font-semibold text-teal-700">
                          <Sparkles className="me-1 h-3 w-3" />
                          <span>לחצי לשינוי שעה / משבצות פנויות</span>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* DESKTOP PROPORTIONAL SCHEDULE MATRIX (lg+) */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs lg:block">
        <div style={{ minWidth: `${Math.max(420, 72 + visibleDays.length * 150)}px` }}>
          {/* Header Row */}
          <div
            className="grid border-b border-slate-200 bg-slate-50/90"
            style={{
              gridTemplateColumns: `72px repeat(${visibleDays.length}, minmax(140px, 1fr))`,
            }}
          >
            <div className="flex items-center justify-center border-e border-slate-200 p-2 text-xs font-bold text-slate-500">
              שעה
            </div>
            {visibleDays.map((day) => {
              const activeDayProfs = visibleProfs.filter(
                (p) => (p.workSchedule[day] ?? []).length > 0,
              );
              const kg = state.rules.kindergartenHours[day];
              return (
                <div
                  key={day}
                  className="border-e border-slate-200 last:border-e-0"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/80 px-3 py-2">
                    <span className="text-sm font-bold text-slate-900">
                      {DAY_LABELS[day].full}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                      {kg ? formatRange(kg.startMin, kg.endMin) : 'סגור'}
                    </span>
                  </div>
                  {/* Sub-lanes header for working professionals on this day */}
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns:
                        activeDayProfs.length > 0
                          ? `repeat(${activeDayProfs.length}, minmax(0, 1fr))`
                          : '1fr',
                    }}
                  >
                    {activeDayProfs.length > 0 ? (
                      activeDayProfs.map((prof) => {
                        const theme = COLOR_THEMES[prof.color];
                        return (
                          <div
                            key={prof.id}
                            className="flex items-center justify-center gap-1 border-e border-slate-200/70 px-1.5 py-1.5 text-[11px] font-bold text-slate-700 last:border-e-0"
                          >
                            <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                            <span className="truncate">{prof.name}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-2 py-1.5 text-center text-[11px] text-slate-400">
                        אין צוות ביום זה
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timeline Segments */}
          {timelineConfig.segments.map((seg, segIdx) => {
            const totalMins = seg.endMin - seg.startMin;
            const heightPx = totalMins * PX_PER_MIN;
            const hourMarks: number[] = [];
            for (
              let m = Math.ceil(seg.startMin / 60) * 60;
              m <= seg.endMin;
              m += 60
            ) {
              hourMarks.push(m);
            }

            return (
              <div key={seg.id}>
                {segIdx > 0 && timelineConfig.splitLunch && (
                  <div className="flex items-center justify-center gap-2 border-y border-slate-200 bg-slate-100/80 py-2 text-xs font-semibold text-slate-500">
                    <Coffee className="h-3.5 w-3.5 text-slate-400" />
                    <span>12:30–14:00 • הפסקת צהריים ומנוחה בגן</span>
                  </div>
                )}

                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `72px repeat(${visibleDays.length}, minmax(140px, 1fr))`,
                  }}
                >
                  {/* Time Axis Column */}
                  <div
                    className="relative border-e border-slate-200 bg-slate-50/40"
                    style={{ height: `${heightPx}px` }}
                  >
                    {hourMarks.map((m) => {
                      const top = (m - seg.startMin) * PX_PER_MIN;
                      return (
                        <div
                          key={m}
                          className="absolute inset-x-0 flex -translate-y-1/2 items-center justify-center text-[11px] font-semibold text-slate-500 tabular-nums"
                          style={{ top: `${Math.max(10, top)}px` }}
                        >
                          {formatTime(m)}
                        </div>
                      );
                    })}
                  </div>

                  {/* Day Columns */}
                  {visibleDays.map((day) => {
                    const activeDayProfs = visibleProfs.filter(
                      (p) => (p.workSchedule[day] ?? []).length > 0,
                    );

                    return (
                      <div
                        key={day}
                        className="relative grid border-e border-slate-200 last:border-e-0"
                        style={{
                          height: `${heightPx}px`,
                          gridTemplateColumns:
                            activeDayProfs.length > 0
                              ? `repeat(${activeDayProfs.length}, minmax(0, 1fr))`
                              : '1fr',
                        }}
                      >
                        {/* Horizontal hourly guidelines */}
                        {hourMarks.map((m) => {
                          const top = (m - seg.startMin) * PX_PER_MIN;
                          return (
                            <div
                              key={m}
                              className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
                              style={{ top: `${top}px` }}
                            />
                          );
                        })}

                        {activeDayProfs.length === 0 ? (
                          <div className="bg-slate-50/60" />
                        ) : (
                          activeDayProfs.map((prof) => {
                            const theme = COLOR_THEMES[prof.color];
                            const workWindows = prof.workSchedule[day] ?? [];
                            const laneSessions = filteredSessions.filter(
                              (s) =>
                                s.day === day &&
                                s.professionalId === prof.id &&
                                s.endMin > seg.startMin &&
                                s.startMin < seg.endMin,
                            );
                            const allProfSessionsOnDay = state.sessions.filter(
                              (s) => s.day === day && s.professionalId === prof.id,
                            );

                            // Standard hourly quick-add buttons where empty
                            const emptySlots: number[] = [];
                            for (const m of hourMarks) {
                              const slotEnd = m + state.rules.sessionDurationMin;
                              if (
                                slotEnd <= seg.endMin &&
                                isContainedInWindows(m, slotEnd, workWindows) &&
                                isContainedInWindows(
                                  m,
                                  slotEnd,
                                  state.rules.sessionWindows[day] ?? [],
                                ) &&
                                !allProfSessionsOnDay.some(
                                  (s) => s.startMin < slotEnd && m < s.endMin,
                                ) &&
                                !prof.blockedSlots.some(
                                  (b) =>
                                    b.day === day &&
                                    b.startMin < slotEnd &&
                                    m < b.endMin,
                                )
                              ) {
                                emptySlots.push(m);
                              }
                            }

                            return (
                              <div
                                key={prof.id}
                                className="relative border-e border-slate-100 last:border-e-0"
                              >
                                {/* Shade unavailable regions inside this therapist's lane */}
                                {(() => {
                                  const shaded: { start: number; end: number }[] = [];
                                  let cursor = seg.startMin;
                                  const sorted = [...workWindows]
                                    .map((w) => ({
                                      start: Math.max(seg.startMin, w.startMin),
                                      end: Math.min(seg.endMin, w.endMin),
                                    }))
                                    .filter((w) => w.start < w.end)
                                    .sort((a, b) => a.start - b.start);

                                  for (const w of sorted) {
                                    if (w.start > cursor) {
                                      shaded.push({ start: cursor, end: w.start });
                                    }
                                    cursor = Math.max(cursor, w.end);
                                  }
                                  if (cursor < seg.endMin) {
                                    shaded.push({ start: cursor, end: seg.endMin });
                                  }
                                  return shaded.map((sh, i) => (
                                    <div
                                      key={i}
                                      className="pointer-events-none absolute inset-x-0 bg-slate-100/80"
                                      style={{
                                        top: `${(sh.start - seg.startMin) * PX_PER_MIN}px`,
                                        height: `${(sh.end - sh.start) * PX_PER_MIN}px`,
                                        backgroundImage:
                                          'repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(148,163,184,0.12) 6px, rgba(148,163,184,0.12) 12px)',
                                      }}
                                    />
                                  ));
                                })()}

                                {/* Blocked slots */}
                                {prof.blockedSlots
                                  .filter(
                                    (b) =>
                                      b.day === day &&
                                      b.endMin > seg.startMin &&
                                      b.startMin < seg.endMin,
                                  )
                                  .map((b) => {
                                    const top =
                                      (Math.max(b.startMin, seg.startMin) -
                                        seg.startMin) *
                                      PX_PER_MIN;
                                    const height =
                                      (Math.min(b.endMin, seg.endMin) -
                                        Math.max(b.startMin, seg.startMin)) *
                                      PX_PER_MIN;
                                    return (
                                      <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => onUnblockSlot(prof.id, b.id)}
                                        title="לחצי להסרת חסימה זו"
                                        className="group absolute inset-x-1 z-10 flex flex-col items-center justify-center rounded-lg border border-dashed border-rose-300 bg-rose-50/75 px-1 text-center text-[10px] font-semibold text-rose-700 transition hover:bg-rose-100"
                                        style={{
                                          top: `${top + 1}px`,
                                          height: `${Math.max(22, height - 2)}px`,
                                        }}
                                      >
                                        <Ban className="h-3 w-3 opacity-75" />
                                        <span className="line-clamp-1">
                                          {b.reason || 'שעה חסומה'}
                                        </span>
                                        <span className="hidden text-[9px] underline group-hover:inline">
                                          בטל חסימה
                                        </span>
                                      </button>
                                    );
                                  })}

                                {/* Empty clickable slots */}
                                {emptySlots.map((m) => {
                                  const top = (m - seg.startMin) * PX_PER_MIN;
                                  const height =
                                    state.rules.sessionDurationMin * PX_PER_MIN;
                                  return (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() =>
                                        onCreateAtSlot({
                                          professionalId: prof.id,
                                          day,
                                          startMin: m,
                                        })
                                      }
                                      className="group no-print absolute inset-x-1 flex items-center justify-center rounded-lg border border-transparent text-slate-300 transition hover:border-dashed hover:border-teal-300 hover:bg-teal-50/50 hover:text-teal-700"
                                      style={{
                                        top: `${top + 2}px`,
                                        height: `${height - 4}px`,
                                      }}
                                      title={`הוסף טיפול אצל ${prof.name} ב-${formatTime(m)}`}
                                    >
                                      <Plus className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                                    </button>
                                  );
                                })}

                                {/* Session Cards */}
                                {laneSessions.map((session) => {
                                  const ev = evaluations[session.id];
                                  const top =
                                    (Math.max(session.startMin, seg.startMin) -
                                      seg.startMin) *
                                    PX_PER_MIN;
                                  const height =
                                    (Math.min(session.endMin, seg.endMin) -
                                      Math.max(session.startMin, seg.startMin)) *
                                    PX_PER_MIN;

                                  const isYellow = ev?.status === 'yellow';
                                  const isRed = ev?.status === 'red';

                                  return (
                                    <div key={session.id}>
                                      <button
                                        type="button"
                                        onClick={() => onSelectSession(session)}
                                        className={`group absolute inset-x-1 z-20 flex flex-col justify-between overflow-hidden rounded-xl border p-1.5 text-start shadow-2xs transition hover:z-30 hover:-translate-y-0.5 hover:shadow-md ${
                                          isRed
                                            ? 'border-rose-400 bg-rose-50 text-rose-950 ring-2 ring-rose-300/70'
                                            : isYellow
                                              ? 'border-amber-400 bg-amber-50/95 text-amber-950 ring-1 ring-amber-300'
                                              : `${theme.border} ${theme.bgSoft} ${theme.text} hover:ring-2 ${theme.ring}/30`
                                        }`}
                                        style={{
                                          top: `${top + 1}px`,
                                          height: `${Math.max(36, height - 2)}px`,
                                        }}
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-[10px] font-bold opacity-80 tabular-nums">
                                            {formatRange(
                                              session.startMin,
                                              session.endMin,
                                            )}
                                          </span>
                                          {isYellow && (
                                            <span
                                              className="inline-flex items-center gap-0.5 rounded bg-amber-200/90 px-1 py-0.5 text-[9px] font-bold text-amber-900"
                                              title={ev?.warnings.join(' | ')}
                                            >
                                              <AlertTriangle className="h-2.5 w-2.5" />
                                              רצף
                                            </span>
                                          )}
                                          {isRed && (
                                            <span
                                              className="rounded bg-rose-200 px-1 py-0.5 text-[9px] font-bold text-rose-900"
                                              title={ev?.reasons.join(' | ')}
                                            >
                                              חריגה
                                            </span>
                                          )}
                                        </div>

                                        <div className="mt-0.5 flex items-center gap-1 truncate text-xs font-extrabold">
                                          {session.type === 'group' ? (
                                            <Users className="h-3 w-3 shrink-0 opacity-75" />
                                          ) : (
                                            <User className="h-3 w-3 shrink-0 opacity-75" />
                                          )}
                                          <span className="truncate">
                                            {renderSessionSummaryKids(session)}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] opacity-75">
                                          <span className="truncate">
                                            {session.type === 'group'
                                              ? 'קבוצתי'
                                              : '1:1'}
                                          </span>
                                          <span className="hidden text-[9px] font-bold underline group-hover:inline">
                                            שנה
                                          </span>
                                        </div>
                                      </button>

                                      {/* Visual 30-min recovery break pill right below a consecutive pair */}
                                      {ev?.requiredRecoveryBreak &&
                                        ev.requiredRecoveryBreak.startMin ===
                                          session.endMin &&
                                        ev.requiredRecoveryBreak.endMin <=
                                          seg.endMin && (
                                          <div
                                            className="pointer-events-none absolute inset-x-1 z-10 flex items-center justify-center gap-1 rounded-lg border border-dashed border-amber-300 bg-amber-50/70 px-1 text-[9px] font-bold text-amber-800"
                                            style={{
                                              top: `${(ev.requiredRecoveryBreak.startMin - seg.startMin) * PX_PER_MIN + 1}px`,
                                              height: `${(ev.requiredRecoveryBreak.endMin - ev.requiredRecoveryBreak.startMin) * PX_PER_MIN - 2}px`,
                                            }}
                                          >
                                            <Coffee className="h-2.5 w-2.5 shrink-0" />
                                            <span className="truncate">
                                              הפסקה {state.rules.breakAfterConsecutiveMin} דק׳
                                            </span>
                                          </div>
                                        )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

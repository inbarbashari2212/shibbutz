import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { COLOR_THEMES } from '../data/presets';
import { DAY_LABELS, DAYS_ORDER, formatRange } from '../engine/timeUtils';
import {
  evaluateSessionPlacement,
  findCandidateSlots,
  findSwapSuggestions,
} from '../engine/validator';
import {
  DayKey,
  Kid,
  ScheduleState,
  Session,
  SessionType,
} from '../types/schedule';
import { StatusBadge } from './StatusBadge';

export interface SessionEditorDraft {
  mode: 'edit' | 'create';
  session?: Session;
  prefill?: {
    professionalId?: string;
    type?: SessionType;
    kidIds?: string[];
    groupLabel?: string;
    notes?: string;
    day?: DayKey;
    startMin?: number;
    enableDuplicates?: boolean;
  };
}

interface SessionEditorModalProps {
  state: ScheduleState;
  draft: SessionEditorDraft;
  onClose: () => void;
  onSaveSession: (
    session: Session,
    isNew: boolean,
    enableDuplicatesRule?: boolean,
  ) => void;
  onDuplicateSession: (session: Session) => void;
  onSwapSessions: (sessionAId: string, sessionBId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onBlockOriginalAndStayOpen: (
    profId: string,
    day: DayKey,
    startMin: number,
    endMin: number,
  ) => void;
}

export function SessionEditorModal({
  state,
  draft,
  onClose,
  onSaveSession,
  onDuplicateSession,
  onSwapSessions,
  onDeleteSession,
  onBlockOriginalAndStayOpen,
}: SessionEditorModalProps) {
  const existing = draft.session;
  const duration = state.rules.sessionDurationMin;

  const [professionalId, setProfessionalId] = useState<string>(
    existing?.professionalId ??
      draft.prefill?.professionalId ??
      state.professionals[0]?.id ??
      '',
  );
  const [type, setType] = useState<SessionType>(
    existing?.type ?? draft.prefill?.type ?? 'one_on_one',
  );
  const [kidIds, setKidIds] = useState<string[]>(
    existing?.kidIds ??
      draft.prefill?.kidIds ??
      (state.kids[0] ? [state.kids[0].id] : []),
  );
  const [groupLabel, setGroupLabel] = useState<string>(
    existing?.groupLabel ??
      draft.prefill?.groupLabel ??
      `קבוצתי (כל ה-${state.kids.length})`,
  );
  const [notes, setNotes] = useState<string>(
    existing?.notes ?? draft.prefill?.notes ?? '',
  );

  const [selectedDay, setSelectedDay] = useState<DayKey>(
    existing?.day ?? draft.prefill?.day ?? 'sun',
  );
  const [selectedStartMin, setSelectedStartMin] = useState<number>(
    existing?.startMin ?? draft.prefill?.startMin ?? 480,
  );

  const [allowDuplicates, setAllowDuplicates] = useState<boolean>(
    Boolean(
      draft.prefill?.enableDuplicates || state.rules.allowDuplicateBookings,
    ),
  );
  const [activeTab, setActiveTab] = useState<'slots' | 'swaps'>('slots');
  const [slotFilter, setSlotFilter] = useState<'available' | 'green_only'>(
    'available',
  );
  const [quarterFilter, setQuarterFilter] = useState<'all' | 'hourly'>('all');
  const [dayFilter, setDayFilter] = useState<'all' | DayKey>('all');
  const [showRedSlots, setShowRedSlots] = useState(false);

  const prof = state.professionals.find((p) => p.id === professionalId);
  const kidMap = useMemo(
    () => new Map<string, Kid>(state.kids.map((k) => [k.id, k])),
    [state.kids],
  );

  const handleTypeChange = (nextType: SessionType) => {
    setType(nextType);
    if (nextType === 'one_on_one') {
      setKidIds((prev) => (prev.length > 0 ? [prev[0]] : state.kids[0] ? [state.kids[0].id] : []));
    } else {
      setKidIds((prev) =>
        prev.length > 1 ? prev : state.kids.map((k) => k.id),
      );
    }
  };

  const toggleGroupKid = (kidId: string) => {
    if (type === 'one_on_one') {
      setKidIds([kidId]);
      return;
    }
    setKidIds((prev) =>
      prev.includes(kidId) ? prev.filter((id) => id !== kidId) : [...prev, kidId],
    );
  };

  // Effective state with local duplicate-booking toggle applied
  const effectiveState = useMemo<ScheduleState>(
    () =>
      allowDuplicates === Boolean(state.rules.allowDuplicateBookings)
        ? state
        : {
            ...state,
            rules: {
              ...state.rules,
              allowDuplicateBookings: allowDuplicates,
            },
          },
    [state, allowDuplicates],
  );

  // Live evaluation of currently selected slot
  const selectedEndMin = selectedStartMin + duration;
  const currentEvaluation = useMemo(
    () =>
      evaluateSessionPlacement(
        effectiveState,
        {
          id: existing?.id,
          professionalId,
          type,
          kidIds,
          groupLabel: type === 'group' ? groupLabel : undefined,
          day: selectedDay,
          startMin: selectedStartMin,
          endMin: selectedEndMin,
          notes: notes.trim() || undefined,
        },
        existing ? [existing.id] : [],
      ),
    [
      effectiveState,
      existing,
      professionalId,
      type,
      kidIds,
      groupLabel,
      selectedDay,
      selectedStartMin,
      selectedEndMin,
      notes,
    ],
  );

  // Candidate slots according to all rules
  const candidateSlots = useMemo(() => {
    if (kidIds.length === 0) return [];
    const all = findCandidateSlots(
      effectiveState,
      {
        professionalId,
        type,
        kidIds,
        groupLabel: type === 'group' ? groupLabel : undefined,
        notes: notes.trim() || undefined,
      },
      {
        ignoreSessionId: existing?.id,
        includeRed: showRedSlots,
        onlyDay: dayFilter === 'all' ? undefined : dayFilter,
      },
    );
    return all.filter((c) => {
      if (
        slotFilter === 'green_only' &&
        c.evaluation.status !== 'green' &&
        !(showRedSlots && c.evaluation.status === 'red')
      ) {
        return false;
      }
      if (quarterFilter === 'hourly' && !c.isStandardHour) {
        return false;
      }
      return true;
    });
  }, [
    effectiveState,
    professionalId,
    type,
    kidIds,
    groupLabel,
    notes,
    existing?.id,
    showRedSlots,
    dayFilter,
    slotFilter,
    quarterFilter,
  ]);

  const swapSuggestions = useMemo(() => {
    if (!existing) return [];
    return findSwapSuggestions(effectiveState, existing, 8);
  }, [effectiveState, existing]);

  const greenCount = candidateSlots.filter(
    (c) => c.evaluation.status === 'green',
  ).length;
  const yellowCount = candidateSlots.filter(
    (c) => c.evaluation.status === 'yellow',
  ).length;

  const isOriginalSlotBlocked =
    existing &&
    prof?.blockedSlots.some(
      (b) =>
        b.day === existing.day &&
        b.startMin < existing.endMin &&
        existing.startMin < b.endMin,
    );

  const selectedHour = Math.floor(selectedStartMin / 60);
  const selectedMinute = selectedStartMin % 60;

  const handleConfirmSave = () => {
    if (kidIds.length === 0 || !prof) return;
    const saved: Session = {
      id: existing?.id ?? `sess_${Math.random().toString(36).slice(2, 9)}`,
      professionalId,
      type,
      kidIds,
      groupLabel: type === 'group' ? groupLabel : undefined,
      day: selectedDay,
      startMin: selectedStartMin,
      endMin: selectedEndMin,
      notes: notes.trim() || undefined,
    };
    onSaveSession(saved, !existing, allowDuplicates);
  };

  const profTheme = prof ? COLOR_THEMES[prof.color] : COLOR_THEMES.teal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up sm:animate-modal-pop flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        {/* Sticky Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className={`h-3.5 w-3.5 rounded-full ${profTheme.dot}`} />
            <div>
              <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">
                {existing
                  ? 'עריכת שיבוץ והחלפת משבצת'
                  : 'שיבוץ טיפול חדש לפי כללי הגן'}
              </h2>
              {existing && (
                <p className="text-xs text-slate-500">
                  שיבוץ נוכחי: {DAY_LABELS[existing.day].full} •{' '}
                  <span className="tabular-nums">
                    {formatRange(existing.startMin, existing.endMin)}
                  </span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {/* Quick "Slot doesn't work for me" banner when editing */}
          {existing && prof && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                <Sparkles className="h-4 w-4 shrink-0 text-teal-600" />
                <span>
                  השעה <strong>{formatRange(existing.startMin, existing.endMin)}</strong>{' '}
                  ב{DAY_LABELS[existing.day].full} לא מסתדרת ל{prof.name}? בחרו משבצת
                  חלופית למטה או חסמו את השעה הזו.
                </span>
              </div>
              {!isOriginalSlotBlocked && (
                <button
                  type="button"
                  onClick={() =>
                    onBlockOriginalAndStayOpen(
                      prof.id,
                      existing.day,
                      existing.startMin,
                      existing.endMin,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span>סמן משבצת זו כלא פנויה ל{prof.name}</span>
                </button>
              )}
            </div>
          )}

          {/* Therapist & Type & Kids Form */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                אשת מקצוע
              </label>
              <div className="flex flex-wrap gap-1.5">
                {state.professionals.map((p) => {
                  const active = p.id === professionalId;
                  const t = COLOR_THEMES[p.color];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProfessionalId(p.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        active
                          ? `${t.badge} ring-2 ${t.ring}/30`
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                      <span>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                סוג טיפול
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('one_on_one')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    type === 'one_on_one'
                      ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>פרטני 1:1</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('group')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    type === 'group'
                      ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>קבוצתי</span>
                </button>
              </div>
            </div>
          </div>

          {/* Kid(s) selection */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600">
                {type === 'one_on_one'
                  ? 'בחירת ילד/ה'
                  : `בחירת משתתפים לקבוצה (${kidIds.length} נבחרו)`}
              </label>
              {type === 'group' && (
                <button
                  type="button"
                  onClick={() => setKidIds(state.kids.map((k) => k.id))}
                  className="text-xs font-semibold text-teal-700 hover:underline"
                >
                  בחר את כל {state.kids.length} הילדים
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {state.kids.map((k) => {
                const selected = kidIds.includes(k.id);
                const kt = COLOR_THEMES[k.color];
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => toggleGroupKid(k.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? `${kt.badge} ring-2 ${kt.ring}/30`
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                    <span>{k.name}</span>
                  </button>
                );
              })}
            </div>

            {type === 'group' && (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={groupLabel}
                  onChange={(e) => setGroupLabel(e.target.value)}
                  placeholder="שם הקבוצה (למשל: קבוצת בוקר / קבוצה א׳)"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium focus:border-teal-500 focus:bg-white focus:outline-none"
                />
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="הערה אופציונלית לשיבוץ..."
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium focus:border-teal-500 focus:bg-white focus:outline-none"
                />
              </div>
            )}
            {type === 'one_on_one' && (
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="הערה אופציונלית לשיבוץ (למשל: חדר תנועה)..."
                className="mt-2.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium focus:border-teal-500 focus:bg-white focus:outline-none"
              />
            )}
          </div>

          {/* Manual Day & Quarter-Hour Time Selector + Duplicate Toggle */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-slate-800">
                בחירה ידנית לפי רבעי שעה ({duration} דק׳ לכל טיפול)
              </span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-900">
                <input
                  type="checkbox"
                  checked={allowDuplicates}
                  onChange={(e) => setAllowDuplicates(e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-600"
                />
                <span>אפשר כפילויות וחפיפות</span>
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                  יום
                </label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value as DayKey)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:border-teal-500 focus:outline-none"
                >
                  {DAYS_ORDER.map((d) => (
                    <option key={d} value={d}>
                      {DAY_LABELS[d].full}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                  שעת התחלה
                </label>
                <select
                  value={selectedHour}
                  onChange={(e) =>
                    setSelectedStartMin(
                      Number(e.target.value) * 60 + selectedMinute,
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 tabular-nums focus:border-teal-500 focus:outline-none"
                >
                  {[7, 8, 9, 10, 11, 12, 13, 14, 15].map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                  דקות (רבע שעה)
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[0, 15, 30, 45].map((min) => {
                    const active = selectedMinute === min;
                    return (
                      <button
                        key={min}
                        type="button"
                        onClick={() =>
                          setSelectedStartMin(selectedHour * 60 + min)
                        }
                        className={`rounded-lg border py-1.5 text-xs font-bold tabular-nums transition ${
                          active
                            ? 'border-teal-600 bg-teal-600 text-white shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        :{String(min).padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Live Selected Slot Status Preview */}
          <div
            className={`rounded-2xl border p-3 transition ${
              currentEvaluation.status === 'red'
                ? 'border-rose-300 bg-rose-50/70'
                : currentEvaluation.status === 'yellow'
                  ? 'border-amber-300 bg-amber-50/70'
                  : 'border-emerald-300 bg-emerald-50/60'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Clock className="h-4 w-4 text-slate-600" />
                <span>
                  משבצת נבחרת: {DAY_LABELS[selectedDay].full} •{' '}
                  <span dir="ltr" className="inline-block tabular-nums">
                    {formatRange(selectedStartMin, selectedEndMin)}
                  </span>
                </span>
              </div>
              <StatusBadge status={currentEvaluation.status} />
            </div>

            {currentEvaluation.reasons.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs font-medium text-rose-800">
                {currentEvaluation.reasons.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            )}
            {currentEvaluation.warnings.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs font-medium text-amber-900">
                {currentEvaluation.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Mode Tabs: Free Candidate Slots vs Smart Swaps */}
          <div className="border-t border-slate-200 pt-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('slots')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    activeTab === 'slots'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    משבצות פנויות ({greenCount + yellowCount})
                  </span>
                </button>
                {existing && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('swaps')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      activeTab === 'swaps'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    <span>החלפה חכמה ({swapSuggestions.length})</span>
                  </button>
                )}
              </div>

              {activeTab === 'slots' && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSlotFilter('available')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      slotFilter === 'available'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    ירוק + צהוב ({greenCount + yellowCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlotFilter('green_only')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      slotFilter === 'green_only'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    ירוק בלבד ({greenCount})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuarterFilter((q) => (q === 'all' ? 'hourly' : 'all'))
                    }
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                      quarterFilter === 'hourly'
                        ? 'border-teal-300 bg-teal-50 text-teal-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {quarterFilter === 'hourly'
                      ? 'שעות עגולות (:00)'
                      : 'כל רבעי השעה'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRedSlots((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                      showRedSlots
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {showRedSlots ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                    <span>הצג חסומים</span>
                  </button>
                </div>
              )}
            </div>

            {activeTab === 'slots' ? (
              <div className="space-y-3">
                {/* Day quick filter */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDayFilter('all')}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      dayFilter === 'all'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    כל ימי העבודה
                  </button>
                  {DAYS_ORDER.filter(
                    (d) => (prof?.workSchedule[d] ?? []).length > 0,
                  ).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDayFilter(d)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                        dayFilter === d
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      יום {DAY_LABELS[d].short}
                    </button>
                  ))}
                </div>

                {candidateSlots.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
                    לא נמצאו משבצות פנויות לפי הסינון הנוכחי. נסו להפעיל &quot;הצג
                    חסומים&quot; כדי לראות את הסיבה, או לבדוק בלשונית &quot;החלפה
                    חכמה&quot;.
                  </div>
                ) : (
                  <div className="grid max-h-64 gap-2 overflow-y-auto pe-1 sm:grid-cols-2">
                    {candidateSlots.map((slot) => {
                      const isPicked =
                        slot.day === selectedDay &&
                        slot.startMin === selectedStartMin;
                      const st = slot.evaluation.status;

                      return (
                        <button
                          key={`${slot.day}_${slot.startMin}`}
                          type="button"
                          onClick={() => {
                            setSelectedDay(slot.day);
                            setSelectedStartMin(slot.startMin);
                          }}
                          className={`flex flex-col justify-between rounded-xl border p-2.5 text-start transition ${
                            isPicked
                              ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/40'
                              : st === 'green'
                                ? 'border-emerald-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/40'
                                : st === 'yellow'
                                  ? 'border-amber-300 bg-amber-50/40 hover:border-amber-400 hover:bg-amber-50/80'
                                  : 'border-rose-200 bg-rose-50/30 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {st === 'green' && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                              )}
                              {st === 'yellow' && (
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                              )}
                              {st === 'red' && (
                                <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                              )}
                              <span className="text-xs font-extrabold text-slate-900">
                                {DAY_LABELS[slot.day].full} •{' '}
                                <span dir="ltr" className="inline-block tabular-nums">
                                  {formatRange(slot.startMin, slot.endMin)}
                                </span>
                              </span>
                            </div>
                            {st === 'green' && (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                מומלץ
                              </span>
                            )}
                            {st === 'yellow' && (
                              <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                {slot.evaluation.isDuplicate
                                  ? 'כפילות'
                                  : slot.evaluation.isConsecutivePair
                                    ? 'רצף כפול'
                                    : 'אזהרה'}
                              </span>
                            )}
                          </div>

                          {slot.evaluation.warnings.length > 0 && (
                            <p className="mt-1 text-[11px] leading-snug text-amber-900">
                              {slot.evaluation.warnings[0]}
                            </p>
                          )}
                          {slot.evaluation.reasons.length > 0 && (
                            <p className="mt-1 text-[11px] leading-snug text-rose-700">
                              {slot.evaluation.reasons[0]}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Smart Swap Suggestions */
              <div className="space-y-2">
                {swapSuggestions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
                    לא נמצאו החלפות דו-צדדיות זמינות כרגע לטיפול זה.
                  </div>
                ) : (
                  swapSuggestions.map((swap) => {
                    const target = swap.targetSession;
                    const targetKids =
                      target.type === 'group'
                        ? target.groupLabel ?? 'קבוצתי'
                        : target.kidIds
                            .map((id) => kidMap.get(id)?.name ?? id)
                            .join(', ');

                    return (
                      <div
                        key={target.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                            <span>
                              החלפה עם {targetKids} (
                              {target.type === 'group' ? 'קבוצתי' : 'פרטני 1:1'})
                            </span>
                            <StatusBadge
                              status={swap.combinedSeverity}
                              labelOverride={
                                swap.combinedSeverity === 'green'
                                  ? 'שתי השעות תקינות'
                                  : 'כולל רצף כפול צהוב'
                              }
                            />
                          </div>
                          <div className="mt-1 text-xs text-slate-500 tabular-nums">
                            {DAY_LABELS[target.day].full} •{' '}
                            {formatRange(target.startMin, target.endMin)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSwapSessions(existing!.id, target.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-teal-700"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                          <span>בצע החלפה</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {existing && (
              <>
                <button
                  type="button"
                  onClick={() => onDeleteSession(existing.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>מחק שיבוץ</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateSession(existing)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>שכפל שיבוץ (כפילות)</span>
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              ביטול
            </button>
            <button
              type="button"
              disabled={kidIds.length === 0}
              onClick={handleConfirmSave}
              className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 ${
                currentEvaluation.status === 'red'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : currentEvaluation.status === 'yellow'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              <Check className="h-4 w-4" />
              <span>
                {existing
                  ? currentEvaluation.status === 'red'
                    ? 'שמור בכל זאת (עם התנגשות)'
                    : 'שמור שינוי שעה'
                  : currentEvaluation.isDuplicate
                    ? 'שבץ ככפילות'
                    : 'שבץ טיפול חדש'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

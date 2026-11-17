import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wand2,
} from 'lucide-react';
import {
  COLOR_THEMES,
  createInitialScheduleState,
  emptyWorkSchedule,
} from '../data/presets';
import {
  createId,
  DAY_LABELS,
  DAYS_ORDER,
  formatTime,
  formatVisibleDaysRange,
  getVisibleDaysOrder,
  parseTimeToMinutes,
} from '../engine/timeUtils';
import {
  ColorThemeKey,
  DayKey,
  GroupMode,
  Professional,
  ScheduleState,
  TimeWindow,
} from '../types/schedule';

interface SettingsViewProps {
  state: ScheduleState;
  onUpdateState: (next: ScheduleState, toastMsg?: string) => void;
  onAutoSchedule: (keepExisting: boolean) => void;
}

const COLOR_KEYS = Object.keys(COLOR_THEMES) as ColorThemeKey[];

export function SettingsView({
  state,
  onUpdateState,
  onAutoSchedule,
}: SettingsViewProps) {
  const updateProf = (
    profId: string,
    updater: (p: Professional) => Professional,
  ) => {
    onUpdateState({
      ...state,
      professionals: state.professionals.map((p) =>
        p.id === profId ? updater(p) : p,
      ),
      lastModifiedIso: new Date().toISOString(),
    });
  };

  const addNewProfessional = () => {
    const usedColors = new Set(state.professionals.map((p) => p.color));
    const nextColor =
      COLOR_KEYS.find((c) => !usedColors.has(c)) ??
      COLOR_KEYS[state.professionals.length % COLOR_KEYS.length];

    const newProf: Professional = {
      id: createId('prof'),
      name: `מטפלת ${state.professionals.length + 1}`,
      profession: 'ריפוי בעיסוק',
      color: nextColor,
      workSchedule: {
        ...emptyWorkSchedule(),
        wed: [
          { startMin: 480, endMin: 750 },
          { startMin: 840, endMin: 930 },
        ],
        thu: [
          { startMin: 480, endMin: 750 },
          { startMin: 840, endMin: 930 },
        ],
      },
      blockedSlots: [],
      weeklyQuotaOneOnOnePerKid: 2,
      weeklyQuotaGroupPerKid: 3,
      groupMode: 'all_together',
    };

    onUpdateState(
      {
        ...state,
        professionals: [...state.professionals, newProf],
        lastModifiedIso: new Date().toISOString(),
      },
      'נוספה אשת מקצוע חדשה לרוטציה',
    );
  };

  const removeProfessional = (profId: string) => {
    if (state.professionals.length <= 1) return;
    onUpdateState(
      {
        ...state,
        professionals: state.professionals.filter((p) => p.id !== profId),
        sessions: state.sessions.filter((s) => s.professionalId !== profId),
        lastModifiedIso: new Date().toISOString(),
      },
      'אשת המקצוע הוסרה מהמערכת',
    );
  };

  const toggleWorkDay = (prof: Professional, day: DayKey) => {
    const current = prof.workSchedule[day] ?? [];
    const nextWindows: TimeWindow[] =
      current.length > 0
        ? []
        : day === 'fri'
          ? [{ startMin: 480, endMin: 720 }]
          : [
              { startMin: 480, endMin: 750 },
              { startMin: 840, endMin: 930 },
            ];
    updateProf(prof.id, (p) => ({
      ...p,
      workSchedule: { ...p.workSchedule, [day]: nextWindows },
    }));
  };

  const updateWindow = (
    prof: Professional,
    day: DayKey,
    idx: number,
    field: 'startMin' | 'endMin',
    hhmm: string,
  ) => {
    const parsed = parseTimeToMinutes(hhmm);
    if (parsed === null) return;
    updateProf(prof.id, (p) => {
      const list = [...(p.workSchedule[day] ?? [])];
      if (!list[idx]) return p;
      list[idx] = { ...list[idx], [field]: parsed };
      return {
        ...p,
        workSchedule: { ...p.workSchedule, [day]: list },
      };
    });
  };

  const addDayWindow = (prof: Professional, day: DayKey) => {
    updateProf(prof.id, (p) => ({
      ...p,
      workSchedule: {
        ...p.workSchedule,
        [day]: [
          ...(p.workSchedule[day] ?? []),
          { startMin: 840, endMin: 930 },
        ],
      },
    }));
  };

  const removeDayWindow = (prof: Professional, day: DayKey, idx: number) => {
    updateProf(prof.id, (p) => ({
      ...p,
      workSchedule: {
        ...p.workSchedule,
        [day]: (p.workSchedule[day] ?? []).filter((_, i) => i !== idx),
      },
    }));
  };

  const addKid = () => {
    const nextColor = COLOR_KEYS[state.kids.length % COLOR_KEYS.length];
    onUpdateState(
      {
        ...state,
        kids: [
          ...state.kids,
          {
            id: createId('kid'),
            name: `ילד/ה ${state.kids.length + 1}`,
            color: nextColor,
          },
        ],
        lastModifiedIso: new Date().toISOString(),
      },
      'נוסף/ה ילד/ה חדש/ה לכיתה',
    );
  };

  const removeKid = (kidId: string) => {
    if (state.kids.length <= 1) return;
    onUpdateState(
      {
        ...state,
        kids: state.kids.filter((k) => k.id !== kidId),
        sessions: state.sessions
          .map((s) => ({
            ...s,
            kidIds: s.kidIds.filter((id) => id !== kidId),
          }))
          .filter((s) => s.kidIds.length > 0),
        lastModifiedIso: new Date().toISOString(),
      },
      'הילד/ה הוסר/ה מהרשימה',
    );
  };

  const updateRules = (partial: Partial<ScheduleState['rules']>) => {
    onUpdateState({
      ...state,
      rules: { ...state.rules, ...partial },
      lastModifiedIso: new Date().toISOString(),
    });
  };

  const visibleWeekDays = getVisibleDaysOrder(state.rules.displayDaysCount);
  const displayDaysCount = visibleWeekDays.length;

  return (
    <div className="space-y-6">
      {/* 1. Auto-Schedule & Quick Presets */}
      <section className="rounded-2xl border border-teal-200 bg-gradient-to-l from-teal-50/80 to-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <Wand2 className="h-5 w-5 text-teal-600" />
              <span>שיבוץ אוטומטי ותבניות מהירות</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              לאחר שינוי ימי עבודה, מכסות או כללי רצף — ניתן לבקש מהמערכת לבנות מחדש
              או להשלים שיבוצים חסרים.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onAutoSchedule(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3.5 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>השלם רק חסרים</span>
            </button>
            <button
              type="button"
              onClick={() => onAutoSchedule(false)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-teal-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>שבץ מחדש אוטומטית</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-teal-100 pt-3">
          <span className="text-xs font-bold text-slate-600">תבניות בסיס:</span>
          <button
            type="button"
            onClick={() =>
              onUpdateState(
                createInitialScheduleState('recommended'),
                'נטענה תבנית מומלצת מלאה ותקינה (3 ימי עבודה לכל מטפלת)',
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5 text-teal-600" />
            <span>תבנית מומלצת מלאה (א׳–ה׳)</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateState(
                createInitialScheduleState('original'),
                'נטענו שעות הבסיס המקוריות מהבריף (א׳–ג׳) — שימו לב למגבלת השעות',
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span>שעות הבסיס מהבריף בלבד (א׳–ג׳)</span>
          </button>
        </div>
      </section>

      {/* 2. Weekly Display & Session/Break Rules */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <Clock className="h-5 w-5 text-teal-600" />
          <span>כללי תצוגה, משבצות והפסקות (ניתן לעריכה)</span>
        </h2>

        {/* Visible Days in Weekly Schedule */}
        <div className="mt-4 rounded-2xl border border-teal-200/80 bg-teal-50/40 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  כמות ימים מוצגים בלו״ז השבועי
                </h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  מוצגים כרגע{' '}
                  <strong className="text-teal-800">{displayDaysCount}</strong>{' '}
                  {displayDaysCount === 1 ? 'יום' : 'ימים'}:{' '}
                  <span className="font-semibold text-slate-800">
                    {displayDaysCount === 1
                      ? DAY_LABELS[visibleWeekDays[0]].full
                      : `${DAY_LABELS[visibleWeekDays[0]].full} עד ${DAY_LABELS[visibleWeekDays[visibleWeekDays.length - 1]].full} (${formatVisibleDaysRange(visibleWeekDays)})`}
                  </span>
                </p>
              </div>
            </div>

            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="כמות ימים מוצגים בלו״ז השבועי"
            >
              {[1, 2, 3, 4, 5, 6].map((count) => {
                const daysPreview = DAYS_ORDER.slice(0, count);
                const active = displayDaysCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() =>
                      onUpdateState(
                        {
                          ...state,
                          rules: { ...state.rules, displayDaysCount: count },
                          lastModifiedIso: new Date().toISOString(),
                        },
                        `הלו״ז השבועי עודכן להצגת ${count} ${count === 1 ? 'יום' : 'ימים'} (${formatVisibleDaysRange(daysPreview)})`,
                      )
                    }
                    className={`flex flex-col items-center rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/60'
                    }`}
                  >
                    <span className="tabular-nums text-sm leading-tight">
                      {count}
                    </span>
                    <span
                      className={`text-[10px] font-medium ${
                        active ? 'text-teal-100' : 'text-slate-400'
                      }`}
                    >
                      {formatVisibleDaysRange(daysPreview)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              משך כל טיפול (דקות)
            </label>
            <input
              type="number"
              min={15}
              max={120}
              step={5}
              value={state.rules.sessionDurationMin}
              onChange={(e) =>
                updateRules({
                  sessionDurationMin: Math.max(15, Number(e.target.value) || 45),
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold tabular-nums focus:border-teal-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600">
              הפסקה רגילה בין טיפולים (דקות)
            </label>
            <input
              type="number"
              min={0}
              max={60}
              step={5}
              value={state.rules.standardBreakMin}
              onChange={(e) =>
                updateRules({
                  standardBreakMin: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold tabular-nums focus:border-teal-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Yellow Consecutive 1:1 Rule Highlight Box */}
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h3 className="text-sm font-extrabold text-amber-950">
                  רצף טיפולי 1:1 (סימון אזהרה צהוב) + הפסקה מוגדלת
                </h3>
                <p className="mt-0.5 text-xs text-amber-900/80">
                  מאפשר לשבץ 2 טיפולי 1:1 ברצף ללא הפסקה ביניהם (בסימון צהוב),
                  ולאחריהם חובה להקצות הפסקה ארוכה יותר.
                </p>
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-800 ring-1 ring-amber-200">
              <input
                type="checkbox"
                checked={state.rules.allowConsecutiveOneOnOne}
                onChange={(e) =>
                  updateRules({ allowConsecutiveOneOnOne: e.target.checked })
                }
                className="h-4 w-4 accent-amber-600"
              />
              <span>אפשר רצף 1:1 (צהוב)</span>
            </label>
          </div>

          {state.rules.allowConsecutiveOneOnOne && (
            <div className="mt-3 grid gap-3 border-t border-amber-200/80 pt-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-amber-950">
                  מקסימום 1:1 ברצף
                </label>
                <input
                  type="number"
                  min={2}
                  max={4}
                  value={state.rules.maxConsecutiveOneOnOne}
                  onChange={(e) =>
                    updateRules({
                      maxConsecutiveOneOnOne: Math.max(
                        2,
                        Number(e.target.value) || 2,
                      ),
                    })
                  }
                  className="w-full rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-sm font-bold tabular-nums focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-amber-950">
                  הפסקה נדרשת אחרי רצף (דק׳)
                </label>
                <input
                  type="number"
                  min={15}
                  max={90}
                  step={5}
                  value={state.rules.breakAfterConsecutiveMin}
                  onChange={(e) =>
                    updateRules({
                      breakAfterConsecutiveMin: Math.max(
                        15,
                        Number(e.target.value) || 30,
                      ),
                    })
                  }
                  className="w-full rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-sm font-bold tabular-nums focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-950">
                  <input
                    type="checkbox"
                    checked={state.rules.allowConsecutiveEndOfWindow}
                    onChange={(e) =>
                      updateRules({
                        allowConsecutiveEndOfWindow: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-amber-600"
                  />
                  <span>אפשר סיום רצף בסוף משמרת (14:45–15:30)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-teal-200 bg-teal-50/40 p-3 text-xs font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={state.rules.allowQuarterHourStarts ?? true}
              onChange={(e) =>
                updateRules({ allowQuarterHourStarts: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 accent-teal-600"
            />
            <div>
              <div className="font-bold text-slate-900">
                אפשר התחלת טיפולים בכל רבע שעה (XX:00, XX:15, XX:30, XX:45)
              </div>
              <div className="mt-0.5 text-[11px] font-normal text-slate-600">
                כל טיפול נשאר באורך המוגדר ({state.rules.sessionDurationMin} דק׳)
                ויכול להתחיל בכל רבע שעה.
              </div>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-xs font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={Boolean(state.rules.allowDuplicateBookings)}
              onChange={(e) =>
                updateRules({ allowDuplicateBookings: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 accent-amber-600"
            />
            <div>
              <div className="font-bold text-slate-900">
                אפשר שיבוץ כפילויות וחפיפות
              </div>
              <div className="mt-0.5 text-[11px] font-normal text-slate-600">
                מאפשר לשבץ שיבוצים חופפים באותה שעה או שני טיפולי 1:1 באותו יום
                (יופיעו כאזהרה צהובה).
              </div>
            </div>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={state.rules.preventSameDaySameProfOneOnOne}
              onChange={(e) =>
                updateRules({ preventSameDaySameProfOneOnOne: e.target.checked })
              }
              className="h-4 w-4 accent-teal-600"
            />
            <span>
              מנע שני טיפולי 1:1 לאותו ילד עם אותה מטפלת באותו היום
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={state.rules.warnKidBackToBackDifferentProf}
              onChange={(e) =>
                updateRules({ warnKidBackToBackDifferentProf: e.target.checked })
              }
              className="h-4 w-4 accent-teal-600"
            />
            <span>
              התרע (בצהוב) על מעבר מיידי לילד ללא הפסקה מטיפול של מטפלת אחרת
            </span>
          </label>
        </div>
      </section>

      {/* 3. Professionals Management (supports adding future professionals!) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              אנשי מקצוע וימי עבודה ({state.professionals.length})
            </h2>
            <p className="text-xs text-slate-500">
              ניתן לערוך ימים, שעות, מכסות שבועיות ולהוסיף מטפלות נוספות לרוטציה בעתיד.
            </p>
          </div>
          <button
            type="button"
            onClick={addNewProfessional}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
          >
            <UserPlus className="h-4 w-4" />
            <span>הוסף אשת מקצוע לרוטציה</span>
          </button>
        </div>

        <div className="grid gap-4">
          {state.professionals.map((prof) => {
            const theme = COLOR_THEMES[prof.color];
            return (
              <div
                key={prof.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="grid flex-1 gap-2.5 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-500">
                        שם
                      </label>
                      <input
                        type="text"
                        value={prof.name}
                        onChange={(e) =>
                          updateProf(prof.id, (p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold focus:border-teal-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-500">
                        מקצוע / תחום טיפול
                      </label>
                      <input
                        type="text"
                        value={prof.profession}
                        onChange={(e) =>
                          updateProf(prof.id, (p) => ({
                            ...p,
                            profession: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium focus:border-teal-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-500">
                        צבע זיהוי בלוח
                      </label>
                      <div className="flex items-center gap-1.5 pt-1">
                        {COLOR_KEYS.map((ck) => (
                          <button
                            key={ck}
                            type="button"
                            onClick={() =>
                              updateProf(prof.id, (p) => ({ ...p, color: ck }))
                            }
                            className={`h-6 w-6 rounded-full ${COLOR_THEMES[ck].dot} transition ${
                              prof.color === ck
                                ? 'scale-110 ring-2 ring-slate-900 ring-offset-2'
                                : 'opacity-65 hover:opacity-100'
                            }`}
                            title={COLOR_THEMES[ck].label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {state.professionals.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProfessional(prof.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>הסר</span>
                    </button>
                  )}
                </div>

                {/* Quotas & Group Mode */}
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      מכסת 1:1 שבועית לילד
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={prof.weeklyQuotaOneOnOnePerKid}
                      onChange={(e) =>
                        updateProf(prof.id, (p) => ({
                          ...p,
                          weeklyQuotaOneOnOnePerKid: Math.max(
                            0,
                            Number(e.target.value) || 0,
                          ),
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      מכסת קבוצתי שבועית לילד
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={prof.weeklyQuotaGroupPerKid}
                      onChange={(e) =>
                        updateProf(prof.id, (p) => ({
                          ...p,
                          weeklyQuotaGroupPerKid: Math.max(
                            0,
                            Number(e.target.value) || 0,
                          ),
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">
                      מבנה קבוצות (בשיבוץ אוטומטי)
                    </label>
                    <select
                      value={prof.groupMode}
                      onChange={(e) =>
                        updateProf(prof.id, (p) => ({
                          ...p,
                          groupMode: e.target.value as GroupMode,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-800"
                    >
                      <option value="all_together">
                        כל ה-{state.kids.length} יחד (קבוצה 1)
                      </option>
                      <option value="two_groups">2 קבוצות קטנות (חלוקה לחצי)</option>
                      <option value="three_pairs">זוגות (2 ילדים בקבוצה)</option>
                    </select>
                  </div>
                </div>

                {/* Working Days & Windows */}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="mb-2 text-xs font-bold text-slate-600">
                    ימי ושעות עבודה בגן:
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {DAYS_ORDER.map((day) => {
                      const windows = prof.workSchedule[day] ?? [];
                      const isActive = windows.length > 0;
                      const isDayShownInSchedule = visibleWeekDays.includes(day);
                      return (
                        <div
                          key={day}
                          className={`rounded-xl border p-2.5 transition ${
                            isActive
                              ? `${theme.border} ${theme.bgSoft}/40`
                              : 'border-slate-200 bg-slate-50/70 opacity-75'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-800">
                              <input
                                type="checkbox"
                                checked={isActive}
                                onChange={() => toggleWorkDay(prof, day)}
                                className="h-4 w-4 accent-teal-600"
                              />
                              <span>{DAY_LABELS[day].full}</span>
                              {!isDayShownInSchedule && (
                                <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                  מוסתר בלו״ז
                                </span>
                              )}
                            </label>
                            {isActive && (
                              <button
                                type="button"
                                onClick={() => addDayWindow(prof, day)}
                                className="inline-flex items-center gap-0.5 rounded-lg bg-white px-2 py-0.5 text-[10px] font-bold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50"
                              >
                                <Plus className="h-2.5 w-2.5" />
                                <span>חלון</span>
                              </button>
                            )}
                          </div>

                          {isActive && (
                            <div className="mt-2 space-y-1.5">
                              {windows.map((w, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1.5 text-xs"
                                >
                                  <input
                                    type="time"
                                    value={formatTime(w.startMin)}
                                    onChange={(e) =>
                                      updateWindow(
                                        prof,
                                        day,
                                        idx,
                                        'startMin',
                                        e.target.value,
                                      )
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs tabular-nums"
                                  />
                                  <span className="text-slate-400">–</span>
                                  <input
                                    type="time"
                                    value={formatTime(w.endMin)}
                                    onChange={(e) =>
                                      updateWindow(
                                        prof,
                                        day,
                                        idx,
                                        'endMin',
                                        e.target.value,
                                      )
                                    }
                                    className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs tabular-nums"
                                  />
                                  {windows.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeDayWindow(prof, day, idx)
                                      }
                                      className="rounded p-1 text-slate-400 hover:text-rose-600"
                                      title="הסר חלון"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Kids Management */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <Users className="h-5 w-5 text-teal-600" />
              <span>ילדי הכיתה ({state.kids.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              ערכו שמות אמיתיים או הוסיפו/הסירו ילדים לפי הצורך.
            </p>
          </div>
          <button
            type="button"
            onClick={addKid}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>הוסף ילד/ה</span>
          </button>
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {state.kids.map((kid) => {
            const kt = COLOR_THEMES[kid.color];
            return (
              <div
                key={kid.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5"
              >
                <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${kt.dot}`} />
                <input
                  type="text"
                  value={kid.name}
                  onChange={(e) =>
                    onUpdateState({
                      ...state,
                      kids: state.kids.map((k) =>
                        k.id === kid.id ? { ...k, name: e.target.value } : k,
                      ),
                      lastModifiedIso: new Date().toISOString(),
                    })
                  }
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm font-bold text-slate-800 focus:border-teal-500 focus:outline-none"
                />
                {state.kids.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeKid(kid.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="הסר ילד/ה"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

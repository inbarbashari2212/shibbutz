import { CheckCircle2, Plus, Sparkles, User, Users } from 'lucide-react';
import { useMemo } from 'react';
import { COLOR_THEMES } from '../data/presets';
import { DAY_LABELS, DAYS_ORDER, formatRange } from '../engine/timeUtils';
import { computeQuotaReport } from '../engine/validator';
import {
  Kid,
  Professional,
  ScheduleState,
  Session,
  SlotEvaluation,
} from '../types/schedule';
import { StatusBadge } from './StatusBadge';

interface KidsQuotaViewProps {
  state: ScheduleState;
  evaluations: Record<string, SlotEvaluation>;
  onSelectSession: (session: Session) => void;
  onQuickCreateMissing: (prefill: {
    professionalId: string;
    type: 'one_on_one' | 'group';
    kidIds: string[];
  }) => void;
}

export function KidsQuotaView({
  state,
  evaluations,
  onSelectSession,
  onQuickCreateMissing,
}: KidsQuotaViewProps) {
  const quotas = useMemo(() => computeQuotaReport(state), [state]);
  const profMap = useMemo(
    () => new Map<string, Professional>(state.professionals.map((p) => [p.id, p])),
    [state.professionals],
  );

  const renderKidCard = (kid: Kid) => {
    const kidTheme = COLOR_THEMES[kid.color];
    const kidQuotas = quotas.filter((q) => q.kidId === kid.id);
    const kidSessions = state.sessions
      .filter((s) => s.kidIds.includes(kid.id))
      .sort((a, b) => {
        const d = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
        return d !== 0 ? d : a.startMin - b.startMin;
      });

    const totalCompleted = kidQuotas.reduce(
      (sum, q) =>
        sum +
        Math.min(q.oneOnOneCount, q.oneOnOneTarget) +
        Math.min(q.groupCount, q.groupTarget),
      0,
    );
    const totalTarget = kidQuotas.reduce(
      (sum, q) => sum + q.oneOnOneTarget + q.groupTarget,
      0,
    );
    const allMet = totalCompleted === totalTarget && totalTarget > 0;

    return (
      <div
        key={kid.id}
        className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:shadow-sm"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-base font-extrabold text-white shadow-xs ${kidTheme.bg}`}
            >
              {kid.name.slice(0, 1)}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{kid.name}</h3>
              <p className="text-xs text-slate-500 tabular-nums">
                {kidSessions.length} מפגשים משובצים השבוע
              </p>
            </div>
          </div>
          {allMet ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>מכסה מלאה ({totalCompleted}/{totalTarget})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200 tabular-nums">
              <span>
                {totalCompleted}/{totalTarget} הושלמו
              </span>
            </span>
          )}
        </div>

        {/* Quota Progress per Profession */}
        <div className="mt-3 space-y-2">
          {kidQuotas.map((q) => {
            const prof = profMap.get(q.profId);
            if (!prof) return null;
            const pTheme = COLOR_THEMES[prof.color];
            const missing1on1 = q.oneOnOneCount < q.oneOnOneTarget;
            const missingGroup = q.groupCount < q.groupTarget;

            return (
              <div
                key={q.profId}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <span className={`h-2 w-2 rounded-full ${pTheme.dot}`} />
                    <span>{prof.profession}</span>
                    <span className="font-normal text-slate-500">
                      ({prof.name})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                        missing1on1
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      1:1: {q.oneOnOneCount}/{q.oneOnOneTarget}
                    </span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                        missingGroup
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      קבוצתי: {q.groupCount}/{q.groupTarget}
                    </span>
                  </div>
                </div>

                {(missing1on1 || missingGroup) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {missing1on1 && (
                      <button
                        type="button"
                        onClick={() =>
                          onQuickCreateMissing({
                            professionalId: prof.id,
                            type: 'one_on_one',
                            kidIds: [kid.id],
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-50"
                      >
                        <Plus className="h-3 w-3" />
                        <span>שבץ פרטני חסר</span>
                      </button>
                    )}
                    {missingGroup && (
                      <button
                        type="button"
                        onClick={() =>
                          onQuickCreateMissing({
                            professionalId: prof.id,
                            type: 'group',
                            kidIds: state.kids.map((k) => k.id),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-50"
                      >
                        <Plus className="h-3 w-3" />
                        <span>שבץ קבוצתי חסר</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Kid's Weekly Timeline */}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600">
            <span>סדר השבוע של {kid.name}</span>
            <span className="text-[11px] font-normal text-slate-400">
              לחצו לעריכה
            </span>
          </div>
          <div className="max-h-60 space-y-1.5 overflow-y-auto pe-1">
            {kidSessions.map((s) => {
              const prof = profMap.get(s.professionalId);
              if (!prof) return null;
              const pTheme = COLOR_THEMES[prof.color];
              const ev = evaluations[s.id];

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSession(s)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-2.5 py-2 text-start text-xs transition hover:border-teal-300 hover:bg-teal-50/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${pTheme.dot}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span>יום {DAY_LABELS[s.day].short}</span>
                        <span className="tabular-nums text-slate-500">
                          {formatRange(s.startMin, s.endMin)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                        {s.type === 'group' ? (
                          <Users className="h-3 w-3 shrink-0" />
                        ) : (
                          <User className="h-3 w-3 shrink-0" />
                        )}
                        <span className="truncate">
                          {prof.profession} ({prof.name}) •{' '}
                          {s.type === 'group' ? 'קבוצתי' : 'פרטני 1:1'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {ev && ev.status !== 'green' && (
                      <StatusBadge status={ev.status} compact />
                    )}
                    <Sparkles className="h-3.5 w-3.5 text-slate-300" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {state.kids.map(renderKidCard)}
    </div>
  );
}

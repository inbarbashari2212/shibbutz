import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Plus,
  Redo2,
  Settings,
  Share2,
  Table2,
  Undo2,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterBar } from './components/FilterBar';
import { FlatTableView } from './components/FlatTableView';
import { KidsQuotaView } from './components/KidsQuotaView';
import {
  SessionEditorDraft,
  SessionEditorModal,
} from './components/SessionEditorModal';
import { SettingsView } from './components/SettingsView';
import { ShareModal } from './components/ShareModal';
import { TherapistsView } from './components/TherapistsView';
import { WeeklyCalendarView } from './components/WeeklyCalendarView';
import { createInitialScheduleState } from './data/presets';
import { generateSchedule } from './engine/scheduler';
import { createId, DAY_LABELS, formatRange } from './engine/timeUtils';
import {
  computeQuotaReport,
  evaluateAllSessions,
} from './engine/validator';
import {
  INITIAL_FILTERS,
  ScheduleFilters,
  ViewMode,
} from './types/filters';
import {
  BlockedSlot,
  DayKey,
  ScheduleState,
  Session,
} from './types/schedule';
import {
  extractScheduleFromUrl,
  loadScheduleFromStorage,
  saveScheduleToStorage,
} from './utils/share';

function getInitialState(): { state: ScheduleState; loadedFromLink: boolean } {
  const fromUrl = extractScheduleFromUrl();
  if (fromUrl) {
    saveScheduleToStorage(fromUrl);
    return { state: fromUrl, loadedFromLink: true };
  }
  const fromStorage = loadScheduleFromStorage();
  if (fromStorage) {
    return { state: fromStorage, loadedFromLink: false };
  }
  return { state: createInitialScheduleState('recommended'), loadedFromLink: false };
}

export function App() {
  const initial = useMemo(() => getInitialState(), []);
  const [state, setState] = useState<ScheduleState>(initial.state);
  const [past, setPast] = useState<ScheduleState[]>([]);
  const [future, setFuture] = useState<ScheduleState[]>([]);

  const [view, setView] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState<ScheduleFilters>(INITIAL_FILTERS);
  const [editorDraft, setEditorDraft] = useState<SessionEditorDraft | null>(
    null,
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    canUndo?: boolean;
  } | null>(
    initial.loadedFromLink
      ? { message: 'נטען לוח משותף מהקישור ונשמר במכשיר שלך!' }
      : null,
  );

  useEffect(() => {
    saveScheduleToStorage(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const commitState = useCallback(
    (next: ScheduleState, toastMsg?: string) => {
      setPast((prev) => [...prev.slice(-24), state]);
      setFuture([]);
      setState(next);
      if (toastMsg) {
        setToast({ message: toastMsg, canUndo: true });
      }
    },
    [state],
  );

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [state, ...prev.slice(0, 24)]);
    setState(previous);
    setToast({ message: 'הפעולה בוטלה' });
  }, [past, state]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev.slice(-24), state]);
    setState(next);
    setToast({ message: 'הפעולה שוחזרה' });
  }, [future, state]);

  const evaluations = useMemo(() => evaluateAllSessions(state), [state]);
  const quotaReport = useMemo(() => computeQuotaReport(state), [state]);

  const stats = useMemo(() => {
    let green = 0;
    let yellow = 0;
    let red = 0;
    for (const s of state.sessions) {
      const st = evaluations[s.id]?.status ?? 'green';
      if (st === 'green') green++;
      else if (st === 'yellow') yellow++;
      else red++;
    }
    const missingQuotas = quotaReport.reduce(
      (sum, q) =>
        sum +
        Math.max(0, q.oneOnOneTarget - q.oneOnOneCount) +
        Math.max(0, q.groupTarget - q.groupCount),
      0,
    );
    return { green, yellow, red, missingQuotas };
  }, [state.sessions, evaluations, quotaReport]);

  const profMap = useMemo(
    () => new Map(state.professionals.map((p) => [p.id, p])),
    [state.professionals],
  );
  const kidMap = useMemo(
    () => new Map(state.kids.map((k) => [k.id, k])),
    [state.kids],
  );

  const filteredSessions = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return state.sessions.filter((s) => {
      if (
        filters.professionalIds.length > 0 &&
        !filters.professionalIds.includes(s.professionalId)
      ) {
        return false;
      }
      if (
        filters.kidIds.length > 0 &&
        !filters.kidIds.some((id) => s.kidIds.includes(id))
      ) {
        return false;
      }
      if (filters.sessionType !== 'all' && s.type !== filters.sessionType) {
        return false;
      }
      if (filters.day !== 'all' && s.day !== filters.day) {
        return false;
      }
      if (filters.status !== 'all') {
        const st = evaluations[s.id]?.status ?? 'green';
        if (st !== filters.status) return false;
      }
      if (q) {
        const prof = profMap.get(s.professionalId);
        const kidNames = s.kidIds
          .map((id) => kidMap.get(id)?.name ?? '')
          .join(' ');
        const haystack = [
          prof?.name ?? '',
          prof?.profession ?? '',
          kidNames,
          s.groupLabel ?? '',
          s.notes ?? '',
          DAY_LABELS[s.day].full,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [state.sessions, filters, evaluations, profMap, kidMap]);

  const handleSaveSession = (saved: Session, isNew: boolean) => {
    const nextSessions = isNew
      ? [...state.sessions, saved]
      : state.sessions.map((s) => (s.id === saved.id ? saved : s));
    commitState(
      {
        ...state,
        sessions: nextSessions,
        lastModifiedIso: new Date().toISOString(),
      },
      isNew
        ? `נוסף שיבוץ חדש: ${DAY_LABELS[saved.day].full} ${formatRange(saved.startMin, saved.endMin)}`
        : `השיבוץ עודכן ל${DAY_LABELS[saved.day].full} ${formatRange(saved.startMin, saved.endMin)}`,
    );
    setEditorDraft(null);
  };

  const handleSwapSessions = (sessionAId: string, sessionBId: string) => {
    const a = state.sessions.find((s) => s.id === sessionAId);
    const b = state.sessions.find((s) => s.id === sessionBId);
    if (!a || !b) return;
    const durA = a.endMin - a.startMin;
    const durB = b.endMin - b.startMin;
    const nextSessions = state.sessions.map((s) => {
      if (s.id === a.id) {
        return {
          ...s,
          day: b.day,
          startMin: b.startMin,
          endMin: b.startMin + durA,
        };
      }
      if (s.id === b.id) {
        return {
          ...s,
          day: a.day,
          startMin: a.startMin,
          endMin: a.startMin + durB,
        };
      }
      return s;
    });
    commitState(
      {
        ...state,
        sessions: nextSessions,
        lastModifiedIso: new Date().toISOString(),
      },
      'שני השיבוצים הוחלפו בהצלחה!',
    );
    setEditorDraft(null);
  };

  const handleDeleteSession = (sessionId: string) => {
    commitState(
      {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        lastModifiedIso: new Date().toISOString(),
      },
      'השיבוץ הוסר מהלוח',
    );
    setEditorDraft(null);
  };

  const handleAddBlockedSlot = (profId: string, block: BlockedSlot) => {
    commitState(
      {
        ...state,
        professionals: state.professionals.map((p) =>
          p.id === profId
            ? { ...p, blockedSlots: [...p.blockedSlots, block] }
            : p,
        ),
        lastModifiedIso: new Date().toISOString(),
      },
      'השעה סומנה כלא פנויה',
    );
  };

  const handleUnblockSlot = (profId: string, blockId: string) => {
    commitState(
      {
        ...state,
        professionals: state.professionals.map((p) =>
          p.id === profId
            ? {
                ...p,
                blockedSlots: p.blockedSlots.filter((b) => b.id !== blockId),
              }
            : p,
        ),
        lastModifiedIso: new Date().toISOString(),
      },
      'החסימה הוסרה',
    );
  };

  const handleAutoSchedule = (keepExisting: boolean) => {
    const res = generateSchedule(state, { keepExisting });
    commitState(
      res.state,
      res.unplaced.length === 0
        ? 'המערכת שובצה בהצלחה — כל המכסות מלאות וללא התנגשויות!'
        : `השיבוץ עודכן! נותרו ${res.unplaced.length} טיפולים ללא מקום פנוי (ניתן להגדיל שעות בהגדרות).`,
    );
  };

  const navItems: {
    id: ViewMode;
    label: string;
    shortLabel: string;
    icon: typeof CalendarDays;
  }[] = [
    {
      id: 'grid',
      label: 'לוח שבועי',
      shortLabel: 'לוח',
      icon: CalendarDays,
    },
    {
      id: 'table',
      label: 'טבלה מרוכזת',
      shortLabel: 'טבלה',
      icon: Table2,
    },
    {
      id: 'kids',
      label: 'מעקב ילדים ומכסות',
      shortLabel: 'ילדים',
      icon: Users,
    },
    {
      id: 'therapists',
      label: 'מטפלות וזמינות',
      shortLabel: 'מטפלות',
      icon: UserCheck,
    },
    {
      id: 'settings',
      label: 'הגדרות וכללים',
      shortLabel: 'הגדרות',
      icon: Settings,
    },
  ];

  const showFilterBar = view === 'grid' || view === 'table';

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      {/* Top Header */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-sm">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                שיבוץ גן תקשורת
              </h1>
              <p className="text-[11px] text-slate-500 sm:text-xs">
                מערכת משותפת: {state.professionals.map((p) => p.name).join(' • ')} •{' '}
                {state.kids.length} ילדים
              </p>
            </div>
          </div>

          {/* Live Health Summary Pills */}
          <div className="hidden flex-wrap items-center gap-1.5 xl:flex">
            <button
              type="button"
              onClick={() => {
                setView('grid');
                setFilters({ ...INITIAL_FILTERS, status: 'green' });
              }}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200/80 hover:bg-emerald-100"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="tabular-nums">{stats.green} תקינים</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setView('grid');
                setFilters({ ...INITIAL_FILTERS, status: 'yellow' });
              }}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-300/80 hover:bg-amber-100"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="tabular-nums">{stats.yellow} רצף כפול</span>
            </button>
            {stats.red > 0 && (
              <button
                type="button"
                onClick={() => {
                  setView('table');
                  setFilters({ ...INITIAL_FILTERS, status: 'red' });
                }}
                className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-100"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span className="tabular-nums">{stats.red} התנגשויות</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setView('kids')}
              className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 tabular-nums ${
                stats.missingQuotas === 0
                  ? 'bg-teal-50 text-teal-800 ring-teal-200'
                  : 'bg-amber-50 text-amber-900 ring-amber-300'
              }`}
            >
              {stats.missingQuotas === 0
                ? '✓ כל המכסות מלאות'
                : `חסרים ${stats.missingQuotas} במכסות`}
            </button>
          </div>

          {/* Primary Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={past.length === 0}
              onClick={handleUndo}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:opacity-35"
              title="בטל פעולה אחרונה"
              aria-label="בטל"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={future.length === 0}
              onClick={handleRedo}
              className="hidden rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 disabled:opacity-35 sm:inline-flex"
              title="בצע שוב"
              aria-label="בצע שוב"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <Share2 className="h-4 w-4 text-teal-600" />
              <span className="hidden sm:inline">שיתוף והדפסה</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorDraft({ mode: 'create' })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-teal-700 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>שיבוץ חדש</span>
            </button>
          </div>
        </div>

        {/* Desktop Sub-Nav Tabs */}
        <div className="mx-auto hidden max-w-[1440px] items-center justify-between border-t border-slate-100 px-6 md:flex">
          <nav className="flex gap-1 py-1.5" aria-label="תצוגות">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    active
                      ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.id === 'kids' && stats.missingQuotas > 0 && (
                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white tabular-nums">
                      {stats.missingQuotas}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="text-[11px] text-slate-400">
            א׳–ה׳ 07:30–15:30 • ו׳ 07:30–12:00 • הפסקת צהריים 12:30–14:00
          </div>
        </div>
      </header>

      {/* Print Header (visible only when printing) */}
      <div className="hidden print-only mb-4 border-b border-slate-300 pb-2">
        <h1 className="text-xl font-extrabold">
          מערכת טיפולים שבועית — גן תקשורת
        </h1>
        <p className="text-xs text-slate-600">
          {state.professionals
            .map((p) => `${p.name} (${p.profession})`)
            .join(' | ')}
        </p>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-[1440px] space-y-4 px-3 pt-4 sm:px-6 print-full-width">
        {/* Compact mobile health pills */}
        <div className="no-print flex flex-wrap items-center gap-1.5 xl:hidden">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 tabular-nums">
            <CheckCircle2 className="h-3 w-3" />
            <span>{stats.green} תקינים</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-300 tabular-nums">
            <AlertTriangle className="h-3 w-3" />
            <span>{stats.yellow} רצף כפול</span>
          </span>
          {stats.red > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-rose-300 tabular-nums">
              <XCircle className="h-3 w-3" />
              <span>{stats.red} התנגשויות</span>
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 tabular-nums ${
              stats.missingQuotas === 0
                ? 'bg-teal-50 text-teal-800 ring-teal-200'
                : 'bg-amber-50 text-amber-900 ring-amber-300'
            }`}
          >
            {stats.missingQuotas === 0
              ? '✓ כל המכסות מלאות'
              : `חסרים ${stats.missingQuotas} במכסות`}
          </span>
        </div>

        {showFilterBar && (
          <FilterBar
            filters={filters}
            onChange={setFilters}
            professionals={state.professionals}
            kids={state.kids}
            totalCount={state.sessions.length}
            filteredCount={filteredSessions.length}
          />
        )}

        <div className="animate-fade-up" key={view}>
          {view === 'grid' && (
            <WeeklyCalendarView
              state={state}
              filteredSessions={filteredSessions}
              evaluations={evaluations}
              filters={filters}
              onSelectSession={(session) =>
                setEditorDraft({ mode: 'edit', session })
              }
              onCreateAtSlot={(prefill) =>
                setEditorDraft({ mode: 'create', prefill })
              }
              onUnblockSlot={handleUnblockSlot}
            />
          )}

          {view === 'table' && (
            <FlatTableView
              state={state}
              filteredSessions={filteredSessions}
              evaluations={evaluations}
              onSelectSession={(session) =>
                setEditorDraft({ mode: 'edit', session })
              }
              onDeleteSession={handleDeleteSession}
            />
          )}

          {view === 'kids' && (
            <KidsQuotaView
              state={state}
              evaluations={evaluations}
              onSelectSession={(session) =>
                setEditorDraft({ mode: 'edit', session })
              }
              onQuickCreateMissing={(prefill) =>
                setEditorDraft({ mode: 'create', prefill })
              }
            />
          )}

          {view === 'therapists' && (
            <TherapistsView
              state={state}
              evaluations={evaluations}
              onSelectSession={(session) =>
                setEditorDraft({ mode: 'edit', session })
              }
              onCreateAtSlot={(prefill) =>
                setEditorDraft({ mode: 'create', prefill })
              }
              onAddBlockedSlot={handleAddBlockedSlot}
              onUnblockSlot={handleUnblockSlot}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              state={state}
              onUpdateState={commitState}
              onAutoSchedule={handleAutoSchedule}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        aria-label="ניווט תחתון"
      >
        <div className="grid grid-cols-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-bold transition ${
                  active ? 'text-teal-700' : 'text-slate-500'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'scale-105' : ''}`} />
                <span>{item.shortLabel}</span>
                {item.id === 'kids' && stats.missingQuotas > 0 && (
                  <span className="absolute top-1.5 start-1/2 ms-2 h-2 w-2 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      {editorDraft && (
        <SessionEditorModal
          state={state}
          draft={editorDraft}
          onClose={() => setEditorDraft(null)}
          onSaveSession={handleSaveSession}
          onSwapSessions={handleSwapSessions}
          onDeleteSession={handleDeleteSession}
          onBlockOriginalAndStayOpen={(
            profId: string,
            day: DayKey,
            startMin: number,
            endMin: number,
          ) => {
            handleAddBlockedSlot(profId, {
              id: createId('blk'),
              day,
              startMin,
              endMin,
              reason: 'סומן כלא נוח',
            });
          }}
        />
      )}

      {shareOpen && (
        <ShareModal
          state={state}
          onClose={() => setShareOpen(false)}
          onImportState={(imported) =>
            commitState(imported, 'המערכת יובאה בהצלחה מהקובץ!')
          }
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="no-print fixed bottom-20 start-4 end-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl md:bottom-6">
          <span>{toast.message}</span>
          {toast.canUndo && past.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              className="shrink-0 rounded-lg bg-teal-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-400"
            >
              בטל
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;

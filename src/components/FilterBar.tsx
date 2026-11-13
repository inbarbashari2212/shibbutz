import { Filter, RotateCcw, Search, X } from 'lucide-react';
import { useState } from 'react';
import { COLOR_THEMES } from '../data/presets';
import { DAY_LABELS, DAYS_ORDER } from '../engine/timeUtils';
import { INITIAL_FILTERS, ScheduleFilters } from '../types/filters';
import { Kid, Professional, SessionType, SlotStatus } from '../types/schedule';

interface FilterBarProps {
  filters: ScheduleFilters;
  onChange: (next: ScheduleFilters) => void;
  professionals: Professional[];
  kids: Kid[];
  totalCount: number;
  filteredCount: number;
}

export function FilterBar({
  filters,
  onChange,
  professionals,
  kids,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const hasActiveFilters =
    filters.professionalIds.length > 0 ||
    filters.kidIds.length > 0 ||
    filters.sessionType !== 'all' ||
    filters.day !== 'all' ||
    filters.status !== 'all' ||
    filters.search.trim() !== '';

  const activeFilterCount =
    (filters.professionalIds.length > 0 ? 1 : 0) +
    (filters.kidIds.length > 0 ? 1 : 0) +
    (filters.sessionType !== 'all' ? 1 : 0) +
    (filters.day !== 'all' ? 1 : 0) +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.search.trim() !== '' ? 1 : 0);

  const toggleProf = (id: string) => {
    const exists = filters.professionalIds.includes(id);
    onChange({
      ...filters,
      professionalIds: exists
        ? filters.professionalIds.filter((x) => x !== id)
        : [...filters.professionalIds, id],
    });
  };

  const toggleKid = (id: string) => {
    const exists = filters.kidIds.includes(id);
    onChange({
      ...filters,
      kidIds: exists
        ? filters.kidIds.filter((x) => x !== id)
        : [...filters.kidIds, id],
    });
  };

  return (
    <section className="no-print rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs sm:p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search Input */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="חיפוש לפי שם ילד, מטפלת, מקצוע או הערה..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pe-9 ps-9 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
              aria-label="נקה חיפוש"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Toggle + Count */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 md:hidden"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>סינון</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          <span className="rounded-xl bg-slate-100 px-2.5 py-2 text-xs font-medium text-slate-600 tabular-nums">
            מציג <strong className="text-slate-900">{filteredCount}</strong> מתוך{' '}
            {totalCount}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => onChange(INITIAL_FILTERS)}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>נקה סינון</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable filters on mobile, always visible on md+ */}
      <div
        className={`${
          mobileExpanded ? 'mt-3 flex' : 'hidden md:mt-3 md:flex'
        } flex-col gap-2.5 border-t border-slate-100 pt-3`}
      >
        {/* Row 1: Professionals */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="me-1 text-xs font-semibold text-slate-500">
            מקצוע ומטפלת:
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...filters, professionalIds: [] })}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filters.professionalIds.length === 0
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            הכל
          </button>
          {professionals.map((p) => {
            const active = filters.professionalIds.includes(p.id);
            const theme = COLOR_THEMES[p.color];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProf(p.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? `${theme.badge} ring-2 ${theme.ring}/30`
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                <span>{p.name}</span>
                <span className="opacity-75">• {p.profession}</span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Kids */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="me-1 text-xs font-semibold text-slate-500">
            ילד/ה:
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...filters, kidIds: [] })}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filters.kidIds.length === 0
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            כל הילדים ({kids.length})
          </button>
          {kids.map((k) => {
            const active = filters.kidIds.includes(k.id);
            const theme = COLOR_THEMES[k.color];
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => toggleKid(k.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? `${theme.badge} ring-2 ${theme.ring}/30`
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                <span>{k.name}</span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Type, Day, Status */}
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="me-1 text-xs font-semibold text-slate-500">סוג:</span>
            {(
              [
                ['all', 'הכל'],
                ['one_on_one', 'פרטני 1:1'],
                ['group', 'קבוצתי'],
              ] as [ScheduleFilters['sessionType'], string][]
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() =>
                  onChange({ ...filters, sessionType: val as 'all' | SessionType })
                }
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  filters.sessionType === val
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="me-1 text-xs font-semibold text-slate-500">יום:</span>
            <select
              value={filters.day}
              onChange={(e) =>
                onChange({
                  ...filters,
                  day: e.target.value as ScheduleFilters['day'],
                })
              }
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 focus:border-teal-500 focus:outline-none"
            >
              <option value="all">כל השבוע (א׳–ו׳)</option>
              {DAYS_ORDER.map((d) => (
                <option key={d} value={d}>
                  {DAY_LABELS[d].full}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="me-1 text-xs font-semibold text-slate-500">סטטוס:</span>
            {(
              [
                ['all', 'הכל'],
                ['green', '🟢 תקין'],
                ['yellow', '🟡 רצף כפול'],
                ['red', '🔴 התנגשות'],
              ] as ['all' | SlotStatus, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onChange({ ...filters, status: val })}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  filters.status === val
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

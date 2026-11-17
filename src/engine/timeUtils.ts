import { DayKey, TimeWindow } from '../types/schedule';

export const DAYS_ORDER: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

export const DAY_LABELS: Record<DayKey, { short: string; full: string }> = {
  sun: { short: 'א׳', full: 'יום ראשון' },
  mon: { short: 'ב׳', full: 'יום שני' },
  tue: { short: 'ג׳', full: 'יום שלישי' },
  wed: { short: 'ד׳', full: 'יום רביעי' },
  thu: { short: 'ה׳', full: 'יום חמישי' },
  fri: { short: 'ו׳', full: 'יום שישי' },
};

export function getVisibleDaysOrder(displayDaysCount?: number): DayKey[] {
  const count =
    typeof displayDaysCount === 'number' && Number.isFinite(displayDaysCount)
      ? Math.min(DAYS_ORDER.length, Math.max(1, Math.round(displayDaysCount)))
      : DAYS_ORDER.length;
  return DAYS_ORDER.slice(0, count);
}

export function formatVisibleDaysRange(days: DayKey[]): string {
  if (days.length === 0) return '';
  if (days.length === 1) return DAY_LABELS[days[0]].short;
  return `${DAY_LABELS[days[0]].short}–${DAY_LABELS[days[days.length - 1]].short}`;
}

export function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatRange(startMin: number, endMin: number): string {
  return `${formatTime(startMin)}–${formatTime(endMin)}`;
}

export function parseTimeToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isContainedInWindows(
  startMin: number,
  endMin: number,
  windows: TimeWindow[],
): boolean {
  return windows.some((w) => startMin >= w.startMin && endMin <= w.endMin);
}

export function findContainingWindow(
  startMin: number,
  endMin: number,
  windows: TimeWindow[],
): TimeWindow | null {
  return windows.find((w) => startMin >= w.startMin && endMin <= w.endMin) ?? null;
}

export function intersectWindows(a: TimeWindow[], b: TimeWindow[]): TimeWindow[] {
  const result: TimeWindow[] = [];
  for (const wa of a) {
    for (const wb of b) {
      const startMin = Math.max(wa.startMin, wb.startMin);
      const endMin = Math.min(wa.endMin, wb.endMin);
      if (startMin < endMin) {
        result.push({ startMin, endMin });
      }
    }
  }
  return result.sort((x, y) => x.startMin - y.startMin);
}

export function createId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

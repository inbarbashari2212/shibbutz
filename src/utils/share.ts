import LZString from 'lz-string';
import { ScheduleState } from '../types/schedule';

const STORAGE_KEY = 'shibbutz_gan_schedule_v1';

export function saveScheduleToStorage(state: ScheduleState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in private browsing
  }
}

export function loadScheduleFromStorage(): ScheduleState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isValidScheduleState(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearScheduleStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function isValidScheduleState(data: unknown): data is ScheduleState {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Partial<ScheduleState>;
  return (
    Array.isArray(obj.professionals) &&
    Array.isArray(obj.kids) &&
    Array.isArray(obj.sessions) &&
    Boolean(obj.rules && typeof obj.rules === 'object')
  );
}

export function encodeScheduleToShareUrl(
  state: ScheduleState,
  baseHref = typeof window !== 'undefined' ? window.location.href : 'https://example.com/',
): string {
  const json = JSON.stringify(state);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const url = new URL(baseHref);
  url.search = '';
  url.hash = `s=${compressed}`;
  return url.toString();
}

export function decodeScheduleFromHash(hash: string): ScheduleState | null {
  try {
    if (!hash.startsWith('#s=')) return null;
    const compressed = hash.slice(3);
    if (!compressed) return null;
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    const parsed = JSON.parse(json);
    return isValidScheduleState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function extractScheduleFromUrl(): ScheduleState | null {
  if (typeof window === 'undefined') return null;
  return decodeScheduleFromHash(window.location.hash);
}

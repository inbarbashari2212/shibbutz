import { DayKey, SessionType, SlotStatus } from './schedule';

export type ViewMode = 'grid' | 'table' | 'kids' | 'therapists' | 'settings';

export interface ScheduleFilters {
  professionalIds: string[]; // empty = all
  kidIds: string[]; // empty = all
  sessionType: 'all' | SessionType;
  day: 'all' | DayKey;
  status: 'all' | SlotStatus;
  search: string;
}

export const INITIAL_FILTERS: ScheduleFilters = {
  professionalIds: [],
  kidIds: [],
  sessionType: 'all',
  day: 'all',
  status: 'all',
  search: '',
};

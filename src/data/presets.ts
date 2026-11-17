import {
  ColorThemeKey,
  DayKey,
  Kid,
  Professional,
  ScheduleRules,
  ScheduleState,
} from '../types/schedule';
import { generateSchedule } from '../engine/scheduler';

export const COLOR_THEMES: Record<
  ColorThemeKey,
  {
    label: string;
    bg: string;
    bgSoft: string;
    border: string;
    text: string;
    badge: string;
    dot: string;
    ring: string;
  }
> = {
  teal: {
    label: 'טורקיז',
    bg: 'bg-teal-600',
    bgSoft: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-800',
    badge: 'bg-teal-100 text-teal-800 border-teal-200',
    dot: 'bg-teal-500',
    ring: 'ring-teal-500',
  },
  violet: {
    label: 'סגול',
    bg: 'bg-violet-600',
    bgSoft: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-800',
    badge: 'bg-violet-100 text-violet-800 border-violet-200',
    dot: 'bg-violet-500',
    ring: 'ring-violet-500',
  },
  amber: {
    label: 'כתום-ענבר',
    bg: 'bg-amber-600',
    bgSoft: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    badge: 'bg-amber-100 text-amber-900 border-amber-200',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500',
  },
  rose: {
    label: 'ורוד-אפרסק',
    bg: 'bg-rose-600',
    bgSoft: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-800',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500',
  },
  sky: {
    label: 'תכלת',
    bg: 'bg-sky-600',
    bgSoft: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-800',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    dot: 'bg-sky-500',
    ring: 'ring-sky-500',
  },
  emerald: {
    label: 'ירוק-אזמרגד',
    bg: 'bg-emerald-600',
    bgSoft: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500',
  },
};

export const DEFAULT_RULES: ScheduleRules = {
  displayDaysCount: 6,
  allowQuarterHourStarts: true,
  allowDuplicateBookings: false,
  kindergartenHours: {
    sun: { startMin: 7 * 60 + 30, endMin: 15 * 60 + 30 },
    mon: { startMin: 7 * 60 + 30, endMin: 15 * 60 + 30 },
    tue: { startMin: 7 * 60 + 30, endMin: 15 * 60 + 30 },
    wed: { startMin: 7 * 60 + 30, endMin: 15 * 60 + 30 },
    thu: { startMin: 7 * 60 + 30, endMin: 15 * 60 + 30 },
    fri: { startMin: 7 * 60 + 30, endMin: 12 * 60 },
  },
  sessionWindows: {
    sun: [
      { startMin: 8 * 60, endMin: 12 * 60 + 30 },
      { startMin: 14 * 60, endMin: 15 * 60 + 30 },
    ],
    mon: [
      { startMin: 8 * 60, endMin: 12 * 60 + 30 },
      { startMin: 14 * 60, endMin: 15 * 60 + 30 },
    ],
    tue: [
      { startMin: 8 * 60, endMin: 12 * 60 + 30 },
      { startMin: 14 * 60, endMin: 15 * 60 + 30 },
    ],
    wed: [
      { startMin: 8 * 60, endMin: 12 * 60 + 30 },
      { startMin: 14 * 60, endMin: 15 * 60 + 30 },
    ],
    thu: [
      { startMin: 8 * 60, endMin: 12 * 60 + 30 },
      { startMin: 14 * 60, endMin: 15 * 60 + 30 },
    ],
    fri: [{ startMin: 8 * 60, endMin: 12 * 60 }],
  },
  sessionDurationMin: 45,
  standardBreakMin: 15,
  allowConsecutiveOneOnOne: true,
  maxConsecutiveOneOnOne: 2,
  breakAfterConsecutiveMin: 30,
  allowConsecutiveEndOfWindow: true,
  preventSameDaySameProfOneOnOne: true,
  warnKidBackToBackDifferentProf: true,
};

export const DEFAULT_KIDS: Kid[] = [
  { id: 'kid_1', name: 'נועם', color: 'sky' },
  { id: 'kid_2', name: 'מאיה', color: 'rose' },
  { id: 'kid_3', name: 'אורי', color: 'teal' },
  { id: 'kid_4', name: 'תמר', color: 'violet' },
  { id: 'kid_5', name: 'לביא', color: 'amber' },
  { id: 'kid_6', name: 'איילה', color: 'emerald' },
];

const FULL_DAY_WINDOWS = () => [
  { startMin: 8 * 60, endMin: 12 * 60 + 30 },
  { startMin: 14 * 60, endMin: 15 * 60 + 30 },
];

export function emptyWorkSchedule(): Record<
  DayKey,
  { startMin: number; endMin: number }[]
> {
  return {
    sun: [],
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
  };
}

export function createRecommendedProfessionals(): Professional[] {
  return [
    {
      id: 'prof_inbar',
      name: 'ענבר',
      profession: 'פיזיותרפיה',
      color: 'teal',
      workSchedule: {
        ...emptyWorkSchedule(),
        mon: FULL_DAY_WINDOWS(),
        tue: FULL_DAY_WINDOWS(),
        thu: FULL_DAY_WINDOWS(),
      },
      blockedSlots: [],
      weeklyQuotaOneOnOnePerKid: 2,
      weeklyQuotaGroupPerKid: 3,
      groupMode: 'all_together',
    },
    {
      id: 'prof_yael',
      name: 'יעל',
      profession: 'קלינאות תקשורת',
      color: 'violet',
      workSchedule: {
        ...emptyWorkSchedule(),
        sun: FULL_DAY_WINDOWS(),
        tue: [{ startMin: 8 * 60, endMin: 12 * 60 }],
        wed: FULL_DAY_WINDOWS(),
      },
      blockedSlots: [],
      weeklyQuotaOneOnOnePerKid: 2,
      weeklyQuotaGroupPerKid: 3,
      groupMode: 'all_together',
    },
    {
      id: 'prof_shirly',
      name: 'שירלי',
      profession: 'ניתוח התנהגות',
      color: 'amber',
      workSchedule: {
        ...emptyWorkSchedule(),
        sun: FULL_DAY_WINDOWS(),
        tue: FULL_DAY_WINDOWS(),
        thu: FULL_DAY_WINDOWS(),
      },
      blockedSlots: [],
      weeklyQuotaOneOnOnePerKid: 2,
      weeklyQuotaGroupPerKid: 3,
      groupMode: 'all_together',
    },
  ];
}

export function createOriginalBriefProfessionals(): Professional[] {
  return [
    {
      id: 'prof_inbar',
      name: 'ענבר',
      profession: 'פיזיותרפיה',
      color: 'teal',
      workSchedule: {
        ...emptyWorkSchedule(),
        mon: FULL_DAY_WINDOWS(),
        tue: FULL_DAY_WINDOWS(),
      },
      blockedSlots: [],
      weeklyQuotaOneOnOnePerKid: 2,
      weeklyQuotaGroupPerKid: 3,
      groupMode: 'all_together',
    },
    {
      id: 'prof_yael',
      name: 'יעל',
      profession: 'קלינאות תקשורת',
      color: 'violet',
      workSchedule: {
        ...emptyWorkSchedule(),
        sun: FULL_DAY_WINDOWS(),
        tue: [{ startMin: 8 * 60, endMin: 12 * 60 }],
      },
      blockedSlots: [],
      weeklyQuotaOneOnOnePerKid: 2,
      weeklyQuotaGroupPerKid: 3,
      groupMode: 'all_together',
    },
    {
      id: 'prof_shirly',
      name: 'שירלי',
      profession: 'ניתוח התנהגות',
      color: 'amber',
      workSchedule: {
        ...emptyWorkSchedule(),
        sun: FULL_DAY_WINDOWS(),
        tue: FULL_DAY_WINDOWS(),
      },
      blockedSlots: [],
      weeklyQuotaOneOnOnePerKid: 2,
      weeklyQuotaGroupPerKid: 3,
      groupMode: 'all_together',
    },
  ];
}

export function createInitialScheduleState(
  preset: 'recommended' | 'original' = 'recommended',
): ScheduleState {
  const professionals =
    preset === 'recommended'
      ? createRecommendedProfessionals()
      : createOriginalBriefProfessionals();
  const base: ScheduleState = {
    professionals,
    kids: DEFAULT_KIDS.map((k) => ({ ...k })),
    sessions: [],
    rules: structuredClone(DEFAULT_RULES),
    lastModifiedIso: new Date().toISOString(),
  };
  return generateSchedule(base).state;
}

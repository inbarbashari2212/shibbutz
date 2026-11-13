export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

export interface TimeWindow {
  startMin: number;
  endMin: number;
}

export interface BlockedSlot {
  id: string;
  day: DayKey;
  startMin: number;
  endMin: number;
  reason?: string;
}

export type ColorThemeKey =
  | 'teal'
  | 'violet'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'emerald';

export type GroupMode = 'all_together' | 'two_groups' | 'three_pairs';

export interface Professional {
  id: string;
  name: string;
  profession: string;
  color: ColorThemeKey;
  workSchedule: Record<DayKey, TimeWindow[]>;
  blockedSlots: BlockedSlot[];
  weeklyQuotaOneOnOnePerKid: number;
  weeklyQuotaGroupPerKid: number;
  groupMode: GroupMode;
}

export interface Kid {
  id: string;
  name: string;
  color: ColorThemeKey;
}

export type SessionType = 'one_on_one' | 'group';

export interface Session {
  id: string;
  professionalId: string;
  type: SessionType;
  kidIds: string[];
  groupLabel?: string;
  day: DayKey;
  startMin: number;
  endMin: number;
  notes?: string;
}

export interface ScheduleRules {
  kindergartenHours: Record<DayKey, TimeWindow | null>;
  sessionWindows: Record<DayKey, TimeWindow[]>;
  sessionDurationMin: number;
  standardBreakMin: number;
  allowConsecutiveOneOnOne: boolean;
  maxConsecutiveOneOnOne: number;
  breakAfterConsecutiveMin: number;
  allowConsecutiveEndOfWindow: boolean;
  preventSameDaySameProfOneOnOne: boolean;
  warnKidBackToBackDifferentProf: boolean;
}

export type SlotStatus = 'green' | 'yellow' | 'red';

export interface SlotEvaluation {
  status: SlotStatus;
  reasons: string[];
  warnings: string[];
  isConsecutivePair: boolean;
  consecutivePartnerIds: string[];
  requiredRecoveryBreak?: TimeWindow;
  kidTightTransitions: { kidId: string; otherSessionId: string; otherProfId: string }[];
}

export interface CandidateSlot {
  day: DayKey;
  startMin: number;
  endMin: number;
  isStandardHour: boolean;
  evaluation: SlotEvaluation;
}

export interface SwapSuggestion {
  targetSession: Session;
  movedEvaluation: SlotEvaluation;
  targetNewEvaluation: SlotEvaluation;
  combinedSeverity: 'green' | 'yellow';
}

export interface ScheduleState {
  professionals: Professional[];
  kids: Kid[];
  sessions: Session[];
  rules: ScheduleRules;
  lastModifiedIso: string;
}

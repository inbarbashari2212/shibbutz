import {
  CandidateSlot,
  DayKey,
  Kid,
  Professional,
  ScheduleRules,
  ScheduleState,
  Session,
  SlotEvaluation,
  SlotStatus,
  SwapSuggestion,
  TimeWindow,
} from '../types/schedule';
import {
  DAYS_ORDER,
  findContainingWindow,
  formatTime,
  intersectWindows,
  isContainedInWindows,
  rangesOverlap,
} from './timeUtils';

export type CandidateInput = Omit<Session, 'id'> & { id?: string };

function getActiveWindowsForProfDay(
  prof: Professional,
  day: DayKey,
  rules: ScheduleRules,
): TimeWindow[] {
  const kgHour = rules.kindergartenHours[day];
  if (!kgHour) return [];
  const kgIntersected = intersectWindows(rules.sessionWindows[day] ?? [], [kgHour]);
  return intersectWindows(prof.workSchedule[day] ?? [], kgIntersected);
}

export function evaluateSessionPlacement(
  state: ScheduleState,
  candidate: CandidateInput,
  ignoreSessionIds: string[] = [],
): SlotEvaluation {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let isConsecutivePair = false;
  let isDuplicate = false;
  const consecutivePartnerIds: string[] = [];
  let requiredRecoveryBreak: TimeWindow | undefined;
  const kidTightTransitions: {
    kidId: string;
    otherSessionId: string;
    otherProfId: string;
  }[] = [];

  const { rules } = state;
  const allowDuplicates = Boolean(rules.allowDuplicateBookings);
  const allowQuarterHours = rules.allowQuarterHourStarts ?? true;

  const prof = state.professionals.find((p) => p.id === candidate.professionalId);
  if (!prof) {
    return {
      status: 'red',
      reasons: ['המטפלת לא נמצאה במערכת'],
      warnings: [],
      isConsecutivePair: false,
      isDuplicate: false,
      consecutivePartnerIds: [],
      kidTightTransitions: [],
    };
  }

  const ignoreSet = new Set(ignoreSessionIds);
  const kgHour = rules.kindergartenHours[candidate.day];
  if (!kgHour || candidate.startMin < kgHour.startMin || candidate.endMin > kgHour.endMin) {
    reasons.push('מחוץ לשעות הפעילות של הגן ביום זה');
  } else if (!isContainedInWindows(candidate.startMin, candidate.endMin, rules.sessionWindows[candidate.day] ?? [])) {
    reasons.push('מחוץ לחלונות הזמן לטיפולים (למשל בזמן הפסקת צהריים)');
  }

  const activeWindows = getActiveWindowsForProfDay(prof, candidate.day, rules);
  const containingWindow = findContainingWindow(
    candidate.startMin,
    candidate.endMin,
    prof.workSchedule[candidate.day] ?? [],
  );
  if (!containingWindow) {
    reasons.push(`מחוץ לשעות העבודה של ${prof.name}`);
  }

  const blocked = prof.blockedSlots.find(
    (b) =>
      b.day === candidate.day &&
      rangesOverlap(candidate.startMin, candidate.endMin, b.startMin, b.endMin),
  );
  if (blocked) {
    reasons.push(
      blocked.reason
        ? `שעה חסומה אצל ${prof.name}: ${blocked.reason}`
        : `המשבצת סומנה כלא זמינה אצל ${prof.name}`,
    );
  }

  const otherSessionsOnDay = state.sessions.filter(
    (s) => s.day === candidate.day && !ignoreSet.has(s.id),
  );

  // Check therapist overlap
  const profOverlap = otherSessionsOnDay.find(
    (s) =>
      s.professionalId === candidate.professionalId &&
      rangesOverlap(candidate.startMin, candidate.endMin, s.startMin, s.endMin),
  );
  if (profOverlap) {
    isDuplicate = true;
    if (allowDuplicates) {
      warnings.push(
        `כפילות אצל ${prof.name}: שיבוץ חופף בשעה זו (${formatTime(profOverlap.startMin)}–${formatTime(profOverlap.endMin)})`,
      );
    } else {
      reasons.push(`ל${prof.name} כבר יש שיבוץ חופף בשעה זו`);
    }
  }

  // Check kid overlap + tight transitions across therapists
  const kidMap = new Map<string, Kid>(state.kids.map((k) => [k.id, k]));
  const overlappingKids = new Set<string>();

  for (const s of otherSessionsOnDay) {
    const sharedKids = candidate.kidIds.filter((kidId) => s.kidIds.includes(kidId));
    if (sharedKids.length === 0) continue;

    if (rangesOverlap(candidate.startMin, candidate.endMin, s.startMin, s.endMin)) {
      for (const kidId of sharedKids) {
        overlappingKids.add(kidMap.get(kidId)?.name ?? kidId);
      }
    } else if (s.professionalId !== candidate.professionalId) {
      const gap =
        s.endMin <= candidate.startMin
          ? candidate.startMin - s.endMin
          : candidate.endMin <= s.startMin
            ? s.startMin - candidate.endMin
            : Infinity;
      if (gap < rules.standardBreakMin) {
        for (const kidId of sharedKids) {
          kidTightTransitions.push({
            kidId,
            otherSessionId: s.id,
            otherProfId: s.professionalId,
          });
        }
      }
    }
  }

  if (overlappingKids.size > 0) {
    isDuplicate = true;
    if (allowDuplicates) {
      warnings.push(
        `כפילות בשעות עבור: ${Array.from(overlappingKids).join(', ')}`,
      );
    } else {
      reasons.push(`התנגשות בשעות עבור: ${Array.from(overlappingKids).join(', ')}`);
    }
  }

  if (kidTightTransitions.length > 0 && rules.warnKidBackToBackDifferentProf) {
    const names = Array.from(
      new Set(kidTightTransitions.map((t) => kidMap.get(t.kidId)?.name ?? t.kidId)),
    ).join(', ');
    warnings.push(`מעבר מיידי ללא הפסקה לילד/ה (${names}) מטיפול של מטפלת אחרת`);
  }

  // Same day same professional 1:1 rule
  if (candidate.type === 'one_on_one' && rules.preventSameDaySameProfOneOnOne) {
    const kidId = candidate.kidIds[0];
    const sameDaySameProf = otherSessionsOnDay.find(
      (s) =>
        s.professionalId === candidate.professionalId &&
        s.type === 'one_on_one' &&
        s.kidIds.includes(kidId),
    );
    if (sameDaySameProf) {
      isDuplicate = true;
      const kidName = kidMap.get(kidId)?.name ?? kidId;
      if (allowDuplicates) {
        warnings.push(
          `כפילות באותו יום: ל${kidName} כבר יש טיפול 1:1 נוסף עם ${prof.name} (${formatTime(sameDaySameProf.startMin)})`,
        );
      } else {
        reasons.push(
          `ל${kidName} כבר יש טיפול 1:1 עם ${prof.name} ביום זה (${formatTime(sameDaySameProf.startMin)})`,
        );
      }
    }
  }

  // Break and consecutive 1:1 streak analysis for this therapist on this day
  const profSessionsOnDay = otherSessionsOnDay
    .filter((s) => s.professionalId === candidate.professionalId)
    .map((s) => ({ ...s, isCandidate: false }));

  const candidateRecord = {
    ...candidate,
    id: candidate.id ?? '__candidate__',
    isCandidate: true,
  };

  if (!profOverlap) {
    const combined = [...profSessionsOnDay, candidateRecord].sort(
      (a, b) => a.startMin - b.startMin,
    );

    // Group into streaks where gap < standardBreakMin
    const streaks: (typeof combined)[] = [];
    for (const sess of combined) {
      const currentStreak = streaks[streaks.length - 1];
      if (!currentStreak) {
        streaks.push([sess]);
        continue;
      }
      const prev = currentStreak[currentStreak.length - 1];
      const gap = sess.startMin - prev.endMin;
      if (gap < rules.standardBreakMin) {
        currentStreak.push(sess);
      } else {
        streaks.push([sess]);
      }
    }

    for (let i = 0; i < streaks.length; i++) {
      const streak = streaks[i];
      const containsCandidate = streak.some((s) => s.isCandidate);
      const nextStreak = streaks[i + 1];
      const prevStreak = streaks[i - 1];
      const touchesCandidate =
        containsCandidate ||
        Boolean(nextStreak?.some((s) => s.isCandidate)) ||
        Boolean(prevStreak?.some((s) => s.isCandidate));

      if (streak.length >= 2 && touchesCandidate) {
        const hasGroup = streak.some((s) => s.type === 'group');
        if (hasGroup && containsCandidate) {
          reasons.push(
            `נדרשת הפסקת ${rules.standardBreakMin} דק׳ לפני ואחרי טיפול קבוצתי`,
          );
        } else if (!rules.allowConsecutiveOneOnOne && containsCandidate) {
          reasons.push('טיפולים פרטניים ברצף ללא הפסקה אינם מופעלים בהגדרות');
        } else if (streak.length > rules.maxConsecutiveOneOnOne && containsCandidate) {
          reasons.push(
            `לא ניתן לשבץ יותר מ-${rules.maxConsecutiveOneOnOne} טיפולי 1:1 ברצף`,
          );
        }

        // Check mandatory recovery break AFTER the consecutive streak
        const lastInStreak = streak[streak.length - 1];
        const nextSess = nextStreak?.[0];
        if (nextSess) {
          // Only enforce if in the same active window (if across lunch break, gap is naturally >= 90m)
          const gapAfterStreak = nextSess.startMin - lastInStreak.endMin;
          if (gapAfterStreak < rules.breakAfterConsecutiveMin) {
            reasons.push(
              `לאחר ${streak.length} טיפולי 1:1 ברצף נדרשת הפסקת ${rules.breakAfterConsecutiveMin} דק׳ (פנוי מ-${formatTime(lastInStreak.endMin + rules.breakAfterConsecutiveMin)})`,
            );
          }
        } else {
          // Last session in day/window — check if enough break remains in active window
          const win = findContainingWindow(
            lastInStreak.startMin,
            lastInStreak.endMin,
            activeWindows,
          );
          if (
            win &&
            win.endMin - lastInStreak.endMin < rules.breakAfterConsecutiveMin &&
            !rules.allowConsecutiveEndOfWindow &&
            containsCandidate
          ) {
            reasons.push(
              `נדרשת הפסקת ${rules.breakAfterConsecutiveMin} דק׳ לפני סיום חלון העבודה (${formatTime(win.endMin)})`,
            );
          }
        }

        if (
          containsCandidate &&
          !hasGroup &&
          rules.allowConsecutiveOneOnOne &&
          streak.length <= rules.maxConsecutiveOneOnOne
        ) {
          isConsecutivePair = true;
          for (const member of streak) {
            if (!member.isCandidate) {
              consecutivePartnerIds.push(member.id);
            }
          }
          const win = findContainingWindow(
            lastInStreak.startMin,
            lastInStreak.endMin,
            activeWindows,
          );
          const breakEnd = lastInStreak.endMin + rules.breakAfterConsecutiveMin;
          if (win && breakEnd <= win.endMin) {
            requiredRecoveryBreak = {
              startMin: lastInStreak.endMin,
              endMin: breakEnd,
            };
            warnings.push(
              `רצף של ${streak.length} טיפולי 1:1 ברצף — נדרשת הפסקת ${rules.breakAfterConsecutiveMin} דק׳ מ-${formatTime(lastInStreak.endMin)}`,
            );
          } else {
            warnings.push(
              `רצף של ${streak.length} טיפולי 1:1 ברצף (מסתיים ב-${formatTime(lastInStreak.endMin)} לפני הפסקה / סיום משמרת)`,
            );
          }
        }
      }
    }
  }

  if (!allowQuarterHours && candidate.startMin % 60 !== 0 && !isConsecutivePair) {
    reasons.push('יש לשבץ התחלה בשעה עגולה (XX:00) לפי ההגדרות');
  }

  let status: SlotStatus = 'green';
  if (reasons.length > 0) {
    status = 'red';
  } else if (warnings.length > 0) {
    status = 'yellow';
  }

  return {
    status,
    reasons,
    warnings,
    isConsecutivePair,
    isDuplicate,
    consecutivePartnerIds,
    requiredRecoveryBreak,
    kidTightTransitions,
  };
}

export function evaluateAllSessions(
  state: ScheduleState,
): Record<string, SlotEvaluation> {
  const result: Record<string, SlotEvaluation> = {};
  for (const session of state.sessions) {
    result[session.id] = evaluateSessionPlacement(state, session, [session.id]);
  }
  return result;
}

export function findCandidateSlots(
  state: ScheduleState,
  draft: Omit<Session, 'id' | 'day' | 'startMin' | 'endMin'>,
  options?: {
    ignoreSessionId?: string;
    includeRed?: boolean;
    onlyDay?: DayKey;
  },
): CandidateSlot[] {
  const prof = state.professionals.find((p) => p.id === draft.professionalId);
  if (!prof) return [];

  const duration = state.rules.sessionDurationMin;
  const stdBreak = state.rules.standardBreakMin;
  const recBreak = state.rules.breakAfterConsecutiveMin;
  const days = options?.onlyDay ? [options.onlyDay] : DAYS_ORDER;
  const ignoreIds = options?.ignoreSessionId ? [options.ignoreSessionId] : [];
  const results: CandidateSlot[] = [];

  for (const day of days) {
    const activeWindows = getActiveWindowsForProfDay(prof, day, state.rules);
    if (activeWindows.length === 0) continue;

    const existingOnDay = state.sessions.filter(
      (s) =>
        s.day === day &&
        s.professionalId === prof.id &&
        !ignoreIds.includes(s.id),
    );

    for (const win of activeWindows) {
      const startCandidates = new Set<number>();

      // Regular 15-min grid starts
      for (let t = win.startMin; t + duration <= win.endMin; t += 15) {
        startCandidates.add(t);
      }

      // Also include starts anchored to existing sessions (helpful if duration != 45)
      for (const s of existingOnDay) {
        const anchors = [
          s.endMin,
          s.endMin + stdBreak,
          s.endMin + recBreak,
          s.startMin - duration,
          s.startMin - duration - stdBreak,
        ];
        for (const a of anchors) {
          if (a >= win.startMin && a + duration <= win.endMin) {
            startCandidates.add(a);
          }
        }
      }

      const sortedStarts = Array.from(startCandidates).sort((a, b) => a - b);
      for (const startMin of sortedStarts) {
        const endMin = startMin + duration;
        const evaluation = evaluateSessionPlacement(
          state,
          {
            ...draft,
            id: options?.ignoreSessionId,
            day,
            startMin,
            endMin,
          },
          ignoreIds,
        );

        if (evaluation.status === 'red' && !options?.includeRed) continue;

        results.push({
          day,
          startMin,
          endMin,
          isStandardHour: startMin % 60 === 0,
          evaluation,
        });
      }
    }
  }

  const statusRank: Record<SlotStatus, number> = {
    green: 0,
    yellow: 1,
    red: 2,
  };

  return results.sort((a, b) => {
    if (statusRank[a.evaluation.status] !== statusRank[b.evaluation.status]) {
      return statusRank[a.evaluation.status] - statusRank[b.evaluation.status];
    }
    if (a.evaluation.status === 'green' && a.isStandardHour !== b.isStandardHour) {
      return a.isStandardHour ? -1 : 1;
    }
    const dayDiff = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.startMin - b.startMin;
  });
}

export function findSwapSuggestions(
  state: ScheduleState,
  sessionToMove: Session,
  limit = 6,
): SwapSuggestion[] {
  const suggestions: SwapSuggestion[] = [];

  for (const other of state.sessions) {
    if (other.id === sessionToMove.id) continue;
    // Prefer swapping within the same professional (most practical), or if same type
    if (other.professionalId !== sessionToMove.professionalId) continue;
    if (
      other.day === sessionToMove.day &&
      other.startMin === sessionToMove.startMin
    ) {
      continue;
    }

    const ignoreIds = [sessionToMove.id, other.id];
    // Simulate both placed simultaneously by creating a temporary swapped state
    const swappedSessions = state.sessions.map((s) => {
      if (s.id === sessionToMove.id) {
        return {
          ...s,
          day: other.day,
          startMin: other.startMin,
          endMin: other.startMin + (sessionToMove.endMin - sessionToMove.startMin),
        };
      }
      if (s.id === other.id) {
        return {
          ...s,
          day: sessionToMove.day,
          startMin: sessionToMove.startMin,
          endMin: sessionToMove.startMin + (other.endMin - other.startMin),
        };
      }
      return s;
    });

    const tempState: ScheduleState = { ...state, sessions: swappedSessions };
    const movedEval = evaluateSessionPlacement(
      tempState,
      swappedSessions.find((s) => s.id === sessionToMove.id)!,
      [sessionToMove.id],
    );
    const otherEval = evaluateSessionPlacement(
      tempState,
      swappedSessions.find((s) => s.id === other.id)!,
      [other.id],
    );

    if (movedEval.status !== 'red' && otherEval.status !== 'red') {
      const combinedSeverity =
        movedEval.status === 'green' && otherEval.status === 'green'
          ? 'green'
          : 'yellow';
      suggestions.push({
        targetSession: other,
        movedEvaluation: movedEval,
        targetNewEvaluation: otherEval,
        combinedSeverity,
      });
    }

    void ignoreIds;
  }

  return suggestions
    .sort((a, b) => {
      if (a.combinedSeverity !== b.combinedSeverity) {
        return a.combinedSeverity === 'green' ? -1 : 1;
      }
      const dayDiff =
        DAYS_ORDER.indexOf(a.targetSession.day) -
        DAYS_ORDER.indexOf(b.targetSession.day);
      if (dayDiff !== 0) return dayDiff;
      return a.targetSession.startMin - b.targetSession.startMin;
    })
    .slice(0, limit);
}

export interface KidProfQuota {
  kidId: string;
  profId: string;
  oneOnOneCount: number;
  oneOnOneTarget: number;
  groupCount: number;
  groupTarget: number;
}

export function computeQuotaReport(state: ScheduleState): KidProfQuota[] {
  const report: KidProfQuota[] = [];
  for (const kid of state.kids) {
    for (const prof of state.professionals) {
      const matching = state.sessions.filter(
        (s) => s.professionalId === prof.id && s.kidIds.includes(kid.id),
      );
      const oneOnOneCount = matching.filter((s) => s.type === 'one_on_one').length;
      const groupCount = matching.filter((s) => s.type === 'group').length;
      report.push({
        kidId: kid.id,
        profId: prof.id,
        oneOnOneCount,
        oneOnOneTarget: prof.weeklyQuotaOneOnOnePerKid,
        groupCount,
        groupTarget: prof.weeklyQuotaGroupPerKid,
      });
    }
  }
  return report;
}

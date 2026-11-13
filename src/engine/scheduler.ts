import {
  DayKey,
  GroupMode,
  Kid,
  Professional,
  ScheduleState,
  Session,
} from '../types/schedule';
import { createId, DAYS_ORDER } from '../engine/timeUtils';
import { evaluateAllSessions, findCandidateSlots } from '../engine/validator';

export interface PendingSessionSpec {
  professionalId: string;
  type: 'one_on_one' | 'group';
  kidIds: string[];
  groupLabel?: string;
}

function buildGroupBuckets(
  kids: Kid[],
  mode: GroupMode,
): { label: string; kidIds: string[] }[] {
  const ids = kids.map((k) => k.id);
  if (ids.length === 0) return [];
  if (mode === 'all_together') {
    return [{ label: `קבוצתי (כל ה-${ids.length})`, kidIds: ids }];
  }
  if (mode === 'two_groups') {
    const mid = Math.ceil(ids.length / 2);
    return [
      { label: 'קבוצה א׳', kidIds: ids.slice(0, mid) },
      { label: 'קבוצה ב׳', kidIds: ids.slice(mid) },
    ].filter((g) => g.kidIds.length > 0);
  }
  const pairs: { label: string; kidIds: string[] }[] = [];
  const letters = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳'];
  for (let i = 0; i < ids.length; i += 2) {
    const idx = Math.floor(i / 2);
    pairs.push({
      label: `זוג ${letters[idx] ?? idx + 1}`,
      kidIds: ids.slice(i, i + 2),
    });
  }
  return pairs;
}

function getProfTotalAvailableMinutes(prof: Professional): number {
  let total = 0;
  for (const day of DAYS_ORDER) {
    for (const w of prof.workSchedule[day] ?? []) {
      total += Math.max(0, w.endMin - w.startMin);
    }
  }
  return total;
}

function runSinglePass(
  baseState: ScheduleState,
  options: { keepExisting?: boolean; seedOffset: number },
): { state: ScheduleState; unplaced: PendingSessionSpec[] } {
  const state: ScheduleState = {
    ...baseState,
    sessions: options.keepExisting ? [...baseState.sessions] : [],
    lastModifiedIso: new Date().toISOString(),
  };

  const sortedProfs = [...state.professionals].sort(
    (a, b) => getProfTotalAvailableMinutes(a) - getProfTotalAvailableMinutes(b),
  );

  const pendingGroups: PendingSessionSpec[] = [];
  const pendingOneOnOneRounds: PendingSessionSpec[] = [];

  for (const prof of sortedProfs) {
    const buckets = buildGroupBuckets(state.kids, prof.groupMode);
    for (const bucket of buckets) {
      const existingCount = state.sessions.filter(
        (s) =>
          s.professionalId === prof.id &&
          s.type === 'group' &&
          bucket.kidIds.every((id) => s.kidIds.includes(id)),
      ).length;
      const needed = Math.max(0, prof.weeklyQuotaGroupPerKid - existingCount);
      for (let i = 0; i < needed; i++) {
        pendingGroups.push({
          professionalId: prof.id,
          type: 'group',
          kidIds: bucket.kidIds,
          groupLabel: bucket.label,
        });
      }
    }
  }

  // Round-robin 1:1 sessions across rounds and rotated kid order so tight therapists
  // distribute kids evenly across days before any day fills up
  const maxOneOnOne = Math.max(
    0,
    ...sortedProfs.map((p) => p.weeklyQuotaOneOnOnePerKid),
  );
  for (let round = 0; round < maxOneOnOne; round++) {
    for (const prof of sortedProfs) {
      if (round >= prof.weeklyQuotaOneOnOnePerKid) continue;
      const kidsRotated = state.kids.map(
        (_, i) => state.kids[(i + options.seedOffset) % state.kids.length],
      );
      for (const kid of kidsRotated) {
        const existingCount = state.sessions.filter(
          (s) =>
            s.professionalId === prof.id &&
            s.type === 'one_on_one' &&
            s.kidIds.includes(kid.id),
        ).length;
        const alreadyQueued = pendingOneOnOneRounds.filter(
          (p) => p.professionalId === prof.id && p.kidIds[0] === kid.id,
        ).length;
        if (existingCount + alreadyQueued < prof.weeklyQuotaOneOnOnePerKid) {
          pendingOneOnOneRounds.push({
            professionalId: prof.id,
            type: 'one_on_one',
            kidIds: [kid.id],
          });
        }
      }
    }
  }

  const unplaced: PendingSessionSpec[] = [];

  const placeSpec = (spec: PendingSessionSpec, stepIndex: number): boolean => {
    const candidates = findCandidateSlots(state, {
      professionalId: spec.professionalId,
      type: spec.type,
      kidIds: spec.kidIds,
      groupLabel: spec.groupLabel,
    });
    if (candidates.length === 0) return false;

    const profDayCounts = new Map<DayKey, number>();
    const profGroupDayCounts = new Map<DayKey, number>();
    const totalDayCounts = new Map<DayKey, number>();
    for (const s of state.sessions) {
      totalDayCounts.set(s.day, (totalDayCounts.get(s.day) ?? 0) + 1);
      if (s.professionalId === spec.professionalId) {
        profDayCounts.set(s.day, (profDayCounts.get(s.day) ?? 0) + 1);
        if (s.type === 'group') {
          profGroupDayCounts.set(s.day, (profGroupDayCounts.get(s.day) ?? 0) + 1);
        }
      }
    }

    const scored = candidates.map((c, idx) => {
      let score = 0;
      if (c.evaluation.status === 'green') score -= 1200;
      else if (c.evaluation.status === 'yellow') score += 450;

      if (c.isStandardHour) score -= 220;

      score += (profDayCounts.get(c.day) ?? 0) * 45;
      score += (totalDayCounts.get(c.day) ?? 0) * 10;

      if (spec.type === 'group') {
        // Avoid placing full/multi-kid groups at hours when other therapists also work
        const concurrentOtherProfs = state.professionals.filter(
          (p) =>
            p.id !== spec.professionalId &&
            (p.workSchedule[c.day] ?? []).some(
              (w) => c.startMin < w.endMin && w.startMin < c.endMin,
            ),
        ).length;
        score += concurrentOtherProfs * 240;
        score += (profGroupDayCounts.get(c.day) ?? 0) * 120;
        // Slightly prefer morning for groups unless afternoon avoids colliding with other therapists
        score += c.startMin < 750 ? -20 : 80;
      } else {
        // For 1:1 sessions, prefer hours where kids aren't tightly chained across therapists
        if (c.evaluation.kidTightTransitions.length > 0) score += 300;
      }
      if (c.evaluation.status === 'yellow' && c.startMin % 60 === 45) score -= 50;

      // Slight deterministic variety per seedOffset so retry passes explore different day pairings
      const tieBreak = ((idx + stepIndex + options.seedOffset * 7) % 13) * 0.5;
      return { c, score: score + tieBreak };
    });

    scored.sort((a, b) => a.score - b.score);
    const chosen = scored[0].c;

    const newSession: Session = {
      id: createId('sess'),
      professionalId: spec.professionalId,
      type: spec.type,
      kidIds: spec.kidIds,
      groupLabel: spec.groupLabel,
      day: chosen.day,
      startMin: chosen.startMin,
      endMin: chosen.endMin,
    };
    state.sessions.push(newSession);
    return true;
  };

  const tryRelocateAndPlace = (spec: PendingSessionSpec): boolean => {
    const sameProfSessions = state.sessions.filter(
      (s) => s.professionalId === spec.professionalId && s.type === 'one_on_one',
    );
    for (let i = 0; i < sameProfSessions.length; i++) {
      const existing = sameProfSessions[i];
      const idxInState = state.sessions.findIndex((s) => s.id === existing.id);
      if (idxInState === -1) continue;

      // Remove `existing` temporarily
      state.sessions.splice(idxInState, 1);

      const candidatesForSpec = findCandidateSlots(state, {
        professionalId: spec.professionalId,
        type: spec.type,
        kidIds: spec.kidIds,
        groupLabel: spec.groupLabel,
      });

      // Try placing spec into the freed slot (or any newly opened slot)
      const preferred = candidatesForSpec.find(
        (c) => c.day === existing.day && c.startMin === existing.startMin,
      ) ?? candidatesForSpec[0];

      if (preferred) {
        const placedSpec: Session = {
          id: createId('sess'),
          professionalId: spec.professionalId,
          type: spec.type,
          kidIds: spec.kidIds,
          groupLabel: spec.groupLabel,
          day: preferred.day,
          startMin: preferred.startMin,
          endMin: preferred.endMin,
        };
        state.sessions.push(placedSpec);

        const newHomeForExisting = findCandidateSlots(state, {
          professionalId: existing.professionalId,
          type: existing.type,
          kidIds: existing.kidIds,
          groupLabel: existing.groupLabel,
        });

        if (newHomeForExisting.length > 0) {
          const home = newHomeForExisting[0];
          state.sessions.push({
            ...existing,
            day: home.day,
            startMin: home.startMin,
            endMin: home.endMin,
          });
          return true;
        }
        // Rollback placedSpec
        state.sessions.pop();
      }

      // Rollback existing
      state.sessions.splice(idxInState, 0, existing);
    }
    return false;
  };

  let step = 0;
  for (const spec of pendingGroups) {
    if (!placeSpec(spec, step++)) {
      unplaced.push(spec);
    }
  }
  const deferredOneOnOne: PendingSessionSpec[] = [];
  for (const spec of pendingOneOnOneRounds) {
    if (!placeSpec(spec, step++)) {
      deferredOneOnOne.push(spec);
    }
  }
  for (const spec of deferredOneOnOne) {
    if (!placeSpec(spec, step++) && !tryRelocateAndPlace(spec)) {
      unplaced.push(spec);
    }
  }

  return { state, unplaced };
}

export interface AutoScheduleResult {
  state: ScheduleState;
  unplaced: PendingSessionSpec[];
}

export function generateSchedule(
  baseState: ScheduleState,
  options?: { keepExisting?: boolean },
): AutoScheduleResult {
  let best: AutoScheduleResult | null = null;
  let bestYellowCount = Infinity;

  const attempts = Math.max(6, baseState.kids.length * 2);
  for (let seedOffset = 0; seedOffset < attempts; seedOffset++) {
    const attempt = runSinglePass(baseState, {
      keepExisting: options?.keepExisting,
      seedOffset,
    });
    const evals = evaluateAllSessions(attempt.state);
    const yellowCount = Object.values(evals).filter(
      (e) => e.status === 'yellow',
    ).length;

    if (
      !best ||
      attempt.unplaced.length < best.unplaced.length ||
      (attempt.unplaced.length === best.unplaced.length &&
        yellowCount < bestYellowCount)
    ) {
      best = attempt;
      bestYellowCount = yellowCount;
    }

    if (attempt.unplaced.length === 0 && yellowCount <= 2) {
      break;
    }
  }

  return best!;
}

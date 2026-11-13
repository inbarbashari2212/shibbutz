import { describe, expect, it } from 'vitest';
import {
  createInitialScheduleState,
  DEFAULT_KIDS,
  DEFAULT_RULES,
  emptyWorkSchedule,
} from '../../data/presets';
import { ScheduleState, Session } from '../../types/schedule';
import {
  computeQuotaReport,
  evaluateAllSessions,
  evaluateSessionPlacement,
  findCandidateSlots,
  findSwapSuggestions,
} from '../validator';
import { generateSchedule } from '../scheduler';

function makeMinimalState(): ScheduleState {
  return {
    kids: DEFAULT_KIDS.map((k) => ({ ...k })),
    professionals: [
      {
        id: 'prof_inbar',
        name: 'ענבר',
        profession: 'פיזיותרפיה',
        color: 'teal',
        workSchedule: {
          ...emptyWorkSchedule(),
          mon: [
            { startMin: 480, endMin: 750 },
            { startMin: 840, endMin: 930 },
          ],
          tue: [
            { startMin: 480, endMin: 750 },
            { startMin: 840, endMin: 930 },
          ],
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
          mon: [{ startMin: 480, endMin: 750 }],
        },
        blockedSlots: [],
        weeklyQuotaOneOnOnePerKid: 2,
        weeklyQuotaGroupPerKid: 3,
        groupMode: 'all_together',
      },
    ],
    sessions: [],
    rules: structuredClone(DEFAULT_RULES),
    lastModifiedIso: '2026-11-13T00:00:00.000Z',
  };
}

describe('Schedule validation and auto-scheduler', () => {
  it('generates a complete conflict-free recommended schedule meeting all quotas', () => {
    const state = createInitialScheduleState('recommended');
    // 3 professionals * (12 one-on-one + 3 group) = 45 sessions
    expect(state.sessions.length).toBe(45);

    const evals = evaluateAllSessions(state);
    const reds = Object.values(evals).filter((e) => e.status === 'red');
    expect(reds).toHaveLength(0);

    const quotas = computeQuotaReport(state);
    for (const q of quotas) {
      expect(q.oneOnOneCount).toBe(2);
      expect(q.groupCount).toBe(3);
    }
  });

  it('blocks placing two 1:1 sessions with the same therapist for the same kid on the same day', () => {
    const state = makeMinimalState();
    state.sessions.push({
      id: 's1',
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_1'],
      day: 'mon',
      startMin: 480,
      endMin: 525,
    });

    const evalSameDay = evaluateSessionPlacement(state, {
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_1'],
      day: 'mon',
      startMin: 540,
      endMin: 585,
    });
    expect(evalSameDay.status).toBe('red');

    const evalOtherDay = evaluateSessionPlacement(state, {
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_1'],
      day: 'tue',
      startMin: 540,
      endMin: 585,
    });
    expect(evalOtherDay.status).toBe('green');
  });

  it('handles yellow double 1:1 rule and enforces 30-min recovery break afterwards', () => {
    const state = makeMinimalState();
    state.sessions.push({
      id: 's1',
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_1'],
      day: 'mon',
      startMin: 480, // 08:00
      endMin: 525, // 08:45
    });

    // 08:45 - 09:30 immediately after -> YELLOW warning
    const secondConsecutive = evaluateSessionPlacement(state, {
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_2'],
      day: 'mon',
      startMin: 525, // 08:45
      endMin: 570, // 09:30
    });
    expect(secondConsecutive.status).toBe('yellow');
    expect(secondConsecutive.isConsecutivePair).toBe(true);
    expect(secondConsecutive.requiredRecoveryBreak).toEqual({
      startMin: 570,
      endMin: 600,
    });

    // Place the second consecutive session
    state.sessions.push({
      id: 's2',
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_2'],
      day: 'mon',
      startMin: 525,
      endMin: 570,
    });

    // 3rd consecutive at 09:30 - 10:15 -> RED
    const thirdConsecutive = evaluateSessionPlacement(state, {
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_3'],
      day: 'mon',
      startMin: 570,
      endMin: 615,
    });
    expect(thirdConsecutive.status).toBe('red');

    // Only 15-min break (09:45 - 10:30) -> RED (requires 30-min break!)
    const shortBreakAfterPair = evaluateSessionPlacement(state, {
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_3'],
      day: 'mon',
      startMin: 585, // 09:45
      endMin: 630, // 10:30
    });
    expect(shortBreakAfterPair.status).toBe('red');

    // 30-min break (10:00 - 10:45) -> GREEN
    const fullBreakAfterPair = evaluateSessionPlacement(state, {
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_3'],
      day: 'mon',
      startMin: 600, // 10:00
      endMin: 645, // 10:45
    });
    expect(fullBreakAfterPair.status).toBe('green');

    // Group session cannot be consecutive without 15-min break
    const groupBackToBack = evaluateSessionPlacement(
      { ...state, sessions: [state.sessions[0]] },
      {
        professionalId: 'prof_inbar',
        type: 'group',
        kidIds: ['kid_1', 'kid_2', 'kid_3'],
        day: 'mon',
        startMin: 525,
        endMin: 570,
      },
    );
    expect(groupBackToBack.status).toBe('red');

    // Disabling consecutive 1:1 in settings makes 08:45-09:30 RED
    const disabledState: ScheduleState = {
      ...state,
      sessions: [state.sessions[0]],
      rules: { ...state.rules, allowConsecutiveOneOnOne: false },
    };
    const evalDisabled = evaluateSessionPlacement(disabledState, {
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_2'],
      day: 'mon',
      startMin: 525,
      endMin: 570,
    });
    expect(evalDisabled.status).toBe('red');
  });

  it('respects therapist blocked slots and cross-therapist kid conflicts', () => {
    const state = makeMinimalState();
    state.professionals[0].blockedSlots.push({
      id: 'b1',
      day: 'mon',
      startMin: 480,
      endMin: 525,
      reason: 'ישיבת צוות',
    });
    state.sessions.push({
      id: 'yael_1',
      professionalId: 'prof_yael',
      type: 'one_on_one',
      kidIds: ['kid_1'],
      day: 'mon',
      startMin: 540,
      endMin: 585,
    });

    const candidates = findCandidateSlots(state, {
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_1'],
    });
    // Mon 08:00 blocked by blockedSlots, Mon 09:00 blocked by Yael having kid_1
    expect(
      candidates.some((c) => c.day === 'mon' && c.startMin === 480),
    ).toBe(false);
    expect(
      candidates.some((c) => c.day === 'mon' && c.startMin === 540),
    ).toBe(false);
    expect(
      candidates.some((c) => c.day === 'mon' && c.startMin === 600),
    ).toBe(true);
  });

  it('suggests valid session swaps', () => {
    const state = makeMinimalState();
    const s1: Session = {
      id: 's1',
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_1'],
      day: 'mon',
      startMin: 480,
      endMin: 525,
    };
    const s2: Session = {
      id: 's2',
      professionalId: 'prof_inbar',
      type: 'one_on_one',
      kidIds: ['kid_2'],
      day: 'tue',
      startMin: 480,
      endMin: 525,
    };
    state.sessions.push(s1, s2);
    const swaps = findSwapSuggestions(state, s1);
    expect(swaps).toHaveLength(1);
    expect(swaps[0].targetSession.id).toBe('s2');
    expect(swaps[0].combinedSeverity).toBe('green');
  });

  it('supports two_groups mode when auto-scheduling with yellow consecutive slots', () => {
    const base = createInitialScheduleState('recommended');
    const twoGroupState: ScheduleState = {
      ...base,
      professionals: base.professionals.map((p) => ({
        ...p,
        groupMode: 'two_groups',
      })),
    };
    const res = generateSchedule(twoGroupState);
    expect(res.unplaced).toHaveLength(0);
    // 3 profs * (12 one-on-one + 6 group) = 54 sessions
    expect(res.state.sessions).toHaveLength(54);
    const evals = evaluateAllSessions(res.state);
    expect(Object.values(evals).filter((e) => e.status === 'red')).toHaveLength(0);
  });
});

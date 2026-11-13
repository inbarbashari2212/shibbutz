import { describe, expect, it } from 'vitest';
import { createInitialScheduleState } from '../../data/presets';
import {
  decodeScheduleFromHash,
  encodeScheduleToShareUrl,
} from '../share';

describe('Share URL encoding & decoding', () => {
  it('roundtrips a complete schedule state cleanly through compressed URL hash', () => {
    const original = createInitialScheduleState('recommended');
    const url = encodeScheduleToShareUrl(original, 'https://example.github.io/shibbutz/');
    const hash = new URL(url).hash;
    const decoded = decodeScheduleFromHash(hash);

    expect(decoded).not.toBeNull();
    expect(decoded!.sessions).toHaveLength(original.sessions.length);
    expect(decoded!.professionals.map((p) => p.name)).toEqual(
      original.professionals.map((p) => p.name),
    );
    expect(decoded!.rules.allowConsecutiveOneOnOne).toBe(true);
  });

  it('returns null on invalid or malformed hash', () => {
    expect(decodeScheduleFromHash('')).toBeNull();
    expect(decodeScheduleFromHash('#s=invalid_garbage')).toBeNull();
  });
});

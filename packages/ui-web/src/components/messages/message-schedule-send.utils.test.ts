import { describe, expect, it } from 'vitest';
import {
  buildScheduleSendAt,
  getDefaultScheduleDraft,
  isScheduleDraftInFuture,
  resolveBrowserTimezone,
} from './message-schedule-send.utils';

describe('message-schedule-send.utils', () => {
  describe('buildScheduleSendAt', () => {
    it('returns null when date is missing', () => {
      expect(buildScheduleSendAt({ date: '', time: '10:00' })).toBeNull();
    });

    it('returns null when time is missing', () => {
      expect(buildScheduleSendAt({ date: '2026-01-01', time: '' })).toBeNull();
    });

    it('returns null for an unparsable draft', () => {
      expect(buildScheduleSendAt({ date: 'not-a-date', time: '99:99' })).toBeNull();
    });

    it('builds an absolute ISO timestamp from local date + time', () => {
      const sendAt = buildScheduleSendAt({ date: '2026-03-15', time: '14:30' });
      expect(sendAt).not.toBeNull();
      const parsed = new Date(sendAt as string);
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(2); // March, 0-indexed
      expect(parsed.getDate()).toBe(15);
      expect(parsed.getHours()).toBe(14);
      expect(parsed.getMinutes()).toBe(30);
    });
  });

  describe('isScheduleDraftInFuture', () => {
    it('is true for a draft after "now"', () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      expect(isScheduleDraftInFuture({ date: '2026-01-02', time: '00:00' }, now)).toBe(
        true,
      );
    });

    it('is false for a draft at or before "now"', () => {
      const now = new Date('2026-06-01T12:00:00.000Z');
      expect(isScheduleDraftInFuture({ date: '2026-01-01', time: '00:00' }, now)).toBe(
        false,
      );
    });

    it('is false for an incomplete draft', () => {
      expect(isScheduleDraftInFuture({ date: '', time: '' })).toBe(false);
    });
  });

  describe('getDefaultScheduleDraft', () => {
    it('defaults to one hour from now', () => {
      const now = new Date('2026-01-01T10:15:00.000Z');
      const draft = getDefaultScheduleDraft(now);
      const sendAt = buildScheduleSendAt(draft);
      expect(sendAt).not.toBeNull();
      // The draft is expressed in local wall-clock time, so just assert it
      // resolves to exactly one hour after `now` in that same local zone.
      const expected = new Date(now.getTime() + 60 * 60 * 1000);
      expect(new Date(sendAt as string).getHours()).toBe(expected.getHours());
      expect(new Date(sendAt as string).getMinutes()).toBe(expected.getMinutes());
    });
  });

  describe('resolveBrowserTimezone', () => {
    it('returns a non-empty timezone string', () => {
      expect(resolveBrowserTimezone().length).toBeGreaterThan(0);
    });
  });
});

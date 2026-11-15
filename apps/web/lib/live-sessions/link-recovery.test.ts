import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  readMeetingLink,
  writeMeetingLink,
  clearMeetingLink,
  newRedemptionKey,
  type MeetingLinkRecovery,
} from './link-recovery';
describe('tab-scoped meeting recovery', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());
  const value = (): MeetingLinkRecovery => ({
    token: 'a'.repeat(32),
    redemptionKey: 'b'.repeat(32),
    personal: true,
    handoff: false,
    expiresAt: Date.now() + 60000,
  });
  it('isolates meetings and clears an explicit leave', () => {
    writeMeetingLink('one', value());
    expect(readMeetingLink('one')?.personal).toBe(true);
    expect(readMeetingLink('two')).toBeNull();
    clearMeetingLink('one');
    expect(readMeetingLink('one')).toBeNull();
  });
  it('discards expired and malformed storage', () => {
    writeMeetingLink('one', { ...value(), expiresAt: Date.now() - 1 });
    expect(readMeetingLink('one')).toBeNull();
    sessionStorage.setItem('iconicedu:meeting-link:one', 'invalid json');
    expect(readMeetingLink('one')).toBeNull();
  });
  it('remains optional when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    expect(() => writeMeetingLink('one', value())).not.toThrow();
    expect(readMeetingLink('one')).toBeNull();
  });
  it('uses distinct cryptographic browser retry secrets', () => {
    const first = newRedemptionKey();
    expect(first).toMatch(/^[\w-]{32}$/);
    expect(newRedemptionKey()).not.toBe(first);
  });
});

import { describe, expect, it } from 'vitest';

import { getNotificationPolicyConfig } from './policy-config';

describe('getNotificationPolicyConfig', () => {
  it('marks dm.posted as near-real-time with a 30s delay', () => {
    const config = getNotificationPolicyConfig('dm.posted');

    expect(config.critical).toBe(false);
    expect(config.digestEligible).toBe(false);
    expect(config.defaultDelaySeconds).toBe(30);
  });

  it('marks dms.posted as near-real-time with a 30s delay', () => {
    const config = getNotificationPolicyConfig('dms.posted');

    expect(config.critical).toBe(false);
    expect(config.digestEligible).toBe(false);
    expect(config.defaultDelaySeconds).toBe(30);
  });

  it('keeps message.posted digest-eligible with a 120s delay', () => {
    const config = getNotificationPolicyConfig('message.posted');

    expect(config.critical).toBe(false);
    expect(config.digestEligible).toBe(true);
    expect(config.defaultDelaySeconds).toBe(120);
  });

  it('keeps class.session.scheduled critical with immediate delivery', () => {
    const config = getNotificationPolicyConfig('class.session.scheduled');

    expect(config.critical).toBe(true);
    expect(config.digestEligible).toBe(false);
    expect(config.defaultDelaySeconds).toBe(0);
  });

  it('defaults unknown keys to non-digest with a 120s delay', () => {
    const config = getNotificationPolicyConfig('unknown.key');

    expect(config.critical).toBe(false);
    expect(config.digestEligible).toBe(false);
    expect(config.defaultDelaySeconds).toBe(120);
  });
});

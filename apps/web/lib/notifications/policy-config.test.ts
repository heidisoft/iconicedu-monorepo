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

  it('marks dm.reaction.added as near-real-time with a 30s delay', () => {
    const config = getNotificationPolicyConfig('dm.reaction.added');

    expect(config.critical).toBe(false);
    expect(config.digestEligible).toBe(false);
    expect(config.defaultDelaySeconds).toBe(30);
  });

  it('uses a standard 60s delay for message.posted', () => {
    const config = getNotificationPolicyConfig('message.posted');

    expect(config.critical).toBe(false);
    expect(config.digestEligible).toBe(false);
    expect(config.defaultDelaySeconds).toBe(60);
  });

  it('uses a standard 60s delay for reaction.added', () => {
    const config = getNotificationPolicyConfig('reaction.added');

    expect(config.critical).toBe(false);
    expect(config.digestEligible).toBe(false);
    expect(config.defaultDelaySeconds).toBe(60);
  });

  it('uses a standard 60s delay for file.uploaded', () => {
    const config = getNotificationPolicyConfig('file.uploaded');

    expect(config.critical).toBe(false);
    expect(config.digestEligible).toBe(false);
    expect(config.defaultDelaySeconds).toBe(60);
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

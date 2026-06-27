import { resolveUnviewedMessageAlertThresholdHours } from '@iconicedu/api/lib/messages/unviewed-message-alert-config';

describe('resolveUnviewedMessageAlertThresholdHours', () => {
  it('defaults to 1 hour when unset or invalid', () => {
    expect(resolveUnviewedMessageAlertThresholdHours(undefined)).toBe(1);
    expect(resolveUnviewedMessageAlertThresholdHours('')).toBe(1);
    expect(resolveUnviewedMessageAlertThresholdHours('nope')).toBe(1);
    expect(resolveUnviewedMessageAlertThresholdHours('0')).toBe(1);
  });

  it('uses a positive configured hour value', () => {
    expect(resolveUnviewedMessageAlertThresholdHours('6')).toBe(6);
  });

  it('rounds fractional values up to the next hour', () => {
    expect(resolveUnviewedMessageAlertThresholdHours('2.25')).toBe(3);
  });

  it('caps very large values at one week', () => {
    expect(resolveUnviewedMessageAlertThresholdHours('999')).toBe(168);
  });
});

import { isVersionAtLeast } from './version-compare';

describe('isVersionAtLeast', () => {
  it('returns true when current equals minimum', () => {
    expect(isVersionAtLeast('1.2.3', '1.2.3')).toBe(true);
  });

  it('returns true when current is greater at the patch level', () => {
    expect(isVersionAtLeast('1.2.4', '1.2.3')).toBe(true);
  });

  it('returns false when current is behind at the patch level', () => {
    expect(isVersionAtLeast('1.2.2', '1.2.3')).toBe(false);
  });

  it('returns false when current is behind at the minor level even with a higher patch', () => {
    expect(isVersionAtLeast('1.1.99', '1.2.0')).toBe(false);
  });

  it('returns true when current is ahead at the major level', () => {
    expect(isVersionAtLeast('2.0.0', '1.9.9')).toBe(true);
  });

  it('treats missing trailing segments as zero', () => {
    expect(isVersionAtLeast('1.2', '1.2.0')).toBe(true);
    expect(isVersionAtLeast('1.2', '1.2.1')).toBe(false);
  });

  it('treats non-numeric segments as zero rather than throwing', () => {
    expect(isVersionAtLeast('1.2.x', '1.2.0')).toBe(true);
  });
});

import { SETTINGS_TABS } from './index';

describe('user settings constants', () => {
  it('defines tabs with icon components', () => {
    expect(SETTINGS_TABS.length).toBeGreaterThan(0);
    expect(SETTINGS_TABS.every((tab) => Boolean(tab.icon))).toBe(true);
  });
});

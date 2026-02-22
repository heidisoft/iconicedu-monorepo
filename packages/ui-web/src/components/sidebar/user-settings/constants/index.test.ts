import { SETTINGS_TABS, SOFT_ACCENT_PICK_BUTTON_CLASSNAME } from './index';

describe('user settings constants', () => {
  it('defines tabs with icon components', () => {
    expect(SETTINGS_TABS.length).toBeGreaterThan(0);
    expect(SETTINGS_TABS.every((tab) => Boolean(tab.icon))).toBe(true);
  });

  it('defines a shared soft accent style for helper pick buttons', () => {
    expect(SOFT_ACCENT_PICK_BUTTON_CLASSNAME).toContain('bg-primary/5');
    expect(SOFT_ACCENT_PICK_BUTTON_CLASSNAME).toContain('hover:bg-primary/10');
  });
});

import { describe, expect, it } from 'vitest';

import {
  USER_SETTINGS_DIALOG_SURFACE_CLASS,
  USER_SETTINGS_DRAWER_SURFACE_CLASS,
  USER_SETTINGS_SECTION_ICON_CLASS,
  USER_SETTINGS_SECTION_SURFACE_CLASS,
  USER_SETTINGS_TAB_TRIGGER_CLASS,
} from './user-settings.theme';

describe('user settings dark-mode theme classes', () => {
  it('keeps dialog and drawer surfaces dark-mode aware', () => {
    expect(USER_SETTINGS_DIALOG_SURFACE_CLASS).toContain('dark:bg-zinc-950');
    expect(USER_SETTINGS_DIALOG_SURFACE_CLASS).toContain('dark:border-white/15');
    expect(USER_SETTINGS_DRAWER_SURFACE_CLASS).toContain('dark:bg-zinc-950');
    expect(USER_SETTINGS_DRAWER_SURFACE_CLASS).toContain('dark:border-white/15');
  });

  it('keeps tab trigger contrast in dark mode', () => {
    expect(USER_SETTINGS_TAB_TRIGGER_CLASS).toContain(
      'dark:data-[state=active]:bg-zinc-800',
    );
    expect(USER_SETTINGS_TAB_TRIGGER_CLASS).toContain(
      'dark:data-[state=inactive]:text-zinc-300',
    );
  });

  it('keeps section surfaces and icon badges visible in dark mode', () => {
    expect(USER_SETTINGS_SECTION_SURFACE_CLASS).toContain('dark:bg-zinc-900/60');
    expect(USER_SETTINGS_SECTION_SURFACE_CLASS).toContain('dark:border-white/10');
    expect(USER_SETTINGS_SECTION_ICON_CLASS).toContain('dark:bg-zinc-800/90');
    expect(USER_SETTINGS_SECTION_ICON_CLASS).toContain('dark:border-white/15');
  });
});

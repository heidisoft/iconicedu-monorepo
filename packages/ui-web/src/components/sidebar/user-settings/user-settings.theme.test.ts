import { describe, expect, it } from 'vitest';

import {
  USER_SETTINGS_DIALOG_SURFACE_CLASS,
  USER_SETTINGS_DRAWER_SURFACE_CLASS,
  USER_SETTINGS_SECTION_ICON_CLASS,
  USER_SETTINGS_SECTION_SURFACE_CLASS,
  USER_SETTINGS_TAB_TRIGGER_CLASS,
} from './user-settings.theme';

describe('user settings theme classes', () => {
  it('drives dialog and drawer surfaces from theme tokens', () => {
    expect(USER_SETTINGS_DIALOG_SURFACE_CLASS).toContain('bg-popover');
    expect(USER_SETTINGS_DIALOG_SURFACE_CLASS).toContain('text-popover-foreground');
    expect(USER_SETTINGS_DRAWER_SURFACE_CLASS).toContain('bg-popover');
    expect(USER_SETTINGS_DIALOG_SURFACE_CLASS).not.toContain('zinc-');
    expect(USER_SETTINGS_DRAWER_SURFACE_CLASS).not.toContain('zinc-');
  });

  it('keeps tab trigger contrast via tokens', () => {
    expect(USER_SETTINGS_TAB_TRIGGER_CLASS).toContain(
      'data-[state=active]:text-foreground',
    );
    expect(USER_SETTINGS_TAB_TRIGGER_CLASS).toContain(
      'data-[state=inactive]:text-muted-foreground',
    );
    expect(USER_SETTINGS_TAB_TRIGGER_CLASS).not.toContain('zinc-');
  });

  it('keeps section surfaces and icon badges token-driven', () => {
    expect(USER_SETTINGS_SECTION_SURFACE_CLASS).toContain('bg-card/70');
    expect(USER_SETTINGS_SECTION_ICON_CLASS).toContain('bg-muted/40');
    expect(USER_SETTINGS_SECTION_SURFACE_CLASS).not.toContain('zinc-');
    expect(USER_SETTINGS_SECTION_ICON_CLASS).not.toContain('zinc-');
  });
});

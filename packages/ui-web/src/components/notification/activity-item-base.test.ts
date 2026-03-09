import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ActivityItemBase read behavior', () => {
  const filename = fileURLToPath(import.meta.url);
  const source = readFileSync(
    resolve(dirname(filename), 'activity-item-base.tsx'),
    'utf8',
  );

  it('uses a delayed auto-read timeout when an activity is viewed', () => {
    expect(source).toContain('const AUTO_READ_VIEW_DELAY_MS = 2000;');
    expect(source).toContain('}, AUTO_READ_VIEW_DELAY_MS);');
  });

  it('animates icon color change and shows a read indicator', () => {
    expect(source).toContain('transition-colors duration-300 ease-out');
    expect(source).toContain("const UNREAD_ICON_CLASS = 'bg-sky-100 text-sky-700';");
    expect(source).toContain('const iconColorClass = activity.state?.isRead');
    expect(source).toContain('CheckCheck');
    expect(source).toContain('showParentReadIndicator');
    expect(source).toContain('aria-label="Read"');
  });
});

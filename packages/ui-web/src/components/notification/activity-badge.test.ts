import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('ActivityBadge avatar sizing', () => {
  const filename = fileURLToPath(import.meta.url);
  const source = readFileSync(resolve(dirname(filename), 'activity-badge.tsx'), 'utf8');

  it('uses the shared avatar size class for grouped and actor avatars', () => {
    expect(source).toContain("const ACTIVITY_AVATAR_SIZE_CLASS = 'size-6';");
    expect(source).toContain('const MAX_VISIBLE_ACTIVITY_AVATARS = 3;');
    expect(source).toContain('const avatars = leading.avatars.slice(');
    expect(source).toContain('MAX_VISIBLE_ACTIVITY_AVATARS');
    expect(source).toContain('enableProfilePreview={false}');
    expect(source).toContain('sizeClassName={ACTIVITY_AVATAR_SIZE_CLASS}');
    expect(source).toContain(
      "sizeClassName={cn(ACTIVITY_AVATAR_SIZE_CLASS, 'shrink-0', className)}",
    );
  });
});

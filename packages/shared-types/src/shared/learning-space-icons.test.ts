import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LEARNING_SPACE_ICON_KEY,
  LEARNING_SPACE_ICON_KEYS,
  LEARNING_SPACE_ICON_OPTIONS,
  isLearningSpaceIconKey,
} from './learning-space-icons';

describe('learning-space-icons', () => {
  it('keeps the default icon in the shared key list', () => {
    expect(LEARNING_SPACE_ICON_KEYS).toContain(DEFAULT_LEARNING_SPACE_ICON_KEY);
  });

  it('keeps the option values aligned with the shared key list', () => {
    expect(LEARNING_SPACE_ICON_OPTIONS.map((option) => option.value)).toEqual(
      LEARNING_SPACE_ICON_KEYS,
    );
  });

  it('validates known and unknown icon keys', () => {
    expect(isLearningSpaceIconKey('sparkles')).toBe(true);
    expect(isLearningSpaceIconKey('book-open')).toBe(false);
  });
});

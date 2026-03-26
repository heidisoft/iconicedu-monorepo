import {
  DEFAULT_LEARNING_SPACE_ICON_KEY,
  type LearningSpaceIconKey,
} from '@iconicedu/shared-types';

import {
  MOBILE_LEARNING_SPACE_ICON_MAP,
  getLearningSpaceIcon,
  resolveLearningSpaceIconKey,
} from './learning-space-icons';

describe('learning-space-icons', () => {
  it('returns the provided key when it is part of the shared web/mobile set', () => {
    expect(resolveLearningSpaceIconKey('square-pi')).toBe('square-pi');
  });

  it('falls back to the shared default for unknown keys', () => {
    expect(resolveLearningSpaceIconKey('book-open')).toBe(
      DEFAULT_LEARNING_SPACE_ICON_KEY,
    );
    expect(resolveLearningSpaceIconKey(null)).toBe(DEFAULT_LEARNING_SPACE_ICON_KEY);
  });

  it('returns the matching native icon component for a valid key', () => {
    const key: LearningSpaceIconKey = 'map';

    expect(getLearningSpaceIcon(key)).toBe(MOBILE_LEARNING_SPACE_ICON_MAP[key]);
  });
});

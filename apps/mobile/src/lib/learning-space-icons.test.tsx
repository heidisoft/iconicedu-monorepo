import {
  DEFAULT_CHANNEL_TOPIC_ICON_KEY,
  DEFAULT_LEARNING_SPACE_ICON_KEY,
  type KnownChannelTopicIconKey,
  type LearningSpaceIconKey,
} from '@iconicedu/shared-types';

import {
  MOBILE_CHANNEL_TOPIC_ICON_MAP,
  MOBILE_LEARNING_SPACE_ICON_MAP,
  getChannelTopicIcon,
  getLearningSpaceIcon,
  resolveChannelTopicIconKey,
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

  it('resolves built-in channel topic icons from the shared web/mobile key set', () => {
    expect(resolveChannelTopicIconKey('life-buoy')).toBe('life-buoy');
    expect(resolveChannelTopicIconKey('book-open')).toBe('book-open');
  });

  it('normalizes legacy support icon keys to the shared support icon', () => {
    expect(resolveChannelTopicIconKey('support')).toBe('life-buoy');
  });

  it('falls back to the shared channel default for unknown channel keys', () => {
    expect(resolveChannelTopicIconKey('unknown-icon')).toBe(
      DEFAULT_CHANNEL_TOPIC_ICON_KEY,
    );
  });

  it('returns the matching native icon component for a valid channel key', () => {
    const key: KnownChannelTopicIconKey = 'megaphone';

    expect(getChannelTopicIcon(key)).toBe(MOBILE_CHANNEL_TOPIC_ICON_MAP[key]);
  });
});

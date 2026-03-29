import { describe, expect, it } from 'vitest';

import {
  CHANNEL_TOPIC_ICON_GROUPS,
  CHANNEL_TOPIC_ICON_KEYS,
  CHANNEL_TOPIC_ICON_OPTIONS,
  DEFAULT_CHANNEL_TOPIC_ICON_KEY,
  isKnownChannelTopicIconKey,
} from './channel-icons';
import { LEARNING_SPACE_ICON_KEYS } from './learning-space-icons';

describe('channel-icons', () => {
  it('keeps the default icon in the shared key list', () => {
    expect(CHANNEL_TOPIC_ICON_KEYS).toContain(DEFAULT_CHANNEL_TOPIC_ICON_KEY);
  });

  it('includes the learning-space icon set for channel topics', () => {
    for (const iconKey of LEARNING_SPACE_ICON_KEYS) {
      expect(CHANNEL_TOPIC_ICON_KEYS).toContain(iconKey);
    }
  });

  it('keeps the grouped options aligned with the flattened option list', () => {
    expect(CHANNEL_TOPIC_ICON_GROUPS.flatMap((group) => group.options)).toEqual(
      CHANNEL_TOPIC_ICON_OPTIONS,
    );
  });

  it('validates known and unknown icon keys', () => {
    expect(isKnownChannelTopicIconKey('life-buoy')).toBe(true);
    expect(isKnownChannelTopicIconKey('rocket')).toBe(false);
  });
});

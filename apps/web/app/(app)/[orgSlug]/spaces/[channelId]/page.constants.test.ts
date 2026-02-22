import { describe, expect, it } from 'vitest';

import { LEARNING_SPACE_MESSAGES_SECTION_TITLE } from '@iconicedu/web/app/(app)/[orgSlug]/spaces/[channelId]/page.constants';

describe('learning space page constants', () => {
  it('uses Messages as the learning space message section title', () => {
    expect(LEARNING_SPACE_MESSAGES_SECTION_TITLE).toBe('Messages');
  });
});


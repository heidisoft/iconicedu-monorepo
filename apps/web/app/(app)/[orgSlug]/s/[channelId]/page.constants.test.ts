import { describe, expect, it } from 'vitest';

import { LEARNING_SPACE_MESSAGES_SECTION_TITLE } from '@iconicedu/web/app/(app)/[orgSlug]/s/[channelId]/page.constants';

describe('class page constants', () => {
  it('uses Messages as the class message section title', () => {
    expect(LEARNING_SPACE_MESSAGES_SECTION_TITLE).toBe('Messages');
  });
});

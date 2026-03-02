import { describe, expect, it } from 'vitest';

import { VideoParticipant } from '@iconicedu/web/components/live-sessions/video-participant';

describe('VideoParticipant', () => {
  it('exports a renderable component', () => {
    expect(VideoParticipant).toBeTypeOf('function');
  });
});

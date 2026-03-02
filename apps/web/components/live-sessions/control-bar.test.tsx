import { describe, expect, it } from 'vitest';

import { ControlBar } from '@iconicedu/web/components/live-sessions/control-bar';

describe('ControlBar', () => {
  it('exports a renderable component', () => {
    expect(ControlBar).toBeTypeOf('function');
  });
});

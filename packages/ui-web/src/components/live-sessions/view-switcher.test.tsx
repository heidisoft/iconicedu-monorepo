import { describe, expect, it } from 'vitest';

import { ViewSwitcher } from '@iconicedu/ui-web/components/live-sessions/view-switcher';

describe('ViewSwitcher', () => {
  it('exports a renderable component', () => {
    expect(ViewSwitcher).toBeTypeOf('function');
  });
});

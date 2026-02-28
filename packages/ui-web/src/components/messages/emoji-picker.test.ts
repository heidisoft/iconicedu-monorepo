import { describe, expect, it } from 'vitest';

import { EMOJI_PICKER_POPOVER_PROPS } from './emoji-picker';

describe('emoji-picker config', () => {
  it('centers the popover on the trigger button', () => {
    expect(EMOJI_PICKER_POPOVER_PROPS).toEqual({
      align: 'center',
      side: 'bottom',
      sideOffset: 10,
    });
  });
});

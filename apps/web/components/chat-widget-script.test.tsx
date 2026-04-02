import { describe, expect, it } from 'vitest';

import { ChatWidgetScript } from './chat-widget-script';

describe('ChatWidgetScript', () => {
  it('exports a renderable component', () => {
    expect(ChatWidgetScript).toBeTypeOf('function');
  });
});

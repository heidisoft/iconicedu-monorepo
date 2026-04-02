import { describe, expect, it } from 'vitest';

import { getMarketingChatWidget } from './chat-widget';

describe('chat widget config', () => {
  it('returns the active marketing chat widget definition', () => {
    expect(getMarketingChatWidget()).toEqual({
      provider: 'tawk',
      scriptId: 'tawk-chat',
      strategy: 'afterInteractive',
      inlineScript: expect.stringContaining(
        'https://embed.tawk.to/69ce37e8b8aa781c3b30f2c2/1jl6okpif',
      ),
    });
  });

  it('keeps provider-specific bootstrap details isolated behind the registry', () => {
    const widget = getMarketingChatWidget('tawk');

    expect(widget.inlineScript).toContain(
      'var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();',
    );
    expect(widget.inlineScript).toContain('s1.setAttribute("crossorigin", "*");');
  });
});

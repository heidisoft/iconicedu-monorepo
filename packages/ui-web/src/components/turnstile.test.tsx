// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Turnstile } from './turnstile';

describe('Turnstile', () => {
  afterEach(() => {
    document.getElementById('cloudflare-turnstile-script')?.remove();
    delete (window as typeof window & { turnstile?: unknown }).turnstile;
  });

  it('loads and renders the widget, then reports token changes', () => {
    const onTokenChange = vi.fn();
    const renderWidget = vi.fn((_container, options) => {
      options.callback('verified-token');
      return 'widget-id';
    });
    (window as typeof window & { turnstile?: unknown }).turnstile = {
      render: renderWidget,
      reset: vi.fn(),
    };

    render(<Turnstile siteKey="site-key" onTokenChange={onTokenChange} />);
    const script = document.getElementById('cloudflare-turnstile-script');
    expect(script).toHaveAttribute(
      'src',
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    );

    fireEvent.load(script as HTMLScriptElement);

    expect(
      screen.getByLabelText('Cloudflare Turnstile verification'),
    ).toBeInTheDocument();
    expect(renderWidget).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ sitekey: 'site-key' }),
    );
    expect(onTokenChange).toHaveBeenCalledWith('verified-token');
  });
});

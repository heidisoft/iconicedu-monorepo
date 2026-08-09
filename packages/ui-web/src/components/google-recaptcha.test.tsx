// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GoogleRecaptcha } from './google-recaptcha';

describe('GoogleRecaptcha', () => {
  afterEach(() => {
    document.getElementById('google-recaptcha-script')?.remove();
    delete (window as typeof window & { grecaptcha?: unknown }).grecaptcha;
  });

  it('loads and renders the widget, then reports token changes', () => {
    const onTokenChange = vi.fn();
    const renderWidget = vi.fn((_container, options) => {
      options.callback('verified-token');
      return 7;
    });
    (window as typeof window & { grecaptcha?: unknown }).grecaptcha = {
      render: renderWidget,
      reset: vi.fn(),
    };

    render(<GoogleRecaptcha siteKey="site-key" onTokenChange={onTokenChange} />);
    const script = document.getElementById('google-recaptcha-script');
    expect(script).toHaveAttribute(
      'src',
      'https://www.google.com/recaptcha/api.js?render=explicit',
    );

    fireEvent.load(script as HTMLScriptElement);

    expect(screen.getByLabelText('reCAPTCHA verification')).toBeInTheDocument();
    expect(renderWidget).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ sitekey: 'site-key' }),
    );
    expect(onTokenChange).toHaveBeenCalledWith('verified-token');
  });
});

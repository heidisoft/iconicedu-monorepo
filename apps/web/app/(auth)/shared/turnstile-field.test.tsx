// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@marsidev/react-turnstile', async () => {
  const react = await import('react');
  return {
    Turnstile: react.forwardRef(function MockTurnstile(
      props: { siteKey: string },
      _ref: unknown,
    ) {
      return react.createElement('div', {
        'data-testid': 'cf-turnstile',
        'data-sitekey': props.siteKey,
      });
    }),
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadWithSiteKey(value: string) {
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', value);
  vi.resetModules();
  return import('./turnstile-field');
}

describe('turnstile-field', () => {
  it('renders nothing and reports unconfigured without a site key', async () => {
    const { TurnstileField, isTurnstileConfigured } = await loadWithSiteKey('');

    expect(isTurnstileConfigured()).toBe(false);

    const { container } = render(<TurnstileField onTokenChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the widget with the site key when configured', async () => {
    const { TurnstileField, isTurnstileConfigured } = await loadWithSiteKey(
      '1x00000000000000000000AA',
    );

    expect(isTurnstileConfigured()).toBe(true);

    const { getByTestId } = render(<TurnstileField onTokenChange={vi.fn()} />);
    expect(getByTestId('cf-turnstile').getAttribute('data-sitekey')).toBe(
      '1x00000000000000000000AA',
    );
  });

  it('reset() clears the token through onTokenChange', async () => {
    const { TurnstileField } = await loadWithSiteKey('1x00000000000000000000AA');

    const onTokenChange = vi.fn();
    const ref = React.createRef<{ reset: () => void }>();
    render(<TurnstileField ref={ref} onTokenChange={onTokenChange} />);

    ref.current?.reset();
    expect(onTokenChange).toHaveBeenCalledWith(null);
  });
});

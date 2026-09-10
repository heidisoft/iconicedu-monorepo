import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import { TurnstileWebView, isTurnstileConfigured } from './turnstile-webview';

// react-native-webview is mocked globally in jest.setup.js as a View passthrough,
// so onMessage / props are forwarded onto the rendered element.

const SITE_KEY_ENV = 'EXPO_PUBLIC_TURNSTILE_SITE_KEY';

afterEach(() => {
  delete process.env[SITE_KEY_ENV];
});

describe('TurnstileWebView', () => {
  it('renders nothing and reports unconfigured without a site key', () => {
    delete process.env[SITE_KEY_ENV];
    expect(isTurnstileConfigured()).toBe(false);

    const onToken = jest.fn();
    render(<TurnstileWebView onToken={onToken} />);
    expect(screen.queryByTestId('turnstile-webview')).toBeNull();
    expect(onToken).not.toHaveBeenCalled();
  });

  it('forwards the token from a token: message', () => {
    process.env[SITE_KEY_ENV] = '1x00000000000000000000AA';
    expect(isTurnstileConfigured()).toBe(true);

    const onToken = jest.fn();
    render(<TurnstileWebView onToken={onToken} />);

    const webview = screen.getByTestId('turnstile-webview', {
      includeHiddenElements: true,
    });
    act(() => {
      webview.props.onMessage({ nativeEvent: { data: 'token:cf-token-123' } });
    });

    expect(onToken).toHaveBeenCalledWith('cf-token-123');
  });

  it('clears the token on expiry / error messages', () => {
    process.env[SITE_KEY_ENV] = '1x00000000000000000000AA';

    const onToken = jest.fn();
    render(<TurnstileWebView onToken={onToken} />);
    const webview = screen.getByTestId('turnstile-webview', {
      includeHiddenElements: true,
    });

    act(() => {
      webview.props.onMessage({ nativeEvent: { data: 'expired' } });
    });
    expect(onToken).toHaveBeenLastCalledWith(null);

    act(() => {
      webview.props.onMessage({ nativeEvent: { data: 'error' } });
    });
    expect(onToken).toHaveBeenLastCalledWith(null);
  });
});

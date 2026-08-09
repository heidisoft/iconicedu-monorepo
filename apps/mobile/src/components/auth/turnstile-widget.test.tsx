import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { TurnstileWidget } from './turnstile-widget';

describe('TurnstileWidget', () => {
  it('reports a verified token from the hosted widget', () => {
    const onTokenChange = jest.fn();
    const { getByLabelText } = render(
      <TurnstileWidget
        siteKey="site-key"
        baseUrl="https://app.example.com"
        onTokenChange={onTokenChange}
      />,
    );

    fireEvent(
      getByLabelText('Cloudflare Turnstile verification').children[0],
      'message',
      {
        nativeEvent: { data: JSON.stringify({ token: 'verified-token' }) },
      },
    );

    expect(onTokenChange).toHaveBeenCalledWith('verified-token');
  });
});

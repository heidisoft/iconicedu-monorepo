import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReferralAppOptions } from './app-options';
const code = 'a'.repeat(48);
afterEach(() => vi.restoreAllMocks());
it('opens the invitation in the app without losing its opaque code and uses country-neutral store links', () => {
  render(<ReferralAppOptions code={code} />);
  expect(screen.getByRole('link', { name: 'Open app and continue' })).toHaveAttribute(
    'href',
    `iconicedu://r/${code}`,
  );
  expect(screen.getByRole('link', { name: 'Download for iPhone' })).toHaveAttribute(
    'href',
    'https://apps.apple.com/app/iconic-academy/id6762158186',
  );
  expect(screen.getByRole('link', { name: 'Download for Android' })).toHaveAttribute(
    'href',
    'https://play.google.com/store/apps/details?id=com.heidisoft.iconicedu',
  );
  expect(screen.getByText(/return to this invitation/)).toBeTruthy();
});
it('provides an explicit copy action as the post-install fallback', async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: copy },
  });
  render(<ReferralAppOptions code={code} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy invitation code' }));
  await waitFor(() => expect(screen.getByText('Invitation code copied.')).toBeTruthy());
  expect(copy).toHaveBeenCalledWith(code);
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExternalLiveSessionJoinDialog } from './external-live-session-join-dialog';

describe('ready-to-join session dialog', () => {
  it('keeps the source on the Open action and copies only the shared URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(
      <ExternalLiveSessionJoinDialog
        target={{
          joinHref: 'https://app.invalid/live/demo?returnTo=%2Facademy#invite=synthetic',
          copyHref: 'https://app.invalid/live/demo#invite=synthetic',
          providerLabel: 'Zoom',
          isInternal: true,
        }}
        onOpenChange={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Session ready to join' })).toBeVisible();
    const link = screen.getByRole('link', { name: 'Open Zoom' });
    expect(link).toHaveAttribute(
      'href',
      'https://app.invalid/live/demo?returnTo=%2Facademy#invite=synthetic',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText(/Open the session when you are ready/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'https://app.invalid/live/demo#invite=synthetic',
      ),
    );
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeVisible();
  });
  it('shows and copies the passcode separately without changing the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(
      <ExternalLiveSessionJoinDialog
        target={{
          joinHref: 'https://app.invalid/live/a3f8-b2d4-c9e1',
          providerLabel: 'Zoom',
          passcode: 'class-secret',
        }}
        onOpenChange={() => undefined}
      />,
    );
    expect(screen.getByText('class-secret')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Copy passcode' })).toHaveTextContent('');
    fireEvent.click(screen.getByRole('button', { name: 'Copy passcode' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('class-secret'));
    expect(await screen.findByRole('button', { name: 'Passcode copied' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith(
        'https://app.invalid/live/a3f8-b2d4-c9e1',
      ),
    );
    expect(screen.getByRole('link', { name: 'Open Zoom' })).toHaveAttribute(
      'href',
      'https://app.invalid/live/a3f8-b2d4-c9e1',
    );
  });
  it('offers manual copying if copying the passcode fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
    });
    render(
      <ExternalLiveSessionJoinDialog
        target={{
          joinHref: 'https://app.invalid/live/demo',
          providerLabel: 'Zoom',
          passcode: 'class-secret',
        }}
        onOpenChange={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy passcode' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('copy it manually');
    expect(screen.getByText('class-secret')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Passcode copied' }),
    ).not.toBeInTheDocument();
  });
  it('preserves the original external-provider explanation', () => {
    render(
      <ExternalLiveSessionJoinDialog
        target={{ joinHref: 'https://zoom.us/j/123', providerLabel: 'Zoom' }}
        onOpenChange={() => undefined}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Copy passcode' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/This session opens in an external provider/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Zoom' })).toHaveAttribute(
      'href',
      'https://zoom.us/j/123',
    );
  });
});

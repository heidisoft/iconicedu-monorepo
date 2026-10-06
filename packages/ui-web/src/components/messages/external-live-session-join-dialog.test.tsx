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
          joinHref: 'https://app.invalid/live/demo?passcode=class&returnTo=%2Facademy',
          copyHref: 'https://app.invalid/live/demo?passcode=class',
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
      'https://app.invalid/live/demo?passcode=class&returnTo=%2Facademy',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText(/check your camera and microphone/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'https://app.invalid/live/demo?passcode=class',
      ),
    );
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeVisible();
  });
  it('preserves the original external-provider explanation', () => {
    render(
      <ExternalLiveSessionJoinDialog
        target={{ joinHref: 'https://zoom.us/j/123', providerLabel: 'Zoom' }}
        onOpenChange={() => undefined}
      />,
    );
    expect(screen.getByText(/This session opens in an external provider/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Zoom' })).toHaveAttribute(
      'href',
      'https://zoom.us/j/123',
    );
  });
});

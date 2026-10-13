import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ZoomShareMeetingDialog } from './zoom-share-meeting-dialog';

const writeText = vi.fn();

describe('ZoomShareMeetingDialog', () => {
  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    window.history.replaceState({}, '', '/live/test-session?token=private#fragment');
  });

  it('copies the short locator and keeps the passcode separate', async () => {
    render(
      <ZoomShareMeetingDialog
        meetingTitle="Science"
        meetingPasscode="secret"
        sharePath="/live/a3f8-b2d4-c9e1"
        sessionId="full-session-id"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Share meeting link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy join link' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/live/a3f8-b2d4-c9e1`,
      ),
    );
    expect(writeText.mock.calls[0][0]).not.toContain('secret');
  });

  it('shares the public landing URL from an authenticated meeting route', async () => {
    window.history.replaceState({}, '', '/academy/live-sessions/full-session-id');
    render(<ZoomShareMeetingDialog meetingTitle="Science" sessionId="full-session-id" />);
    fireEvent.click(screen.getByRole('button', { name: 'Share meeting link' }));
    expect(screen.getByLabelText('Meeting join link')).toHaveValue(
      `${window.location.origin}/live/full-session-id`,
    );
  });

  it('shows the join details and copies a query-free invitation with the passcode', async () => {
    render(
      <ZoomShareMeetingDialog meetingTitle="Science class" meetingPasscode="class-123" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share meeting link' }));
    expect(screen.getByRole('heading', { name: 'Share meeting link' })).toBeVisible();

    expect(screen.getByLabelText('Meeting join link')).toHaveValue(
      `${window.location.origin}/live/test-session`,
    );
    expect(screen.getByLabelText('Meeting passcode')).toHaveValue('class-123');

    fireEvent.click(screen.getByRole('button', { name: 'Copy invitation' }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `Science class\nJoin link: ${window.location.origin}/live/test-session\nPasscode: class-123`,
      ),
    );
    expect(screen.getByText('Invitation copied')).toBeVisible();
  });
  it('copies the join link and passcode independently', async () => {
    render(
      <ZoomShareMeetingDialog meetingTitle="Science class" meetingPasscode="class-123" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Share meeting link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy passcode' }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('class-123'));
    expect(screen.queryByText('Invitation copied')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy join link' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith(
        `${window.location.origin}/live/test-session`,
      ),
    );
  });
  it('disables copying when the passcode is unavailable', () => {
    render(<ZoomShareMeetingDialog meetingTitle="Science class" />);
    fireEvent.click(screen.getByRole('button', { name: 'Share meeting link' }));
    expect(screen.getByRole('button', { name: 'Copy passcode' })).toBeDisabled();
    expect(screen.getByLabelText('Meeting passcode')).toHaveValue('Not available');
  });
  it('shows feedback when copying the passcode fails', async () => {
    writeText.mockRejectedValue(new Error('Clipboard unavailable'));
    render(
      <ZoomShareMeetingDialog meetingTitle="Science class" meetingPasscode="class-123" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Share meeting link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy passcode' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The details couldn't be copied",
    );
    expect(screen.getByRole('button', { name: 'Copy invitation' })).toBeVisible();
  });
});

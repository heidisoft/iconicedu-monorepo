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
});

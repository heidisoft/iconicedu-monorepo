import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomMeetingNotice } from './zoom-meeting-notice';

describe('ZoomMeetingNotice', () => {
  it('renders a warning with consistent actions', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onAction = vi.fn();

    render(
      <TooltipProvider>
        <ZoomMeetingNotice
          message="This session is being recorded"
          tone="warning"
          onDismiss={onDismiss}
          action={{ label: 'Review', onClick: onAction }}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('being recorded');
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

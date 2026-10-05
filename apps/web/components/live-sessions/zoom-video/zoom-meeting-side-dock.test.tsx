import { render, screen } from '@testing-library/react';
import { MessageSquare, Users } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { ZoomMeetingDockButton, ZoomMeetingSideDock } from './zoom-meeting-side-dock';

describe('ZoomMeetingSideDock', () => {
  it('renders extensible dock actions with their counts', () => {
    render(
      <ZoomMeetingSideDock>
        <ZoomMeetingDockButton label="Participants" count={12} active={false}>
          <Users />
        </ZoomMeetingDockButton>
        <ZoomMeetingDockButton label="Messages" count={5} active attention>
          <MessageSquare />
        </ZoomMeetingDockButton>
      </ZoomMeetingSideDock>,
    );

    expect(screen.getByRole('button', { name: 'Participants' })).toHaveTextContent('12');
    expect(screen.getByRole('button', { name: 'Messages' })).toHaveTextContent('5');
  });
});

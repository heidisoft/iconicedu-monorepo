import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecordingStatus } from '@zoom/videosdk';

import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomMeetingHeader } from './zoom-meeting-header';

describe('ZoomMeetingHeader', () => {
  it('shows class identity and attendance', () => {
    render(
      <TooltipProvider>
        <ZoomMeetingHeader
          title="Algebra tutoring"
          participantCount={2}
          recordingStatus={RecordingStatus.Stopped}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText('Algebra tutoring')).toBeInTheDocument();
    expect(screen.getByText('2 Attendees')).toBeInTheDocument();
  });

  it('shows active recording state', () => {
    render(
      <TooltipProvider>
        <ZoomMeetingHeader
          title="Live class"
          participantCount={1}
          recordingStatus={RecordingStatus.Recording}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText('Recording')).toBeInTheDocument();
  });
});

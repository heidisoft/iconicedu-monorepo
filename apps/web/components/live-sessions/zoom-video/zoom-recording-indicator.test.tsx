import { RecordingStatus } from '@zoom/videosdk';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ZoomRecordingIndicator } from './zoom-recording-indicator';

describe('ZoomRecordingIndicator', () => {
  it('tracks active and paused recording states', () => {
    const view = render(<ZoomRecordingIndicator status={RecordingStatus.Recording} />);

    expect(
      screen.getByRole('status', { name: 'Recording in progress' }),
    ).toHaveTextContent('Recording');

    view.rerender(<ZoomRecordingIndicator status={RecordingStatus.Paused} />);
    expect(screen.getByRole('status', { name: 'Recording paused' })).toHaveTextContent(
      'Paused',
    );
  });

  it('keeps the recording status visible while recording is stopped', () => {
    render(<ZoomRecordingIndicator status={RecordingStatus.Stopped} />);

    expect(screen.getByRole('status', { name: 'Not recording' })).toHaveTextContent(
      'Record',
    );
  });
});

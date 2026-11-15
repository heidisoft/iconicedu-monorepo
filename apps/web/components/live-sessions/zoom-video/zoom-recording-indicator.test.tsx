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

    expect(
      screen
        .getByRole('status', { name: 'Recording in progress' })
        .querySelector('.bg-destructive'),
    ).not.toBeNull();
    view.rerender(<ZoomRecordingIndicator status={RecordingStatus.Paused} />);
    expect(screen.getByRole('status', { name: 'Recording paused' })).toHaveTextContent(
      'Paused',
    );
  });

  it.each([RecordingStatus.Stopped, null])(
    'shows the recording label with a neutral dot when inactive (%s)',
    (status) => {
      const { container } = render(<ZoomRecordingIndicator status={status} />);

      expect(screen.getByRole('status', { name: 'Not recording' })).toHaveTextContent(
        'Recording',
      );
      expect(container.querySelector('[aria-hidden="true"]')).toHaveClass(
        'bg-muted-foreground/60',
      );
    },
  );
});

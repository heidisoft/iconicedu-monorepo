import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CLASSROOM_PRIMARY_CONTROL_ORDER } from '@iconicedu/shared-types';
import { MeetingControlButton } from './zoom-meeting-controls';
describe('shared classroom control order', () => {
  it('keeps media, presentation, invite, More and leave in the same relative order as native', () => {
    const labels = [
      'Mute microphone',
      'Stop camera',
      'Share screen',
      'Start whiteboard',
      'More controls',
      'Leave class',
    ];
    render(
      <>
        {labels.map((label) => (
          <MeetingControlButton key={label} label={label}>
            <span />
          </MeetingControlButton>
        ))}
      </>,
    );
    expect(labels).toHaveLength(CLASSROOM_PRIMARY_CONTROL_ORDER.length);
    labels.forEach((label, index) =>
      expect(screen.getByRole('button', { name: label })).toHaveStyle({
        order: String(index),
      }),
    );
  });
});

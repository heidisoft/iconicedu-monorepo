import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ControlBar } from '@iconicedu/web/components/live-sessions/control-bar';

describe('ControlBar', () => {
  it('exports a renderable component', () => {
    expect(ControlBar).toBeTypeOf('function');
  });
});

it('keeps the microphone control usable while showing the shared speaking animation', () => {
  const onToggleMute = vi.fn();
  render(
    <ControlBar
      meetingName="Class"
      isMuted={false}
      isSpeaking
      isVideoOn={false}
      isSharing={false}
      onToggleMute={onToggleMute}
      onToggleVideo={vi.fn()}
      onToggleShare={vi.fn()}
      onToggleParticipants={vi.fn()}
      onToggleSettings={vi.fn()}
      onToggleRaiseHand={vi.fn()}
      onEndCall={vi.fn()}
    />,
  );
  const microphone = screen.getByTitle('Mute');
  expect(microphone.querySelector('[data-audio-indicator]')).toHaveAttribute(
    'data-speaking',
    'true',
  );
  fireEvent.click(microphone);
  expect(onToggleMute).toHaveBeenCalledOnce();
});

import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { VideoParticipant } from './video-participant';

it('uses shared audio feedback in Daily tiles, holding short pauses but stopping on mute', () => {
  vi.useFakeTimers();
  try {
    const tile = (speaking: boolean, muted = false) => (
      <VideoParticipant
        name="Alex"
        isActive={speaking}
        isSpeaking={speaking}
        isMuted={muted}
      />
    );
    const { rerender, unmount } = render(tile(true));
    expect(
      screen.getByLabelText('Alex is speaking').querySelector('[data-audio-indicator]'),
    ).toHaveAttribute('data-speaking', 'true');
    rerender(tile(false));
    act(() => vi.advanceTimersByTime(1799));
    expect(screen.getByLabelText('Alex is speaking')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByLabelText('Microphone on')).toBeInTheDocument();
    rerender(tile(true, true));
    expect(screen.queryByLabelText('Alex is speaking')).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Microphone off').querySelector('[data-audio-indicator]'),
    ).toHaveAttribute('data-speaking', 'false');
    unmount();
  } finally {
    vi.useRealTimers();
  }
});

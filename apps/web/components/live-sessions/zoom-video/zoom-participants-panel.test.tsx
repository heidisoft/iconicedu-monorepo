import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomParticipantsPanel } from './zoom-participants-panel';

describe('ZoomParticipantsPanel', () => {
  it('uses the same microphone animation in the list and suppresses it when muted', () => {
    const participant = {
      userId: 1,
      name: 'Alex',
      isYou: true,
      isHost: true,
      muted: false,
      videoOn: true,
      handRaised: false,
      isSpeaking: true,
    };
    const panel = (muted: boolean) => (
      <TooltipProvider>
        <ZoomParticipantsPanel
          open
          canMuteOthers={false}
          participants={[{ ...participant, muted }]}
          onOpenChange={vi.fn()}
          onMute={vi.fn()}
        />
      </TooltipProvider>
    );
    const { rerender } = render(panel(false));
    const speaking = screen.getByLabelText('Alex is speaking');
    expect(speaking.querySelector('[data-audio-indicator]')).toHaveAttribute(
      'data-speaking',
      'true',
    );
    rerender(panel(true));
    expect(screen.queryByLabelText('Alex is speaking')).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('Microphone off').querySelector('[data-audio-indicator]'),
    ).toHaveAttribute('data-speaking', 'false');
  });
  it('shows the participant count on its meeting control', () => {
    render(
      <TooltipProvider>
        <ZoomParticipantsPanel
          open={false}
          canMuteOthers={false}
          participants={[
            {
              userId: 1,
              name: 'Alex Rivera',
              isYou: true,
              isHost: true,
              muted: false,
              videoOn: true,
              handRaised: false,
              isSpeaking: true,
            },
            {
              userId: 2,
              name: 'Sam Lee',
              isYou: false,
              isHost: false,
              muted: true,
              videoOn: false,
              handRaised: false,
              isSpeaking: false,
            },
          ]}
          onOpenChange={vi.fn()}
          onMute={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole('button', { name: 'Participants' })).toHaveTextContent('2');
  });
  it('shows a remote participant hand and emoji reaction in the list', () => {
    const participant = {
      userId: 42,
      name: 'Sam Lee',
      isYou: false,
      isHost: false,
      muted: false,
      videoOn: false,
      handRaised: true,
      isSpeaking: false,
      reaction: '🎉',
    };
    const view = render(
      <TooltipProvider>
        <ZoomParticipantsPanel
          open
          canMuteOthers={false}
          participants={[participant]}
          onOpenChange={vi.fn()}
          onMute={vi.fn()}
        />
      </TooltipProvider>,
    );
    expect(screen.getByLabelText('Sam Lee raised their hand')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Sam Lee reacted 🎉' })).toBeInTheDocument();
    view.rerender(
      <TooltipProvider>
        <ZoomParticipantsPanel
          open
          canMuteOthers={false}
          participants={[{ ...participant, handRaised: false, reaction: undefined }]}
          onOpenChange={vi.fn()}
          onMute={vi.fn()}
        />
      </TooltipProvider>,
    );
    expect(screen.queryByLabelText('Sam Lee raised their hand')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'Sam Lee reacted 🎉' }),
    ).not.toBeInTheDocument();
  });
});

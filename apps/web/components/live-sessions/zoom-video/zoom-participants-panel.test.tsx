import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomParticipantsPanel } from './zoom-participants-panel';

describe('ZoomParticipantsPanel', () => {
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
});

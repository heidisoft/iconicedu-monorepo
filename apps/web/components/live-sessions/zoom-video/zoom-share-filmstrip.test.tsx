import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomShareFilmstrip } from './zoom-share-filmstrip';

describe('ZoomShareFilmstrip', () => {
  it('renders all participants in compact landscape tiles', () => {
    const { container } = render(
      <TooltipProvider>
        <ZoomShareFilmstrip
          displayName="Alex Rivera"
          selfMuted={false}
          selfVideoOn
          selfHandRaised={false}
          selfVideoRef={createRef<HTMLDivElement>()}
          remoteParticipants={[
            {
              userId: 2,
              displayName: 'Sam Lee',
              muted: true,
              bVideoOn: false,
              isHost: false,
            },
          ]}
          raisedHandUserIds={new Set([2])}
          activeSpeakerUserId={2}
          selfUserId={1}
          sidebarOpen={false}
          onRemoteContainer={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByLabelText('Meeting participants')).toBeInTheDocument();
    expect(screen.getByText('Alex Rivera (You)')).toBeInTheDocument();
    expect(screen.getByText('Sam Lee')).toBeInTheDocument();
    expect(container.querySelectorAll('.zoom-video-tile-filmstrip')).toHaveLength(2);
  });

  it('switches to the horizontal desktop panel composition with a sidebar', () => {
    const { container } = render(
      <TooltipProvider>
        <ZoomShareFilmstrip
          displayName="Alex Rivera"
          selfMuted
          selfVideoOn={false}
          selfHandRaised={false}
          selfVideoRef={createRef<HTMLDivElement>()}
          remoteParticipants={[]}
          raisedHandUserIds={new Set()}
          activeSpeakerUserId={null}
          selfUserId={1}
          sidebarOpen
          onRemoteContainer={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(container.querySelector('.zoom-filmstrip-panel')).toBeInTheDocument();
    expect(container.querySelector('.lg\\:hidden')).not.toBeInTheDocument();
  });
});

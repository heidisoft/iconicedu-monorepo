import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomParticipantGallery } from './zoom-participant-gallery';

const remoteParticipants = [
  {
    userId: 2,
    displayName: 'Sam Lee',
    muted: true,
    bVideoOn: false,
    isHost: false,
  },
  {
    userId: 3,
    displayName: 'Jordan Kim',
    muted: false,
    bVideoOn: true,
    isHost: false,
  },
];

function renderGallery(remotes = remoteParticipants) {
  return render(
    <TooltipProvider>
      <ZoomParticipantGallery
        displayName="Alex Rivera"
        selfMuted={false}
        selfVideoOn
        selfHandRaised={false}
        selfVideoRef={createRef<HTMLDivElement>()}
        remoteParticipants={remotes}
        raisedHandUserIds={new Set([2])}
        activeSpeakerUserId={2}
        selfUserId={1}
        onRemoteContainer={vi.fn()}
        sidebarOpen={false}
        page={0}
        onPageChange={vi.fn()}
      />
    </TooltipProvider>,
  );
}

describe('ZoomParticipantGallery', () => {
  it('renders every SDK participant as a tile', () => {
    renderGallery();

    expect(screen.getByText('Alex Rivera (You)')).toBeInTheDocument();
    expect(screen.getByText('Sam Lee')).toBeInTheDocument();
    expect(screen.getByText('Jordan Kim')).toBeInTheDocument();
  });

  it('uses a single full-stage grid when alone', () => {
    const { container } = renderGallery([]);
    expect(container.querySelector('.grid-cols-1')).toBeInTheDocument();
    expect(container.querySelector('.aspect-video')).toBeInTheDocument();
  });

  it('limits a gallery page to four participants', () => {
    const remotes = Array.from({ length: 5 }, (_, index) => ({
      userId: index + 2,
      displayName: `Participant ${index + 2}`,
      muted: true,
      bVideoOn: false,
      isHost: false,
    }));

    renderGallery(remotes);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.queryByText('Participant 5')).not.toBeInTheDocument();
  });
});

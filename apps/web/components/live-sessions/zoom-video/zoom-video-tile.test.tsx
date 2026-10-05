import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomVideoTile } from './zoom-video-tile';

describe('ZoomVideoTile', () => {
  it('shows participant identity and both media states', () => {
    render(
      <TooltipProvider>
        <ZoomVideoTile
          label="Alex Rivera"
          isSelf
          isMuted
          isVideoOn={false}
          handRaised
          videoContainerRef={createRef<HTMLDivElement>()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText('Alex Rivera (You)')).toBeInTheDocument();
    expect(screen.getByLabelText('Microphone off')).toBeInTheDocument();
    expect(screen.getByLabelText('Camera off')).toBeInTheDocument();
    expect(screen.getByLabelText('Hand raised')).toBeInTheDocument();
  });

  it('draws the active-speaker ring inside the clipped tile surface', () => {
    const { container } = render(
      <TooltipProvider>
        <ZoomVideoTile
          label="Alex Rivera"
          isSelf={false}
          isMuted={false}
          isVideoOn
          isSpeaking
          videoContainerRef={createRef<HTMLDivElement>()}
        />
      </TooltipProvider>,
    );

    expect(container.querySelector('.zoom-video-tile')).toHaveClass(
      'ring-inset',
      'ring-primary',
    );
  });
});

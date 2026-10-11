import { createRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ZoomVideoTile } from './zoom-video-tile';

describe('ZoomVideoTile', () => {
  it('changes the microphone beside the name into speaking bars without moving it', () => {
    const ref = createRef<HTMLDivElement>();
    const tile = (speaking: boolean, muted = false) => (
      <TooltipProvider>
        <ZoomVideoTile
          label="Alex"
          isSelf={false}
          isMuted={muted}
          isVideoOn={false}
          isSpeaking={speaking}
          videoContainerRef={ref}
        />
      </TooltipProvider>
    );
    const { rerender } = render(tile(false));
    const indicator = screen.getByLabelText('Microphone on');
    expect(screen.getByLabelText('Alex status')).toContainElement(indicator);
    expect(indicator).toHaveAttribute('data-speaking', 'false');
    rerender(tile(true));
    expect(screen.getByLabelText('Alex is speaking')).toBe(indicator);
    expect(indicator).toHaveAttribute('data-speaking', 'true');
    rerender(tile(false));
    expect(screen.getByLabelText('Microphone on')).toBe(indicator);
    expect(indicator).toHaveAttribute('data-speaking', 'false');
    rerender(tile(true, true));
    expect(screen.getByLabelText('Microphone off')).toBe(indicator);
    expect(indicator).toHaveAttribute('data-speaking', 'false');
    expect(screen.queryByLabelText('Alex is speaking')).not.toBeInTheDocument();
  });
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

it('keeps the avatar until attachment and fades it out without unmounting it', async () => {
  const ref = createRef<HTMLDivElement>();
  const tile = (on: boolean) => (
    <TooltipProvider>
      <ZoomVideoTile
        label="Alex"
        isSelf
        isMuted={false}
        isVideoOn={on}
        videoContainerRef={ref}
      />
    </TooltipProvider>
  );
  const { container, rerender } = render(tile(true));
  const placeholder = container.querySelector('[data-camera-placeholder]');
  expect(placeholder).toHaveAttribute('aria-hidden', 'false');
  ref.current!.appendChild(document.createElement('video-player'));
  await waitFor(() => expect(placeholder).toHaveAttribute('aria-hidden', 'true'));
  expect(placeholder).toHaveClass(
    'transition-opacity',
    'duration-200',
    'motion-reduce:transition-none',
  );
  rerender(tile(false));
  expect(placeholder).toHaveAttribute('aria-hidden', 'false');
  expect(placeholder).not.toHaveClass('transition-opacity');
  expect(container.querySelector('[data-camera-placeholder]')).toBe(placeholder);
});

it('does not show a speaking badge or ring for a muted microphone', () => {
  const { container } = render(
    <TooltipProvider>
      <ZoomVideoTile
        label="Muted participant"
        isSelf={false}
        isMuted
        isVideoOn={false}
        isSpeaking
        videoContainerRef={createRef<HTMLDivElement>()}
      />
    </TooltipProvider>,
  );
  expect(
    screen.queryByLabelText('Muted participant is speaking'),
  ).not.toBeInTheDocument();
  expect(container.querySelector('.zoom-video-tile')).not.toHaveClass('ring-primary');
});

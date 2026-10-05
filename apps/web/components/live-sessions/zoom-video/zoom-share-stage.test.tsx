import { createRef, type ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ZoomShareStage } from './zoom-share-stage';

function renderStage(overrides: Partial<ComponentProps<typeof ZoomShareStage>> = {}) {
  return render(
    <ZoomShareStage
      remoteCanvasRef={createRef<HTMLCanvasElement>()}
      localCanvasRef={createRef<HTMLCanvasElement>()}
      localVideoRef={createRef<HTMLVideoElement>()}
      whiteboardContainerRef={createRef<HTMLDivElement>()}
      dimensions={{ width: 1920, height: 1080 }}
      showRemoteShare
      showLocalShare={false}
      showWhiteboard={false}
      whiteboardLoading={false}
      localRenderTarget="canvas"
      sidebarOpen={false}
      sharePresenters={[]}
      activeShareUserId={null}
      onSelectShare={() => undefined}
      {...overrides}
    />,
  );
}

describe('ZoomShareStage', () => {
  it('keeps every Zoom render target mounted while showing the active surface', () => {
    const { container } = renderStage();

    expect(container.querySelectorAll('canvas')).toHaveLength(2);
    expect(container.querySelector('video')).toBeInTheDocument();
    expect(container.querySelectorAll('.zoom-share-stage')).toHaveLength(3);
    expect(container.querySelector('[aria-hidden="false"]')).toBeInTheDocument();
  });

  it('reserves panel space on every share surface when a sidebar is open', () => {
    const { container } = renderStage({ sidebarOpen: true });

    expect(container.querySelectorAll('.zoom-share-stage-panel')).toHaveLength(3);
  });

  it('shows initialization feedback without placing UI inside the SDK mount', () => {
    const whiteboardContainerRef = createRef<HTMLDivElement>();
    renderStage({
      whiteboardContainerRef,
      showRemoteShare: false,
      showWhiteboard: true,
      whiteboardLoading: true,
    });

    expect(screen.getByText('Opening whiteboard…')).toBeVisible();
    expect(whiteboardContainerRef.current).toBeEmptyDOMElement();
  });

  it('preserves the reported source ratio instead of forcing screen share to 16:9', () => {
    const { container } = renderStage({
      dimensions: { width: 1440, height: 900 },
    });

    expect(container.querySelector('canvas')).toHaveStyle({ aspectRatio: '1440 / 900' });
  });

  it('offers presenter tabs when multiple people are sharing', () => {
    const onSelectShare = vi.fn();
    renderStage({
      sharePresenters: [
        { userId: 2, displayName: 'Alex' },
        { userId: 3, displayName: 'Sam' },
      ],
      activeShareUserId: 2,
      onSelectShare,
    });

    expect(screen.getByRole('tab', { name: 'Alex' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Sam' }));
    expect(onSelectShare).toHaveBeenCalledWith(3);
  });
});

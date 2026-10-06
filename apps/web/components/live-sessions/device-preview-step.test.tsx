import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicePreviewStep } from '@iconicedu/web/components/live-sessions/device-preview-step';

describe('DevicePreviewStep', () => {
  const audioTrack = { enabled: true, stop: vi.fn() };
  const videoTrack = { enabled: true, stop: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    audioTrack.enabled = true;
    videoTrack.enabled = true;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [audioTrack, videoTrack],
          getAudioTracks: () => [audioTrack],
          getVideoTracks: () => [videoTrack],
        }),
      },
    });
  });

  it('uses visible, accessible device controls and returns the selected state', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();

    render(
      <DevicePreviewStep displayName="Alex" sessionTitle="Math class" onJoin={onJoin} />,
    );

    const microphoneButton = await screen.findByRole('button', {
      name: 'Turn microphone off',
    });
    const cameraButton = screen.getByRole('button', { name: 'Turn camera off' });

    expect(microphoneButton).toHaveTextContent('Mic on');
    expect(cameraButton).toHaveTextContent('Camera on');

    await user.click(microphoneButton);
    await user.click(cameraButton);

    expect(screen.getByRole('button', { name: 'Turn microphone on' })).toHaveTextContent(
      'Mic off',
    );
    expect(screen.getByRole('button', { name: 'Turn camera on' })).toHaveTextContent(
      'Camera off',
    );

    await user.click(screen.getByRole('button', { name: 'Join session' }));

    await waitFor(() =>
      expect(onJoin).toHaveBeenCalledWith({ muted: true, videoOff: true }),
    );
  });
  it.each(['denied', 'unavailable'])(
    'defaults both devices off when preview is %s',
    async (mode) => {
      if (mode === 'unavailable')
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: undefined,
        });
      else
        vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
          new Error('Denied'),
        );
      const onJoin = vi.fn();
      const user = userEvent.setup();
      render(
        <DevicePreviewStep displayName="Alex" sessionTitle="Science" onJoin={onJoin} />,
      );
      await screen.findByText(
        'Camera/microphone access was blocked. You can still join with them off and enable them later.',
      );
      await user.click(screen.getByRole('button', { name: 'Join session' }));
      expect(onJoin).toHaveBeenCalledWith({ muted: true, videoOff: true });
    },
  );

  it('stops a preview stream that arrives after the component unmounts', async () => {
    let finish!: (stream: MediaStream) => void;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const view = render(
      <DevicePreviewStep
        displayName="Alex"
        sessionTitle="Science"
        onJoin={() => undefined}
      />,
    );
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    view.unmount();
    finish({ getTracks: () => [audioTrack, videoTrack] } as unknown as MediaStream);
    await waitFor(() => {
      expect(audioTrack.stop).toHaveBeenCalledOnce();
      expect(videoTrack.stop).toHaveBeenCalledOnce();
    });
  });
});

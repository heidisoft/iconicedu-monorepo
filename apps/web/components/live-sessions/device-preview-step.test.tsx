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
});

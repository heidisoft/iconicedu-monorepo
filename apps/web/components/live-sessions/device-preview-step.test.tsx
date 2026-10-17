import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevicePreviewStep } from '@iconicedu/web/components/live-sessions/device-preview-step';

describe('DevicePreviewStep', () => {
  const browserMethods = [
    'hasPointerCapture',
    'setPointerCapture',
    'releasePointerCapture',
    'scrollIntoView',
  ] as const;
  const originals = browserMethods.map((method) =>
    Object.getOwnPropertyDescriptor(HTMLElement.prototype, method),
  );
  beforeAll(() => {
    for (const method of browserMethods)
      Object.defineProperty(HTMLElement.prototype, method, {
        configurable: true,
        value: method === 'hasPointerCapture' ? () => false : () => undefined,
      });
  });
  afterAll(() => {
    browserMethods.forEach((method, index) => {
      const original = originals[index];
      if (original) Object.defineProperty(HTMLElement.prototype, method, original);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[method];
    });
  });
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

  it('keeps device checks inside Settings and dismisses with Escape', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(
      <DevicePreviewStep displayName="Alex" sessionTitle="Math class" onJoin={onJoin} />,
    );
    const trigger = screen.getByRole('button', { name: 'Settings' });
    expect(
      screen.queryByRole('button', { name: 'Test audio and video' }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toBeEnabled());
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    await user.click(trigger);
    expect(
      await screen.findByRole('dialog', { name: 'Settings' }, { timeout: 5000 }),
    ).toBeVisible();
    expect(screen.getByRole('meter', { name: 'Microphone activity' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Test speakers' })).toBeEnabled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onJoin).not.toHaveBeenCalled();
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

    await waitFor(() => expect(microphoneButton).toBeEnabled());
    expect(microphoneButton).toHaveAttribute('aria-pressed', 'true');
    expect(cameraButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(microphoneButton);
    await user.click(cameraButton);

    expect(screen.getByRole('button', { name: 'Turn microphone on' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(audioTrack.enabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Turn camera on' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(videoTrack.enabled).toBe(false);

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
  it('edits the tile name and submits it with the selected device preferences', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(<DevicePreviewStep displayName="Alex" sessionTitle="Math" onJoin={onJoin} />);
    await user.click(
      screen.getByRole('button', { name: 'Change display name, currently Alex' }),
    );
    const input = screen.getByRole('textbox', { name: 'Display name' });
    await user.clear(input);
    expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled();
    await user.type(input, 'Alex Smith');
    await user.click(screen.getByRole('button', { name: 'Save name' }));
    expect(
      screen.getByRole('button', { name: 'Change display name, currently Alex Smith' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Join session' }));
    expect(onJoin).toHaveBeenCalledWith({
      muted: false,
      videoOff: false,
      displayName: 'Alex Smith',
    });
  });
  it('keeps a denied microphone off when retrying permission fails', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new Error('Denied'));
    const user = userEvent.setup();
    render(<DevicePreviewStep displayName="Alex" sessionTitle="Math" onJoin={vi.fn()} />);
    await screen.findByText(
      'Camera/microphone access was blocked. You can still join with them off and enable them later.',
    );
    await user.click(screen.getByRole('button', { name: 'Turn microphone on' }));
    expect(
      await screen.findByText(
        'Could not turn on your microphone. Check browser permissions and try again.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Turn microphone on' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith({ audio: true });
  });
  it('retries only the requested device and reflects a successful permission grant', async () => {
    const stream = {
      getTracks: () => [audioTrack],
      getAudioTracks: () => [audioTrack],
      getVideoTracks: () => [],
    };
    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockRejectedValueOnce(new Error('Denied'))
      .mockResolvedValueOnce(stream as unknown as MediaStream);
    const user = userEvent.setup();
    render(<DevicePreviewStep displayName="Alex" sessionTitle="Math" onJoin={vi.fn()} />);
    await screen.findByText(
      'Camera/microphone access was blocked. You can still join with them off and enable them later.',
    );
    await user.click(screen.getByRole('button', { name: 'Turn microphone on' }));
    expect(
      await screen.findByRole('button', { name: 'Turn microphone off' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Turn camera on' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
  it('switches a live camera without stopping the microphone and passes choices to the call', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    const audio = {
      enabled: true,
      readyState: 'live',
      stop: vi.fn(),
      getSettings: () => ({ deviceId: 'mic-one' }),
    };
    const camera = {
      enabled: true,
      readyState: 'live',
      stop: vi.fn(),
      getSettings: () => ({ deviceId: 'camera-one' }),
    };
    const replacement = {
      enabled: true,
      readyState: 'live',
      stop: vi.fn(),
      getSettings: () => ({ deviceId: 'camera-two' }),
    };
    let tracks = [audio, camera];
    const stream = {
      getTracks: () => tracks,
      getAudioTracks: () => tracks.filter((track) => track === audio),
      getVideoTracks: () => tracks.filter((track) => track !== audio),
      addTrack: (track: typeof camera) => {
        tracks.push(track);
      },
      removeTrack: (track: typeof camera) => {
        tracks = tracks.filter((item) => item !== track);
      },
    };
    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockResolvedValueOnce(stream as unknown as MediaStream)
      .mockResolvedValueOnce({
        getTracks: () => [replacement],
      } as unknown as MediaStream);
    Object.assign(navigator.mediaDevices, {
      enumerateDevices: vi.fn().mockResolvedValue([
        { kind: 'audioinput', deviceId: 'mic-one', label: 'Built-in mic' },
        { kind: 'videoinput', deviceId: 'camera-one', label: 'Built-in camera' },
        { kind: 'videoinput', deviceId: 'camera-two', label: 'USB camera' },
      ]),
    });
    render(<DevicePreviewStep displayName="Alex" sessionTitle="Math" onJoin={onJoin} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Settings' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('tab', { name: 'Video', exact: true }));
    await user.click(screen.getByRole('combobox', { name: 'Camera' }));
    await user.click(screen.getByRole('option', { name: 'USB camera' }));
    await waitFor(() => expect(camera.stop).toHaveBeenCalledOnce());
    expect(audio.stop).not.toHaveBeenCalled();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith({
      video: { deviceId: { exact: 'camera-two' } },
    });
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Join session' }));
    expect(onJoin).toHaveBeenCalledWith({
      muted: false,
      videoOff: false,
      cameraId: 'camera-two',
      microphoneId: 'mic-one',
    });
  });
  it('selects a microphone while muted without turning it on', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new Error('Denied'));
    Object.assign(navigator.mediaDevices, {
      enumerateDevices: vi.fn().mockResolvedValue([
        { kind: 'audioinput', deviceId: 'mic-one', label: 'Built-in mic' },
        { kind: 'audioinput', deviceId: 'mic-two', label: 'USB mic' },
      ]),
    });
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(<DevicePreviewStep displayName="Alex" sessionTitle="Math" onJoin={onJoin} />);
    await screen.findByText(
      'Camera/microphone access was blocked. You can still join with them off and enable them later.',
    );
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('combobox', { name: 'Microphone' }));
    await user.click(screen.getByRole('option', { name: 'USB mic' }));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledOnce();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Join session' }));
    expect(onJoin).toHaveBeenCalledWith({
      muted: true,
      videoOff: true,
      microphoneId: 'mic-two',
    });
  });
});

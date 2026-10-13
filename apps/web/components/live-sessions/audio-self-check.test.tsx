import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AudioSelfCheck } from './audio-self-check';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function audioMock() {
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const analyser = {
    fftSize: 256,
    disconnect: vi.fn(),
    getByteTimeDomainData: (data: Uint8Array) => data.fill(150),
  };
  const oscillator = {
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
  const instances: Array<{
    close: ReturnType<typeof vi.fn>;
    setSinkId: ReturnType<typeof vi.fn>;
  }> = [];
  vi.stubGlobal(
    'AudioContext',
    class {
      destination = {};
      currentTime = 0;
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      setSinkId = vi.fn().mockResolvedValue(undefined);
      createMediaStreamSource = () => source;
      createAnalyser = () => analyser;
      createOscillator = () => oscillator;
      createGain = () => ({ gain: { value: 0 }, connect: vi.fn() });
      constructor() {
        instances.push(this);
      }
    },
  );
  return { source, analyser, oscillator, instances };
}
describe('audio self-check', () => {
  it('shows microphone activity and releases resources without stopping preview tracks', async () => {
    vi.useFakeTimers();
    const mock = audioMock();
    const stop = vi.fn();
    const track = { stop };
    const stream = { getAudioTracks: () => [track] } as unknown as MediaStream;
    const view = render(<AudioSelfCheck stream={stream} muted={false} />);
    act(() => vi.advanceTimersByTime(100));
    expect(
      screen.getByRole('meter', { name: 'Microphone activity' }),
    ).not.toHaveAttribute('value', '0');
    view.unmount();
    expect(mock.source.disconnect).toHaveBeenCalled();
    expect(mock.instances[0].close).toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  });
  it('reconnects the meter when a microphone track changes in the same stream', () => {
    const mock = audioMock();
    let track = { id: 'first' };
    const stream = { getAudioTracks: () => [track] } as unknown as MediaStream;
    const view = render(<AudioSelfCheck stream={stream} muted={false} />);
    track = { id: 'second' };
    view.rerender(<AudioSelfCheck stream={stream} muted={false} />);
    expect(mock.instances).toHaveLength(2);
    expect(mock.instances[0].close).toHaveBeenCalled();
    view.unmount();
    expect(mock.instances[1].close).toHaveBeenCalled();
  });
  it('keeps preview usable when the browser cannot create an audio context', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('Unavailable');
        }
      },
    );
    const track = { id: 'microphone' };
    const stream = { getAudioTracks: () => [track] } as unknown as MediaStream;
    render(<AudioSelfCheck stream={stream} muted={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('You can still join');
    expect(screen.getByRole('button', { name: 'Test speakers' })).toBeEnabled();
  });
  it('routes a user-requested test sound to the selected speaker', async () => {
    const mock = audioMock();
    render(<AudioSelfCheck stream={null} muted speakerId="headphones" />);
    fireEvent.click(screen.getByRole('button', { name: 'Test speakers' }));
    await waitFor(() => expect(mock.oscillator.start).toHaveBeenCalled());
    expect(mock.instances[0].setSinkId).toHaveBeenCalledWith('headphones');
    act(() => mock.oscillator.onended?.());
    expect(mock.instances[0].close).toHaveBeenCalled();
  });
  it('does not acquire audio or start analysis while muted', () => {
    const mock = audioMock();
    render(<AudioSelfCheck stream={null} muted />);
    expect(mock.instances).toHaveLength(0);
    expect(screen.getByText('Microphone is off')).toBeVisible();
  });
  it('explains unsupported selected-speaker routing instead of silently testing another output', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'AudioContext',
      class {
        close = close;
        resume = vi.fn().mockResolvedValue(undefined);
      },
    );
    render(<AudioSelfCheck stream={null} muted speakerId="headphones" />);
    fireEvent.click(screen.getByRole('button', { name: 'Test speakers' }));
    await expect(screen.findByRole('alert')).resolves.toHaveTextContent(
      'default speaker',
    );
    expect(close).toHaveBeenCalled();
  });
});

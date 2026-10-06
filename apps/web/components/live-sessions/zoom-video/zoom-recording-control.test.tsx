import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecordingStatus } from '@zoom/videosdk';
import { describe, expect, it, vi } from 'vitest';
import {
  useMeetingRecordingControl,
  type MeetingRecordingControlProps,
  type MeetingRecordingClient,
} from './zoom-recording-control';
import { ZoomRecordingIndicator } from './zoom-recording-indicator';
import { StrictMode, useState } from 'react';

function ZoomRecordingControl(props: MeetingRecordingControlProps) {
  const { action, error } = useMeetingRecordingControl(props);
  return (
    <>
      {action ? (
        <button disabled={action.disabled} onClick={action.onSelect}>
          {action.label}
        </button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}
function createClient() {
  let status = RecordingStatus.Stopped;
  return {
    canStartRecording: vi.fn(() => true),
    startCloudRecording: vi.fn(async () => {
      status = RecordingStatus.Recording;
      return '' as const;
    }),
    stopCloudRecording: vi.fn(async () => {
      status = RecordingStatus.Stopped;
      return '' as const;
    }),
    getCloudRecordingStatus: vi.fn(() => status),
  };
}
function Harness({ client }: { client: MeetingRecordingClient }) {
  const [status, setStatus] = useState(RecordingStatus.Stopped);
  return (
    <>
      <ZoomRecordingControl
        canManage
        client={client}
        status={status}
        onStatusChange={setStatus}
      />
      <ZoomRecordingIndicator status={status} />
    </>
  );
}

describe('ZoomRecordingControl', () => {
  it('starts and stops recording and updates the indicator from confirmed SDK state', async () => {
    const client = createClient();
    render(<Harness client={client} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Recording in progress' })).toBeVisible(),
    );
    expect(client.startCloudRecording).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Not recording' })).toBeVisible(),
    );
    expect(client.stopCloudRecording).toHaveBeenCalledOnce();
  });
  it('hides recording controls for participants who are not hosts', () => {
    const client = createClient();
    render(
      <ZoomRecordingControl
        client={client}
        status={RecordingStatus.Stopped}
        onStatusChange={vi.fn()}
        canManage={false}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(client.startCloudRecording).not.toHaveBeenCalled();
  });
  it('disables start when cloud recording is unavailable', () => {
    const client = createClient();
    client.canStartRecording.mockReturnValue(false);
    render(<Harness client={client} />);
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeDisabled();
  });
  it('keeps the indicator truthful when Zoom returns an error', async () => {
    const client = createClient();
    client.startCloudRecording.mockImplementation(async () => {
      throw new Error('Denied');
    });
    render(<Harness client={client} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Recording couldn't be changed",
    );
    expect(screen.getByRole('status', { name: 'Not recording' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled();
  });
  it('prevents duplicate recording requests while one is pending', async () => {
    const client = createClient();
    let finish: (() => void) | undefined;
    client.startCloudRecording.mockImplementation(
      () =>
        new Promise<''>((resolve) => {
          finish = () => resolve('');
        }),
    );
    render(<Harness client={client} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    const pending = screen.getByRole('button', { name: 'Updating recording' });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(client.startCloudRecording).toHaveBeenCalledOnce();
    finish?.();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start recording' })).toBeEnabled(),
    );
    expect(screen.getByRole('status', { name: 'Not recording' })).toBeVisible();
  });
  it('handles an SDK Error result without changing confirmed state', async () => {
    const client: MeetingRecordingClient = {
      ...createClient(),
      startCloudRecording: vi.fn(async () => new Error('Denied')),
    };
    render(<Harness client={client} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByRole('status', { name: 'Not recording' })).toBeVisible();
  });
  it('stops paused recording even when a new recording cannot be started', async () => {
    const client = createClient();
    client.canStartRecording.mockReturnValue(false);
    client.getCloudRecordingStatus.mockReturnValue(RecordingStatus.Paused);
    render(
      <ZoomRecordingControl
        canManage
        client={client}
        status={RecordingStatus.Paused}
        onStatusChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await waitFor(() => expect(client.stopCloudRecording).toHaveBeenCalledOnce());
  });
});

it('automatically starts once and locks stop according to meeting policy', async () => {
  const client = createClient();
  function Automatic() {
    const [status, setStatus] = useState(RecordingStatus.Stopped);
    return (
      <ZoomRecordingControl
        canManage
        autoStart
        allowStop={false}
        client={client}
        status={status}
        onStatusChange={setStatus}
      />
    );
  }
  render(
    <StrictMode>
      <Automatic />
    </StrictMode>,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Recording locked' })).toBeDisabled(),
  );
  expect(client.startCloudRecording).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Recording locked' }));
  expect(client.stopCloudRecording).not.toHaveBeenCalled();
});

it('does not automatically record for non-hosts or when recording is disabled', () => {
  const client = createClient();
  const { rerender } = render(
    <ZoomRecordingControl
      canManage={false}
      autoStart
      client={client}
      status={RecordingStatus.Stopped}
      onStatusChange={vi.fn()}
    />,
  );
  expect(client.startCloudRecording).not.toHaveBeenCalled();
  rerender(
    <ZoomRecordingControl
      canManage
      autoStart
      enabled={false}
      client={client}
      status={RecordingStatus.Stopped}
      onStatusChange={vi.fn()}
    />,
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(client.startCloudRecording).not.toHaveBeenCalled();
});

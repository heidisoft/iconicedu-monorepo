import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SharePrivilege } from '@zoom/videosdk';
import { expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ZoomSettingsPanel } from './zoom-settings-panel';

vi.mock('./zoom-meeting-dialog', () => ({
  ZoomMeetingDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

it('shows picture-in-picture preferences only in Advanced', async () => {
  const noop = vi.fn();
  render(
    <ZoomSettingsPanel
      open
      hideTrigger
      cameras={[]}
      microphones={[]}
      speakers={[]}
      activeCameraId={null}
      activeMicrophoneId={null}
      activeSpeakerId={null}
      audioProcessing="original"
      backgroundPreset="none"
      sharePrivilege={SharePrivilege.Unlocked}
      isMirrored={false}
      hardwareAcceleration={{ encode: false, decode: false }}
      supportsNoiseSuppression={false}
      supportsVirtualBackground={false}
      isHost={false}
      onOpenChange={noop}
      onSelectCamera={noop}
      onSelectMicrophone={noop}
      onSelectSpeaker={noop}
      onSelectAudioProcessing={noop}
      onToggleMirror={noop}
      onSelectBackground={noop}
      onToggleHardwareAcceleration={noop}
      onSelectSharePrivilege={noop}
      pictureInPictureSettings={
        <label>
          Open automatically
          <select aria-label="Open automatically" />
        </label>
      }
    />,
  );
  expect(screen.queryByLabelText('Open automatically')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Video', exact: true }));
  expect(screen.queryByLabelText('Open automatically')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Advanced' }));
  expect(screen.getByLabelText('Open automatically')).toBeVisible();
});

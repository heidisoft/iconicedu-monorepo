import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  MeetingPictureInPictureControls,
  MeetingPipSettings,
} from './meeting-picture-in-picture-controls';
import type { useMeetingPictureInPicture } from './use-meeting-picture-in-picture';

function preferences(): ReturnType<typeof useMeetingPictureInPicture> {
  return {
    host: null,
    pipWindow: null,
    supported: true,
    open: vi.fn(),
    restore: vi.fn(),
    mode: 'always',
    setAutomaticMode: vi.fn(),
    error: null,
    clearError: vi.fn(),
    returned: false,
    dismissReturn: vi.fn(),
    sharePrompt: false,
  };
}

describe('picture-in-picture settings', () => {
  it('opens the shared call settings from the floating window gear', () => {
    const pip = { ...preferences(), pipWindow: window };
    const onCallSettings = vi.fn();
    const onSettingsOpenChange = vi.fn();
    render(
      <MeetingPictureInPictureControls
        pip={pip}
        settingsOpen={false}
        onSettingsOpenChange={onSettingsOpenChange}
        onCallSettings={onCallSettings}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Call settings' }));
    expect(onCallSettings).toHaveBeenCalledOnce();
    expect(onSettingsOpenChange).not.toHaveBeenCalled();
  });
  it('updates automatic opening and disables it in unsupported browsers', () => {
    const pip = preferences();
    const { rerender } = render(<MeetingPipSettings pip={pip} />);
    fireEvent.change(screen.getByLabelText('Open automatically'), {
      target: { value: 'never' },
    });
    expect(pip.setAutomaticMode).toHaveBeenCalledWith('never');
    rerender(<MeetingPipSettings pip={{ ...pip, supported: false }} />);
    expect(screen.getByLabelText('Open automatically')).toBeDisabled();
  });
});

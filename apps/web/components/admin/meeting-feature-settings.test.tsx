import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LIVE_SESSION_SETTINGS } from '@iconicedu/shared-types';
import { MeetingFeatureSettings } from './meeting-feature-settings';
function Harness() {
  const [value, setValue] = useState(structuredClone(DEFAULT_LIVE_SESSION_SETTINGS));
  return <MeetingFeatureSettings value={value} onChange={setValue} />;
}
describe('Classroom meeting options', () => {
  it('provides separate recording, whiteboard, invites, participant and message settings', () => {
    render(<Harness />);
    for (const label of [
      'Recording',
      'Start Recording',
      'Disable Stop Recording',
      'Whiteboard',
      'Shared Invite',
      'Show Participants',
      'Messages',
      'Enable Messages',
    ])
      expect(screen.getByRole('checkbox', { name: label, exact: true })).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: 'Start Recording', exact: true }),
    ).not.toBeChecked();
  });
  it('clears automatic start and stop lock when recording is disabled', () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Start Recording', exact: true }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Disable Stop Recording', exact: true }),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Recording', exact: true }));
    expect(
      screen.getByRole('checkbox', { name: 'Start Recording', exact: true }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Disable Stop Recording', exact: true }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Start Recording', exact: true }),
    ).toBeDisabled();
  });
  it('allows a visible read-only message panel and disables sending when hidden', () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Enable Messages', exact: true }),
    );
    expect(screen.getByRole('checkbox', { name: 'Messages', exact: true })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Messages', exact: true }));
    expect(
      screen.getByRole('checkbox', { name: 'Enable Messages', exact: true }),
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: 'Enable Messages', exact: true }),
    ).not.toBeChecked();
  });
});

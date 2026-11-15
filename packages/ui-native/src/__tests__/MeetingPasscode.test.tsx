import React from 'react';
import { Share } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MeetingPasscode } from '../components/MeetingPasscode';
describe('MeetingPasscode', () => {
  it('displays and shares the passcode separately from any URL', () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction });
    render(<MeetingPasscode passcode="test-secret" color="black" mutedColor="gray" />);
    expect(screen.getByText('test-secret')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Share passcode'));
    expect(share).toHaveBeenCalledWith({ message: 'test-secret' });
    share.mockRestore();
  });
  it('does not display a password section when the provider has none', () => {
    render(<MeetingPasscode color="black" mutedColor="gray" />);
    expect(screen.queryByText('Session passcode')).toBeNull();
  });
});

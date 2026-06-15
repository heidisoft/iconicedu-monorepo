import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReleaseNotes } from '@/lib/release-notes';
import { WhatsNewModal } from './whats-new-modal';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: require('@/lib/theme').lightColors,
  }),
}));

const releaseNotes: ReleaseNotes = {
  id: 'release-1',
  title: "What's new",
  items: ['New message composer', 'Better class reminders'],
};

describe('WhatsNewModal', () => {
  it('renders the title and release note items', () => {
    render(<WhatsNewModal visible releaseNotes={releaseNotes} onDismiss={jest.fn()} />);

    expect(screen.getByText("What's new")).toBeTruthy();
    expect(screen.getByText('New message composer')).toBeTruthy();
    expect(screen.getByText('Better class reminders')).toBeTruthy();
  });

  it('calls dismiss when the button is pressed', () => {
    const onDismiss = jest.fn();
    render(<WhatsNewModal visible releaseNotes={releaseNotes} onDismiss={onDismiss} />);

    fireEvent.press(screen.getByRole('button', { name: 'Got it' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SessionCard, type ClassSession } from './session-card';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      teal: '#14b8a6',
      tealBg: '#f0fdfa',
      card: '#ffffff',
      inputBg: '#f1f5f9',
      border: '#e2e8f0',
      text: '#0f172a',
      textMuted: '#64748b',
      textFaint: '#94a3b8',
    },
  }),
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const baseSession: ClassSession = {
  id: 'test-1',
  label: 'Mar · Week 2',
  time: '2:30 PM',
  dayName: 'Mon',
  dayNum: '10',
  isToday: false,
  isLive: false,
  isPast: false,
  status: 'scheduled',
  meetingLink: null,
  channelId: 'channel-1',
  variant: 'default',
  disabled: false,
  startAt: '2025-03-10T14:30:00.000Z',
  endAt: '2025-03-10T15:30:00.000Z',
};

describe('SessionCard', () => {
  it('renders without crashing', () => {
    render(<SessionCard session={baseSession} />);
  });

  it('shows day name and number', () => {
    render(<SessionCard session={baseSession} />);
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
  });

  it('shows session label and time', () => {
    render(<SessionCard session={baseSession} />);
    expect(screen.getByText('Mar · Week 2')).toBeTruthy();
    expect(screen.getByText('2:30 PM')).toBeTruthy();
  });

  it('shows LIVE badge when isLive', () => {
    render(<SessionCard session={{ ...baseSession, isLive: true }} />);
    expect(screen.getByText('LIVE')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Join Now')).toBeTruthy();
  });

  it('shows Join button for upcoming sessions', () => {
    render(<SessionCard session={baseSession} />);
    expect(screen.getByText('Join')).toBeTruthy();
  });

  it('shows Recording button for past sessions', () => {
    render(<SessionCard session={{ ...baseSession, isPast: true }} />);
    expect(screen.getByText('Recording')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
  });

  it('shows Skipped badge for exception variant', () => {
    render(<SessionCard session={{ ...baseSession, variant: 'exception' }} />);
    expect(screen.getByText('Skipped')).toBeTruthy();
  });

  it('shows student names next to the time', () => {
    render(
      <SessionCard
        session={{
          ...baseSession,
          students: [
            { name: 'Alice', themeKey: 'blue' },
            { name: 'Bob', themeKey: 'teal' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('does not render student separator when no students', () => {
    render(<SessionCard session={{ ...baseSession, students: [] }} />);
    expect(screen.queryByText('·')).toBeNull();
  });
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { RescheduleAvailabilityPicker } from './reschedule-availability-picker';
import type { SelfServeRescheduleOptionsVM } from '@iconicedu/shared-types';

jest.mock('lucide-react-native', () => ({
  ChevronDown: () => {
    const { View } = require('react-native');
    return <View testID="chevron-down" />;
  },
}));

const colors = {
  teal: '#14b8a6',
  tealBg: '#f0fdfa',
  card: '#ffffff',
  inputBg: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
} as never;

const options: SelfServeRescheduleOptionsVM = {
  timezone: 'UTC',
  durationMinutes: 60,
  educatorProfileId: 'teacher-1',
  educatorName: 'Ms. Chen',
  days: [
    {
      date: '2030-03-04',
      label: 'Mon, Mar 4',
      weekdayKey: 'Mon',
      slots: [
        {
          startAt: '2030-03-04T15:00:00.000Z',
          endAt: '2030-03-04T16:00:00.000Z',
          label: '3:00 PM',
          hour: 15,
        },
      ],
    },
    {
      date: '2030-03-05',
      label: 'Tue, Mar 5',
      weekdayKey: 'Tue',
      slots: [
        {
          startAt: '2030-03-05T17:00:00.000Z',
          endAt: '2030-03-05T18:00:00.000Z',
          label: '5:00 PM',
          hour: 17,
        },
      ],
    },
  ],
};

describe('RescheduleAvailabilityPicker', () => {
  it('shows dates in a dropdown and emits selected slots', () => {
    const onSelectDay = jest.fn();
    const onSelectSlot = jest.fn();

    render(
      <RescheduleAvailabilityPicker
        colors={colors}
        options={options}
        selectedDate="2030-03-04"
        selectedStartAt={null}
        onSelectDay={onSelectDay}
        onSelectSlot={onSelectSlot}
      />,
    );

    fireEvent.press(screen.getByText('Mon, Mar 4'));
    fireEvent.press(screen.getByText('Tue, Mar 5'));
    fireEvent.press(screen.getByText('3:00 PM'));

    expect(onSelectDay).toHaveBeenCalledWith('2030-03-05');
    expect(onSelectSlot).toHaveBeenCalledWith({
      startAt: '2030-03-04T15:00:00.000Z',
      endAt: '2030-03-04T16:00:00.000Z',
      label: '3:00 PM',
      hour: 15,
    });
  });
});

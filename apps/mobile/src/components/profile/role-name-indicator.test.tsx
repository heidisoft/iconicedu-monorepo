import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { RoleNameIndicator } from './role-name-indicator';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: {
      pageBg: '#ffffff',
      text: '#0f172a',
      textMuted: '#94a3b8',
    },
  }),
}));

jest.mock('lucide-react-native', () => ({
  IdCardLanyard: ({ testID }: { testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID ?? 'staff-name-indicator'} />;
  },
}));

describe('RoleNameIndicator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('shows a tooltip when the staff indicator is pressed', () => {
    render(<RoleNameIndicator name="ICONIC Support" role="staff" />);

    fireEvent.press(screen.getByLabelText('Staff member'));

    expect(screen.getByText('Staff member')).toBeTruthy();
    expect(screen.getByTestId('staff-tooltip')).toBeTruthy();
  });

  it('does not render a staff indicator for non-staff roles', () => {
    render(<RoleNameIndicator name="Priya Patel" role="educator" />);

    expect(screen.queryByTestId('staff-name-indicator')).toBeNull();
    expect(screen.queryByLabelText('Staff member')).toBeNull();
  });
});

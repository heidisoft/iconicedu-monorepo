import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { RoleNameIndicator } from './role-name-indicator';

const mockUseTheme = jest.fn(() => ({
  colors: {
    pageBg: '#ffffff',
    text: '#0f172a',
    textMuted: '#94a3b8',
  },
}));

jest.mock('@iconicedu/ui-native', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  const TooltipContext = React.createContext<{
    visible: boolean;
    setVisible: (value: boolean) => void;
  } | null>(null);

  return {
    Tooltip: ({ children }: { children: React.ReactNode }) => {
      const [visible, setVisible] = React.useState(false);
      return (
        <TooltipContext.Provider value={{ visible, setVisible }}>
          {children}
        </TooltipContext.Provider>
      );
    },
    TooltipTrigger: ({
      children,
      accessibilityLabel,
      accessibilityRole,
    }: {
      asChild?: boolean;
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children: React.ReactNode;
    }) => {
      const context = React.useContext(TooltipContext);
      return (
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole={accessibilityRole}
          onPress={() => context?.setVisible(true)}
        >
          {children}
        </Pressable>
      );
    },
    TooltipContent: ({
      children,
      testID,
    }: {
      children: React.ReactNode;
      testID?: string;
    }) => {
      const context = React.useContext(TooltipContext);
      if (!context?.visible) return null;
      return <View testID={testID}>{children}</View>;
    },
  };
});

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => mockUseTheme(),
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
    mockUseTheme.mockReturnValue({
      colors: {
        pageBg: '#ffffff',
        text: '#0f172a',
        textMuted: '#94a3b8',
      },
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('shows a tooltip when the staff indicator is pressed', () => {
    render(<RoleNameIndicator name="ICONIC Support" role="staff" />);

    fireEvent.press(screen.getByLabelText('STAFF'));

    expect(screen.getByText('STAFF')).toBeTruthy();
    expect(screen.getByTestId('staff-tooltip')).toBeTruthy();
  });

  it('uses a readable tooltip text color in dark mode', () => {
    mockUseTheme.mockReturnValue({
      colors: {
        pageBg: '#121212',
        text: '#ffffff',
        textMuted: '#8E8E93',
      },
    });

    render(<RoleNameIndicator name="ICONIC Support" role="staff" />);

    fireEvent.press(screen.getByLabelText('STAFF'));

    expect(screen.getByText('STAFF')).toHaveStyle({ color: '#f8fafc' });
  });

  it('does not render a staff indicator for non-staff roles', () => {
    render(<RoleNameIndicator name="Priya Patel" role="educator" />);

    expect(screen.queryByTestId('staff-name-indicator')).toBeNull();
    expect(screen.queryByLabelText('STAFF')).toBeNull();
  });
});

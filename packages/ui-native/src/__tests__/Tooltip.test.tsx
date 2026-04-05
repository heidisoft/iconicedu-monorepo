import React from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';

jest.mock('../components/ui/native-only-animated-view', () => {
  const { View } = require('react-native');
  return {
    NativeOnlyAnimatedView: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock('react-native-reanimated', () => ({
  FadeInDown: {
    withInitialValues: () => ({
      duration: () => undefined,
    }),
  },
  FadeInUp: {
    withInitialValues: () => undefined,
  },
  FadeOut: undefined,
}));

jest.mock('../components/ui/text', () => {
  const React = require('react');
  return {
    TextClassContext: React.createContext<string | undefined>(undefined),
  };
});

jest.mock('@rn-primitives/tooltip', () => {
  const React = require('react');
  const { View } = require('react-native');
  const TooltipContext = React.createContext<{
    visible: boolean;
    setVisible: (value: boolean) => void;
  } | null>(null);

  return {
    Root: ({ children }: { children: React.ReactNode }) => {
      const [visible, setVisible] = React.useState(false);
      return (
        <TooltipContext.Provider value={{ visible, setVisible }}>
          {children}
        </TooltipContext.Provider>
      );
    },
    Trigger: ({ children }: { asChild?: boolean; children: React.ReactElement }) => {
      const context = React.useContext(TooltipContext);
      return React.cloneElement(children, {
        onPress: () => context?.setVisible(true),
      });
    },
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Content: ({ children, testID }: { children: React.ReactNode; testID?: string }) => {
      const context = React.useContext(TooltipContext);
      if (!context?.visible) return null;
      return <View testID={testID}>{children}</View>;
    },
  };
});

describe('Tooltip', () => {
  it('shows content when pressed', () => {
    render(
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Open tooltip">
            <Text>Trigger</Text>
          </Pressable>
        </TooltipTrigger>
        <TooltipContent testID="tooltip">
          <Text>Hello</Text>
        </TooltipContent>
      </Tooltip>,
    );

    fireEvent.press(screen.getByLabelText('Open tooltip'));

    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByTestId('tooltip')).toBeTruthy();
  });
});

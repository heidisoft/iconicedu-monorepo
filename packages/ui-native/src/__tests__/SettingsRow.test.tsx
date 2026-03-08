import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SettingsRow } from '../components/SettingsRow';
import { UiTrackingContext } from '../lib/tracking-context';

const icon = <Text>🔔</Text>;

describe('SettingsRow', () => {
  it('renders label', () => {
    render(<SettingsRow icon={icon} label="Notifications" />);
    expect(screen.getByText('Notifications')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<SettingsRow icon={icon} label="Notifications" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not pressable when onPress is undefined', () => {
    render(<SettingsRow icon={icon} label="Info" />);
    // Without onPress it renders as 'text' role
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders trailing content', () => {
    render(
      <SettingsRow
        icon={icon}
        label="Theme"
        trailing={<Text testID="toggle">ON</Text>}
        hideChevron
      />,
    );
    expect(screen.getByTestId('toggle')).toBeTruthy();
  });

  describe('analytics tracking', () => {
    it('fires track on press', () => {
      const capture = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <SettingsRow icon={icon} label="Notifications" onPress={jest.fn()} />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByRole('button'));
      expect(capture).toHaveBeenCalledWith('settings row tapped', {
        button_name: 'Notifications',
        component_type: 'settings_row',
      });
    });

    it('does not fire track when no onPress is provided', () => {
      const capture = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <SettingsRow icon={icon} label="Info only" />
        </UiTrackingContext.Provider>,
      );
      // No button role — pressing does nothing
      expect(screen.queryByRole('button')).toBeNull();
      expect(capture).not.toHaveBeenCalled();
    });

    it('still calls onPress after tracking', () => {
      const capture = jest.fn();
      const onPress = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <SettingsRow icon={icon} label="Privacy" onPress={onPress} />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByRole('button'));
      expect(capture).toHaveBeenCalledWith('settings row tapped', {
        button_name: 'Privacy',
        component_type: 'settings_row',
      });
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});

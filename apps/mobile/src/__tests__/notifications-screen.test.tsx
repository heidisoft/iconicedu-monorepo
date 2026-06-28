import React from 'react';
import { Linking, Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import NotificationsScreen from '../../app/(app)/settings/notifications';

// ─── Mock: expo-router ────────────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

// ─── Mock: theme provider ─────────────────────────────────────────────────────
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: require('@/lib/theme').lightColors,
  }),
}));

// ─── Mock: usePushToggle (the key dependency being tested) ────────────────────
const mockToggle = jest.fn();
const mockUsePushToggle = jest.fn();
const mockRequestPushConsent = jest.fn();
jest.mock('@/hooks/use-push-toggle', () => ({
  usePushToggle: () => mockUsePushToggle(),
}));

jest.mock('@/providers/push-consent-provider', () => ({
  usePushConsent: () => ({ requestPushConsent: mockRequestPushConsent }),
}));

// ─── Mock: useNotificationPrefs ───────────────────────────────────────────────
jest.mock('@/hooks/use-notification-prefs', () => ({
  useNotificationPrefs: () => ({ data: [], isLoading: false }),
}));

// ─── Mock: useUpdateNotificationPref ─────────────────────────────────────────
jest.mock('@/hooks/use-update-notification-pref', () => ({
  useUpdateNotificationPref: () => ({ mutate: jest.fn() }),
}));

// ─── Mock: skeletons ─────────────────────────────────────────────────────────
jest.mock('@/components/skeletons', () => ({
  NotificationSettingsSkeleton: () => null,
}));

// ─── Mock: notification-config ────────────────────────────────────────────────
jest.mock('@/lib/notifications/notification-config', () => ({
  NOTIFICATION_REGISTRY: {},
}));

// ─── Mock: push-nudge-sheet (avoids BottomSheet native module dependency) ────
jest.mock('@/components/notifications/push-nudge-sheet', () => ({
  PushNudgeSheet: () => null,
}));

// ─── Mock: push-token (openNotificationSettings) ─────────────────────────────
jest.mock('@/lib/notifications/push-token', () => ({
  openNotificationSettings: jest.fn().mockResolvedValue(undefined),
}));

// ─── Mock: @iconicedu/ui-native (SettingsRow) ─────────────────────────────────
jest.mock('@iconicedu/ui-native', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    SettingsRow: ({
      label,
      onPress,
      trailing,
    }: {
      label: string;
      onPress?: () => void;
      trailing?: React.ReactNode;
    }) => (
      <TouchableOpacity onPress={onPress} testID={`settings-row-${label}`}>
        <Text>{label}</Text>
        {trailing}
      </TouchableOpacity>
    ),
  };
});

// Linking.openSettings is spied on in beforeEach rather than module-mocked,
// because module-level mocks of react-native sub-modules can fail to intercept
// the re-exported Linking object used inside the screen.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pushToggleEnabled() {
  mockUsePushToggle.mockReturnValue({
    isPushEnabled: true,
    isOsPermissionDenied: false,
    isOsPermissionUndetermined: false,
    isToggling: false,
    toggle: mockToggle,
  });
}

function pushToggleDisabled() {
  mockUsePushToggle.mockReturnValue({
    isPushEnabled: false,
    isOsPermissionDenied: false,
    isOsPermissionUndetermined: false,
    isToggling: false,
    toggle: mockToggle,
  });
}

function pushToggleUndetermined() {
  mockUsePushToggle.mockReturnValue({
    isPushEnabled: false,
    isOsPermissionDenied: false,
    isOsPermissionUndetermined: true,
    isToggling: false,
    toggle: mockToggle,
  });
}

function pushToggleDenied() {
  mockUsePushToggle.mockReturnValue({
    isPushEnabled: false,
    isOsPermissionDenied: true,
    isOsPermissionUndetermined: false,
    isToggling: false,
    toggle: mockToggle,
  });
}

let openSettingsSpy: jest.SpyInstance;

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  setPlatformOS('ios');
  openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
});

afterEach(() => {
  openSettingsSpy.mockRestore();
});

function setPlatformOS(value: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', {
    value,
    configurable: true,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationsScreen — master push toggle (normal state, OS granted)', () => {
  it('renders the "Class reminders" label', () => {
    pushToggleEnabled();
    render(<NotificationsScreen />);
    expect(screen.getByText('Class reminders')).toBeTruthy();
  });

  it('Switch value is true when isPushEnabled is true', () => {
    pushToggleEnabled();
    render(<NotificationsScreen />);
    const sw = screen.getByRole('switch');
    expect(sw.props.value).toBe(true);
  });

  it('Switch value is false when isPushEnabled is false (OS granted, muted)', () => {
    pushToggleDisabled();
    render(<NotificationsScreen />);
    const sw = screen.getByRole('switch');
    expect(sw.props.value).toBe(false);
  });

  it('pressing the Switch calls togglePush', () => {
    pushToggleEnabled();
    render(<NotificationsScreen />);
    const sw = screen.getByRole('switch');
    fireEvent(sw, 'valueChange', false);
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('Switch is not disabled when isToggling is false', () => {
    pushToggleEnabled();
    render(<NotificationsScreen />);
    const sw = screen.getByRole('switch');
    expect(sw.props.disabled).toBeFalsy();
  });
});

describe('NotificationsScreen — master push toggle (isToggling)', () => {
  it('Switch is disabled when isToggling is true', () => {
    mockUsePushToggle.mockReturnValue({
      isPushEnabled: true,
      isOsPermissionDenied: false,
      isOsPermissionUndetermined: false,
      isToggling: true,
      toggle: mockToggle,
    });
    render(<NotificationsScreen />);
    const sw = screen.getByRole('switch');
    expect(sw.props.disabled).toBe(true);
  });
});

describe('NotificationsScreen — first-time push opt-in', () => {
  it('renders the class reminders value card', () => {
    pushToggleUndetermined();
    render(<NotificationsScreen />);
    expect(screen.getByText('Turn on class reminders')).toBeTruthy();
    expect(
      screen.getByText(
        'Get reminders before sessions, tutor messages, and schedule changes. No marketing notifications.',
      ),
    ).toBeTruthy();
  });

  it('uses the soft consent prompt before requesting OS permission', () => {
    pushToggleUndetermined();
    render(<NotificationsScreen />);
    fireEvent.press(screen.getByLabelText('Turn on class reminders'));
    expect(mockRequestPushConsent).toHaveBeenCalledTimes(1);
    expect(mockToggle).not.toHaveBeenCalled();
  });
});

describe('NotificationsScreen — master push toggle (OS permission denied)', () => {
  it('renders "Class reminders" label', () => {
    pushToggleDenied();
    render(<NotificationsScreen />);
    expect(screen.getByText('Class reminders')).toBeTruthy();
  });

  it('Switch is rendered with value=false and disabled', () => {
    pushToggleDenied();
    render(<NotificationsScreen />);
    const sw = screen.getByRole('switch');
    expect(sw.props.value).toBe(false);
    expect(sw.props.disabled).toBe(true);
  });

  it('tapping the row does not directly call Linking.openSettings (nudge sheet opens first)', () => {
    pushToggleDenied();
    render(<NotificationsScreen />);
    fireEvent.press(screen.getByTestId('settings-row-Class reminders'));
    expect(openSettingsSpy).not.toHaveBeenCalled();
  });

  it('tapping the row does NOT call togglePush', () => {
    pushToggleDenied();
    render(<NotificationsScreen />);
    fireEvent.press(screen.getByTestId('settings-row-Class reminders'));
    expect(mockToggle).not.toHaveBeenCalled();
  });
});

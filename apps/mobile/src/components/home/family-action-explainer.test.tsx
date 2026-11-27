import React from 'react';
import { Modal, Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FamilyActionExplainer } from './family-action-explainer';
import { darkColors, lightColors } from '@/lib/theme';
let mockColors = lightColors;
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: mockColors }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
  SafeAreaView: require('react-native').View,
}));
beforeEach(() => {
  mockColors = lightColors;
});
it.each(['child', 'class'] as const)(
  'explains %s before taking any action and waits for native dismissal',
  (kind) => {
    const platform = jest.replaceProperty(Platform, 'OS', 'ios');
    const next = jest.fn();
    const close = jest.fn();
    const view = render(
      <FamilyActionExplainer
        kind={kind}
        onClose={close}
        onContinue={next}
        onInvite={jest.fn()}
      />,
    );
    expect(next).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        kind === 'child' ? 'Their learning, all together.' : 'Find the right support.',
      ),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByLabelText(
        kind === 'child' ? 'Continue to add child' : 'Continue to class request',
      ),
    );
    expect(next).not.toHaveBeenCalled();
    fireEvent(view.UNSAFE_getByType(Modal), 'dismiss');
    fireEvent(view.UNSAFE_getByType(Modal), 'dismiss');
    expect(next).toHaveBeenCalledTimes(1);
    platform.restore();
  },
);
it('provides both managed child creation and the existing email invitation path', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  const invite = jest.fn();
  const next = jest.fn();
  render(
    <FamilyActionExplainer
      kind="child"
      onClose={jest.fn()}
      onContinue={next}
      onInvite={invite}
    />,
  );
  expect(screen.getByText(/Email is optional/)).toBeTruthy();
  expect(screen.getByText(/first and last names, birth year and grade/)).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Invite child by email instead'));
  expect(invite).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
  platform.restore();
});
it('closes through native Back without continuing', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  const close = jest.fn();
  const next = jest.fn();
  const view = render(
    <FamilyActionExplainer kind="class" onClose={close} onContinue={next} />,
  );
  expect(screen.getByText(/does not book a class or take a payment/)).toBeTruthy();
  fireEvent(view.UNSAFE_getByType(Modal), 'requestClose');
  expect(close).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
  platform.restore();
});
it('keeps a pending continuation from firing after the intro unmounts', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'ios');
  const next = jest.fn();
  const view = render(
    <FamilyActionExplainer kind="class" onClose={jest.fn()} onContinue={next} />,
  );
  const modal = view.UNSAFE_getByType(Modal);
  fireEvent.press(screen.getByLabelText('Continue to class request'));
  const dismissed = modal.props.onDismiss;
  view.unmount();
  dismissed();
  expect(next).not.toHaveBeenCalled();
  platform.restore();
});
it('uses the corresponding dark promotion colors', () => {
  mockColors = darkColors;
  render(
    <FamilyActionExplainer kind="class" onClose={jest.fn()} onContinue={jest.fn()} />,
  );
  expect(screen.getByText('Find the right support.').props.style.color).toBe(
    darkColors.promotionMintForeground,
  );
});

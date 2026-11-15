import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { UpdateRequiredBanner } from './update-required-banner';

jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({
    colors: require('@/lib/theme').lightColors,
  }),
}));

describe('UpdateRequiredBanner', () => {
  it('renders nothing when not visible', () => {
    render(
      <UpdateRequiredBanner
        visible={false}
        message="Please update"
        storeUrl="https://example.com/store"
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.queryByText('Update available')).toBeNull();
  });

  it('renders the message when visible', () => {
    render(
      <UpdateRequiredBanner
        visible
        message="A new version is out"
        storeUrl="https://example.com/store"
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText('Update available')).toBeTruthy();
    expect(screen.getByText('A new version is out')).toBeTruthy();
  });

  it('opens the store url when Update is pressed', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue();

    render(
      <UpdateRequiredBanner
        visible
        message="A new version is out"
        storeUrl="https://example.com/store"
        onDismiss={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Update' }));

    expect(openURLSpy).toHaveBeenCalledWith('https://example.com/store');
  });

  it('calls onDismiss when the close button is pressed', () => {
    const onDismiss = jest.fn();
    render(
      <UpdateRequiredBanner
        visible
        message="A new version is out"
        storeUrl="https://example.com/store"
        onDismiss={onDismiss}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Dismiss update notification' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

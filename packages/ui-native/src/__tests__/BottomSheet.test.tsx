import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { BottomSheet } from '@iconicedu/ui-native/components/BottomSheet';

describe('BottomSheet', () => {
  it('renders sheet content when visible', () => {
    render(
      <BottomSheet visible onClose={jest.fn()}>
        <Text>Sheet body</Text>
      </BottomSheet>,
    );

    expect(screen.getByText('Sheet body')).toBeTruthy();
  });

  it('does not render sheet content when hidden', () => {
    render(
      <BottomSheet visible={false} onClose={jest.fn()}>
        <Text>Hidden body</Text>
      </BottomSheet>,
    );

    expect(screen.queryByText('Hidden body')).toBeNull();
  });
});

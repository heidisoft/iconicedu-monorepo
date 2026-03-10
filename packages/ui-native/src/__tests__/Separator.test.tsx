import React from 'react';
import { render } from '@testing-library/react-native';
import { Separator } from '@iconicedu/ui-native/components/Separator';

describe('Separator', () => {
  it('renders without error', () => {
    const { toJSON } = render(<Separator />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders horizontal by default', () => {
    const { toJSON } = render(<Separator />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders vertical orientation', () => {
    const { toJSON } = render(<Separator orientation="vertical" />);
    expect(toJSON()).toBeTruthy();
  });

  it('has none accessibility role', () => {
    const { toJSON } = render(<Separator />);
    expect(toJSON().props.accessibilityRole).toBe('none');
  });
});

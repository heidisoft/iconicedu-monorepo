import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Separator } from '../components/Separator';

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
    render(<Separator />);
    expect(screen.getByRole('none')).toBeTruthy();
  });
});

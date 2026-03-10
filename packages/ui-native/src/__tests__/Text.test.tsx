import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Typography } from '@iconicedu/ui-native/components/Text';

describe('Typography', () => {
  it('renders children text', () => {
    render(<Typography>Hello World</Typography>);
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('defaults to body variant', () => {
    render(<Typography>Body text</Typography>);
    expect(screen.getByRole('text')).toBeTruthy();
  });

  it('renders heading variants with header role', () => {
    render(<Typography variant="h1">Heading</Typography>);
    expect(screen.getByRole('header')).toBeTruthy();
  });

  it('renders all variants without error', () => {
    const variants = [
      'h1',
      'h2',
      'h3',
      'h4',
      'body',
      'body-sm',
      'caption',
      'label',
      'muted',
    ] as const;

    variants.forEach((variant) => {
      const { unmount } = render(<Typography variant={variant}>{variant}</Typography>);
      expect(screen.getByText(variant)).toBeTruthy();
      unmount();
    });
  });

  it('passes additional props through', () => {
    render(
      <Typography numberOfLines={1} testID="text">
        Truncated
      </Typography>,
    );
    expect(screen.getByTestId('text')).toBeTruthy();
  });
});

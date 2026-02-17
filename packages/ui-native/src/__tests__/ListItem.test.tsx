import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ListItem } from '../components/ListItem';

describe('ListItem', () => {
  it('renders title', () => {
    render(<ListItem title="John Doe" />);
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('renders subtitle', () => {
    render(<ListItem title="John" subtitle="Last seen 5 min ago" />);
    expect(screen.getByText('Last seen 5 min ago')).toBeTruthy();
  });

  it('renders leading content', () => {
    render(
      <ListItem title="John" leading={<Text testID="avatar">JD</Text>} />,
    );
    expect(screen.getByTestId('avatar')).toBeTruthy();
  });

  it('renders trailing content', () => {
    render(
      <ListItem
        title="John"
        trailing={<Text testID="badge">3</Text>}
      />,
    );
    expect(screen.getByTestId('badge')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<ListItem title="John" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has accessibility state selected when active', () => {
    render(<ListItem title="John" active />);
    const item = screen.getByRole('button');
    expect(item.props.accessibilityState).toEqual({ selected: true });
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Tabs } from '../components/Tabs';

const mockItems = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread', badge: 5 },
  { key: 'groups', label: 'Groups' },
];

describe('Tabs', () => {
  it('renders all tab labels', () => {
    render(<Tabs items={mockItems} activeKey="all" onTabPress={jest.fn()} />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Unread')).toBeTruthy();
    expect(screen.getByText('Groups')).toBeTruthy();
  });

  it('calls onTabPress with correct key', () => {
    const onTabPress = jest.fn();
    render(
      <Tabs items={mockItems} activeKey="all" onTabPress={onTabPress} />,
    );
    fireEvent.press(screen.getByText('Unread'));
    expect(onTabPress).toHaveBeenCalledWith('unread');
  });

  it('renders badge count', () => {
    render(<Tabs items={mockItems} activeKey="all" onTabPress={jest.fn()} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('caps badge at 99+', () => {
    const items = [{ key: 'all', label: 'All', badge: 150 }];
    render(<Tabs items={items} activeKey="all" onTabPress={jest.fn()} />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('sets selected accessibility state for active tab', () => {
    render(<Tabs items={mockItems} activeKey="all" onTabPress={jest.fn()} />);
    const activeTab = screen.getByLabelText('All');
    expect(activeTab.props.accessibilityState).toEqual({ selected: true });
  });

  it('has tablist accessibility role', () => {
    const { toJSON } = render(
      <Tabs items={mockItems} activeKey="all" onTabPress={jest.fn()} />,
    );
    const tree = toJSON();
    expect(tree.props.accessibilityRole).toBe('tablist');
  });

  it('does not show badge when badge is 0', () => {
    const items = [{ key: 'all', label: 'All', badge: 0 }];
    render(<Tabs items={items} activeKey="all" onTabPress={jest.fn()} />);
    expect(screen.queryByText('0')).toBeNull();
  });
});

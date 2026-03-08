import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Tabs } from '../components/Tabs';
import { UiTrackingContext } from '../lib/tracking-context';

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
    render(<Tabs items={mockItems} activeKey="all" onTabPress={onTabPress} />);
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

  describe('analytics tracking', () => {
    it('fires track with tab_key and tab_label on press', () => {
      const capture = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <Tabs items={mockItems} activeKey="all" onTabPress={jest.fn()} />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByText('Unread'));
      expect(capture).toHaveBeenCalledWith('tab selected', {
        tab_key: 'unread',
        tab_label: 'Unread',
        component_type: 'tab',
      });
    });

    it('still calls onTabPress after tracking', () => {
      const capture = jest.fn();
      const onTabPress = jest.fn();
      render(
        <UiTrackingContext.Provider value={capture}>
          <Tabs items={mockItems} activeKey="all" onTabPress={onTabPress} />
        </UiTrackingContext.Provider>,
      );
      fireEvent.press(screen.getByText('Groups'));
      expect(capture).toHaveBeenCalledWith('tab selected', {
        tab_key: 'groups',
        tab_label: 'Groups',
        component_type: 'tab',
      });
      expect(onTabPress).toHaveBeenCalledWith('groups');
    });
  });
});

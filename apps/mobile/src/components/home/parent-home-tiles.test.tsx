import { darkColors, lightColors } from '@/lib/theme';
import React from 'react';
import { Alert, Dimensions } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ParentHomeTiles } from './parent-home-tiles';
let mockColors = lightColors;
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: mockColors }),
}));
const mockStored = new Map<string, string>();
const mockSet = jest.fn(async (key: string, value: string) => {
  mockStored.set(key, value);
});
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockStored.get(key) ?? null,
  setItem: (key: string, value: string) => mockSet(key, value),
}));
beforeEach(() => {
  mockColors = lightColors;
  mockStored.clear();
  mockSet.mockClear();
});
it('shows one Overview-sized tile and changes its action when advancing the carousel', async () => {
  const add = jest.fn(),
    refer = jest.fn();
  render(
    <ParentHomeTiles
      referralsEnabled
      width={180}
      orgId="org"
      accountId="parent"
      onAddChild={add}
      onRefer={refer}
    />,
  );
  const tile = await screen.findByTestId('parent-promotion-tile');
  expect(tile.props.style.width).toBe(180);
  expect(tile.props.style.height).toBe(
    Math.ceil(175 * Math.max(1, Dimensions.get('window').fontScale)),
  );
  expect(screen.getByText('Get $20 off when another parent joins.')).toBeTruthy();
  const referralColor = tile.props.style.backgroundColor;
  const overviewColors = [
    lightColors.periwinkle,
    lightColors.primarySubtle,
    lightColors.peach,
  ];
  expect(overviewColors).not.toContain(referralColor);
  expect(screen.getAllByLabelText('Dismiss family suggestions')).toHaveLength(1);
  expect(screen.queryByLabelText('Add a child')).toBeNull();
  fireEvent.press(screen.getByLabelText('How it works'));
  expect(refer).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Next family suggestion'));
  expect(screen.queryByLabelText('How it works')).toBeNull();
  expect(
    screen.getByTestId('parent-promotion-tile').props.style.backgroundColor,
  ).not.toBe(referralColor);
  expect(overviewColors).not.toContain(
    screen.getByTestId('parent-promotion-tile').props.style.backgroundColor,
  );
  expect(screen.getByText('Their learning, all in one place.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Add a child'));
  expect(add).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Next family suggestion'));
  expect(screen.getByLabelText('How it works')).toBeTruthy();
});
it('pages vertically and supports screen-reader adjustment actions', async () => {
  render(
    <ParentHomeTiles
      referralsEnabled
      orgId="org"
      accountId="parent"
      onAddChild={jest.fn()}
      onRefer={jest.fn()}
    />,
  );
  const pager = await screen.findByTestId('parent-promotion-carousel');
  expect(pager.props.pagingEnabled).toBe(true);
  expect(pager.props.horizontal).not.toBe(true);
  fireEvent(pager, 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: 0, y: pager.props.style.height } },
  });
  expect(screen.getByLabelText('Add a child')).toBeTruthy();
  fireEvent(pager, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
  expect(screen.getByLabelText('How it works')).toBeTruthy();
  expect(screen.getByLabelText('Family suggestions').props.accessibilityValue.now).toBe(
    1,
  );
});
it('dismisses the entire carousel without opening either action and remembers the choice', async () => {
  const add = jest.fn(),
    refer = jest.fn();
  const ui = (
    <ParentHomeTiles
      referralsEnabled
      orgId="org"
      accountId="parent"
      onAddChild={add}
      onRefer={refer}
    />
  );
  const view = render(ui);
  await screen.findByTestId('parent-promotion-tile');
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Dismiss family suggestions'));
  });
  expect(screen.queryByTestId('parent-promotion-tile')).toBeNull();
  expect(mockSet).toHaveBeenCalledWith('home-tile-v1:org:parent:family-promotions', '1');
  expect(add).not.toHaveBeenCalled();
  expect(refer).not.toHaveBeenCalled();
  view.unmount();
  render(ui);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.queryByTestId('parent-promotion-tile')).toBeNull();
});
it('keeps the card available with a retry message when persistence fails', async () => {
  mockSet.mockRejectedValueOnce(new Error('disk full'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(
    <ParentHomeTiles
      referralsEnabled
      orgId="org"
      accountId="parent"
      onAddChild={jest.fn()}
    />,
  );
  fireEvent.press(await screen.findByLabelText('Dismiss family suggestions'));
  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith('Unable to dismiss', 'Please try again.'),
  );
  expect(screen.getByText('Add a child')).toBeTruthy();
  expect(screen.queryByLabelText('Next family suggestion')).toBeNull();
  alert.mockRestore();
});
it('does not render a tile without an authenticated account scope', () => {
  render(
    <ParentHomeTiles referralsEnabled orgId="org" accountId="" onAddChild={jest.fn()} />,
  );
  expect(screen.queryByTestId('parent-promotion-tile')).toBeNull();
});

it('uses separate dark pink and dark yellow surfaces in dark mode', async () => {
  mockColors = darkColors;
  render(
    <ParentHomeTiles
      referralsEnabled
      orgId="org"
      accountId="parent"
      onAddChild={jest.fn()}
      onRefer={jest.fn()}
    />,
  );
  const tile = await screen.findByTestId('parent-promotion-tile');
  expect(tile.props.style.backgroundColor).toBe(darkColors.promotionPink);
  expect(tile.props.style.backgroundColor).not.toBe(lightColors.promotionPink);
  fireEvent.press(screen.getByLabelText('Next family suggestion'));
  expect(screen.getByTestId('parent-promotion-tile').props.style.backgroundColor).toBe(
    darkColors.promotionYellow,
  );
  expect(screen.getByText('Add a child').props.style.color).toBe(
    darkColors.promotionYellowForeground,
  );
});

it('defaults to Add Child only even if a referral callback is supplied', async () => {
  const refer = jest.fn();
  render(
    <ParentHomeTiles
      orgId="org"
      accountId="parent"
      onAddChild={jest.fn()}
      onRefer={refer}
    />,
  );
  await screen.findByLabelText('Add a child');
  expect(screen.queryByText('Refer another parent')).toBeNull();
  expect(screen.queryByLabelText('How it works')).toBeNull();
  expect(screen.queryByLabelText('Next family suggestion')).toBeNull();
  expect(refer).not.toHaveBeenCalled();
});
it('removes the referral slide without leaving the pager on an empty page', async () => {
  const props = {
    orgId: 'org',
    accountId: 'parent',
    onAddChild: jest.fn(),
    onRefer: jest.fn(),
  };
  const view = render(<ParentHomeTiles {...props} referralsEnabled />);
  await screen.findByLabelText('How it works');
  fireEvent.press(screen.getByLabelText('Next family suggestion'));
  view.rerender(<ParentHomeTiles {...props} referralsEnabled={false} />);
  await screen.findByLabelText('Add a child');
  expect(screen.queryByText('Refer another parent')).toBeNull();
  expect(screen.queryByLabelText('Next family suggestion')).toBeNull();
});

it.each([false, true])(
  'adds Request a class to the same stack (referrals=%s)',
  async (referralsEnabled) => {
    const request = jest.fn();
    render(
      <ParentHomeTiles
        orgId="org"
        accountId="parent"
        referralsEnabled={referralsEnabled}
        onAddChild={jest.fn()}
        onRefer={jest.fn()}
        onRequestClass={request}
      />,
    );
    await screen.findByTestId('parent-promotion-tile');
    for (let i = 0; i < (referralsEnabled ? 2 : 1); i++)
      fireEvent.press(screen.getByLabelText('Next family suggestion'));
    expect(screen.getByText('Request a class')).toBeTruthy();
    expect(screen.getByTestId('parent-promotion-tile').props.style.backgroundColor).toBe(
      lightColors.promotionMint,
    );
    expect([
      lightColors.promotionPink,
      lightColors.promotionYellow,
      lightColors.periwinkle,
      lightColors.peach,
      lightColors.primarySubtle,
    ]).not.toContain(lightColors.promotionMint);
    fireEvent.press(screen.getByLabelText('Request a class'));
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Family suggestions').props.accessibilityValue.max).toBe(
      referralsEnabled ? 3 : 2,
    );
  },
);
it('uses a flat mint dark variant for the class request slide', async () => {
  mockColors = darkColors;
  render(
    <ParentHomeTiles
      orgId="org"
      accountId="parent"
      onAddChild={jest.fn()}
      onRequestClass={jest.fn()}
    />,
  );
  await screen.findByTestId('parent-promotion-tile');
  fireEvent.press(screen.getByLabelText('Next family suggestion'));
  expect(screen.getByTestId('parent-promotion-tile').props.style.backgroundColor).toBe(
    darkColors.promotionMint,
  );
  expect(screen.getByText('Request a class').props.style.color).toBe(
    darkColors.promotionMintForeground,
  );
});

it('advances one slide after the first visible layout and then stops', async () => {
  const { AccessibilityInfo, AppState } = require('react-native');
  jest.useFakeTimers();
  const reduce = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false);
  const reader = jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockResolvedValue(false);
  const original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: 'active',
  });
  try {
    render(
      <ParentHomeTiles
        orgId="intro-org"
        accountId="intro-parent"
        onAddChild={jest.fn()}
        onRequestClass={jest.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent(screen.getByTestId('parent-promotion-carousel'), 'layout');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByLabelText('Family suggestions').props.accessibilityValue.now).toBe(
      1,
    );
    act(() => jest.advanceTimersByTime(2200));
    expect(screen.getByLabelText('Family suggestions').props.accessibilityValue.now).toBe(
      2,
    );
    act(() => jest.advanceTimersByTime(10000));
    expect(screen.getByLabelText('Family suggestions').props.accessibilityValue.now).toBe(
      2,
    );
  } finally {
    reduce.mockRestore();
    reader.mockRestore();
    if (original) Object.defineProperty(AppState, 'currentState', original);
    jest.useRealTimers();
  }
});

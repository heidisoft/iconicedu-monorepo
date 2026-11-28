import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SearchableSelectionSheet } from '../components/searchable-selection-sheet';
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
  SafeAreaView: require('react-native').View,
}));
const props = {
  visible: true,
  title: 'Select subjects',
  searchPlaceholder: 'Search subjects',
  closeLabel: 'Cancel selection',
  emptyMessage: 'No matches',
  options: [
    { id: 'math', label: 'Math' },
    { id: 'science', label: 'Science' },
  ],
  colors: {
    card: '#fff',
    text: '#111',
    textMuted: '#555',
    border: '#ddd',
    inputBg: '#fff',
    action: '#164',
    actionSubtle: '#ded',
    actionForeground: '#fff',
  },
  onClose: jest.fn(),
  onSelect: jest.fn(),
};
beforeEach(() => jest.clearAllMocks());
it('keeps single selection behavior unchanged', () => {
  render(<SearchableSelectionSheet {...props} selectedId="math" />);
  expect(screen.getByLabelText('Math').props.accessibilityState.selected).toBe(true);
  expect(screen.queryByLabelText('Done selecting')).toBeNull();
  fireEvent.press(screen.getByLabelText('Science'));
  expect(props.onSelect).toHaveBeenCalledWith({ id: 'science', label: 'Science' });
});
it('supports controlled multiple selections, search, Done and cancellation', () => {
  const done = jest.fn();
  render(
    <SearchableSelectionSheet
      {...props}
      selectedIds={['math', 'science']}
      onDone={done}
    />,
  );
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  expect(screen.getByLabelText('Math').props.accessibilityState.checked).toBe(true);
  expect(screen.getByText('Done (2)')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Search subjects'), 'science');
  expect(screen.queryByLabelText('Math')).toBeNull();
  fireEvent.press(screen.getByLabelText('Science'));
  expect(props.onSelect).toHaveBeenCalledWith({ id: 'science', label: 'Science' });
  expect(done).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Done selecting'));
  expect(done).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByLabelText('Cancel selection'));
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

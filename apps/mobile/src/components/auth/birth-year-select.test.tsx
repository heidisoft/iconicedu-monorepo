import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BirthYearSelect } from './birth-year-select';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-06-01T12:00:00Z'));
});
afterEach(() => jest.useRealTimers());

it('has no default and lists recent years first, with search and a selected checkmark', () => {
  const onChange = jest.fn();
  const { rerender } = render(<BirthYearSelect value="" onChange={onChange} />);
  expect(screen.getByLabelText('Year of birth').props.accessibilityValue.text).toBe(
    'Select birth year',
  );
  rerender(<BirthYearSelect value="2020" onChange={onChange} />);
  fireEvent.press(screen.getByLabelText('Year of birth'));
  const rows = screen
    .getAllByRole('button')
    .filter((item) => item.props.accessibilityState?.selected !== undefined);
  expect(rows.slice(0, 3).map((row) => row.props.accessibilityLabel)).toEqual([
    '2026',
    '2025',
    '2024',
  ]);
  expect(screen.getByLabelText('2020').props.accessibilityState.selected).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Search year'), '2008');
  fireEvent.press(screen.getByLabelText('2008'));
  expect(onChange).toHaveBeenCalledWith('2008');
  expect(screen.queryByText('Choose birth year')).toBeNull();
});

it('preserves the value on dismissal and adds the new year on reopening after New Year', () => {
  const onChange = jest.fn();
  render(<BirthYearSelect value="2010" onChange={onChange} />);
  fireEvent.press(screen.getByLabelText('Year of birth'));
  fireEvent.changeText(screen.getByLabelText('Search year'), '2027');
  expect(screen.getByText('No matching years found. Try another year.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close birth year picker'));
  expect(onChange).not.toHaveBeenCalled();
  jest.setSystemTime(new Date('2027-06-01T12:00:00Z'));
  fireEvent.press(screen.getByLabelText('Year of birth'));
  expect(screen.getByLabelText('Search year').props.value).toBe('');
  expect(screen.getByLabelText('2027')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Search year'), '1907');
  expect(screen.getByLabelText('1907')).toBeTruthy();
  expect(screen.getByLabelText('Year of birth').props.accessibilityValue.text).toBe(
    '2010',
  );
});

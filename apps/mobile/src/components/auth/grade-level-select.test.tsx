import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { GradeLevel, optionsForCountry } from '@iconicedu/shared-types';
import { GradeLevelSelect } from './grade-level-select';

const options = [
  { value: GradeLevel.Kindergarten, label: 'Kindergarten' },
  { value: GradeLevel.Grade2, label: 'Grade 2' },
  { value: GradeLevel.Grade10, label: 'Grade 10' },
];
it('shows grades in education order, searches, and returns the canonical value', () => {
  const onChange = jest.fn();
  render(
    <GradeLevelSelect value={GradeLevel.Grade2} onChange={onChange} options={options} />,
  );
  fireEvent.press(screen.getByLabelText('Grade level'));
  expect(
    screen
      .getAllByRole('button')
      .filter((item) => item.props.accessibilityState?.selected !== undefined)
      .map((item) => item.props.accessibilityLabel),
  ).toEqual(['Kindergarten', 'Grade 2', 'Grade 10']);
  expect(screen.getByLabelText('Grade 2').props.accessibilityState.selected).toBe(true);
  fireEvent.changeText(screen.getByLabelText('Search grade level'), '10');
  expect(screen.queryByLabelText('Kindergarten')).toBeNull();
  fireEvent.press(screen.getByLabelText('Grade 10'));
  expect(onChange).toHaveBeenCalledWith(GradeLevel.Grade10);
  expect(screen.queryByText('Choose grade level')).toBeNull();
});
it('preserves the selection when closed and clears the search on reopening', () => {
  const onChange = jest.fn();
  render(<GradeLevelSelect value={null} onChange={onChange} options={options} />);
  fireEvent.press(screen.getByLabelText('Grade level'));
  fireEvent.changeText(screen.getByLabelText('Search grade level'), 'Unknown');
  expect(screen.getByText('No grade levels found. Try another grade.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Close grade level picker'));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Grade level'));
  expect(screen.getByLabelText('Search grade level').props.value).toBe('');
});
it('uses the supplied country-specific grade labels', () => {
  const local = optionsForCountry('GB', false);
  render(
    <GradeLevelSelect value={local[0]!.value} onChange={jest.fn()} options={local} />,
  );
  expect(screen.getByLabelText('Grade level').props.accessibilityValue.text).toBe(
    local[0]!.label,
  );
});

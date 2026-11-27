import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ClassRequestSheet } from './class-request-sheet';
const mockSubmit = jest.fn();
const mockClose = jest.fn();
const mockCreated = jest.fn();
jest.mock('@/lib/api/queries', () => ({
  submitClassRequest: (...args: unknown[]) => mockSubmit(...args),
}));
jest.mock('@/providers/theme-provider', () => ({
  useTheme: () => ({ colors: require('@/lib/theme').lightColors }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
  SafeAreaView: require('react-native').View,
}));
const props = {
  visible: true,
  onClose: mockClose,
  onCreated: mockCreated,
  students: [
    { profileId: 'child-1', displayName: 'Child One' },
    { profileId: 'child-2', displayName: 'Child Two' },
  ],
  defaultStudentIds: ['child-1'],
};
beforeEach(() => {
  jest.clearAllMocks();
  mockSubmit.mockResolvedValue({ success: true, channelId: 'request-1' });
});
function subjects(...values: string[]) {
  fireEvent.press(screen.getByLabelText('Select subjects'));
  for (const value of values) fireEvent.press(screen.getByLabelText(value));
  fireEvent.press(screen.getByLabelText('Done selecting'));
}
it('uses compact selectors rather than the old chip wall and keeps all inputs accessible', () => {
  render(<ClassRequestSheet {...props} />);
  expect(screen.getByLabelText('Select students').props.accessibilityValue.text).toBe(
    'Child One',
  );
  expect(screen.getByLabelText('Select subjects')).toBeTruthy();
  expect(screen.queryByText('Math')).toBeNull();
  expect(screen.queryByText('Child Two')).toBeNull();
  expect(screen.getByLabelText('Learning goals')).toBeTruthy();
  expect(screen.getByLabelText('Special requirements')).toBeTruthy();
});
it('supports multiple students and subjects and preserves choices across searches', () => {
  render(<ClassRequestSheet {...props} />);
  fireEvent.press(screen.getByLabelText('Select students'));
  fireEvent.press(screen.getByLabelText('Child Two'));
  fireEvent.press(screen.getByLabelText('Done selecting'));
  expect(screen.getByLabelText('Select students').props.accessibilityValue.text).toBe(
    'Child One, Child Two',
  );
  fireEvent.press(screen.getByLabelText('Select subjects'));
  fireEvent.press(screen.getByLabelText('Math'));
  fireEvent.changeText(screen.getByLabelText('Search subjects'), 'science');
  fireEvent.press(screen.getByLabelText('Science'));
  fireEvent.press(screen.getByLabelText('Done selecting'));
  expect(screen.getByLabelText('Select subjects').props.accessibilityValue.text).toBe(
    'Math, Science',
  );
});
it('discards picker changes on Cancel without closing the request or losing text', () => {
  render(<ClassRequestSheet {...props} />);
  fireEvent.changeText(screen.getByLabelText('Learning goals'), 'Fractions');
  subjects('Math');
  fireEvent.press(screen.getByLabelText('Select subjects'));
  fireEvent.press(screen.getByLabelText('Science'));
  fireEvent.press(screen.getByLabelText('Cancel selection'));
  expect(screen.getByLabelText('Select subjects').props.accessibilityValue.text).toBe(
    'Math',
  );
  expect(screen.getByLabelText('Learning goals').props.value).toBe('Fractions');
  expect(mockClose).not.toHaveBeenCalled();
  expect(mockSubmit).not.toHaveBeenCalled();
});
it('validates empty students, empty subjects and a missing custom subject', () => {
  render(<ClassRequestSheet {...props} defaultStudentIds={[]} />);
  fireEvent.press(screen.getByLabelText('Submit request'));
  expect(screen.getByText('Select at least one student.')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Select students'));
  fireEvent.press(screen.getByLabelText('Child One'));
  fireEvent.press(screen.getByLabelText('Done selecting'));
  fireEvent.press(screen.getByLabelText('Submit request'));
  expect(screen.getByText('Select at least one subject.')).toBeTruthy();
  subjects('Other');
  fireEvent.press(screen.getByLabelText('Submit request'));
  expect(
    screen.getByText('Enter the custom subject when "Other" is selected.'),
  ).toBeTruthy();
  expect(mockSubmit).not.toHaveBeenCalled();
});
it('submits the same authenticated request contract with all selected students and subjects', async () => {
  render(<ClassRequestSheet {...props} />);
  fireEvent.press(screen.getByLabelText('Select students'));
  fireEvent.press(screen.getByLabelText('Child Two'));
  fireEvent.press(screen.getByLabelText('Done selecting'));
  subjects('Math', 'Other');
  fireEvent.changeText(screen.getByLabelText('Other subject'), ' Robotics ');
  fireEvent.changeText(screen.getByLabelText('Learning goals'), ' Fractions ');
  fireEvent.changeText(screen.getByLabelText('Special requirements'), ' Captions ');
  fireEvent.press(screen.getByLabelText('Submit request'));
  await waitFor(() => expect(mockCreated).toHaveBeenCalledWith('request-1'));
  expect(mockSubmit).toHaveBeenCalledWith({
    requestIntent: 'ongoing-tutoring',
    studentProfileIds: ['child-1', 'child-2'],
    subjects: ['Math', 'Other'],
    otherSubject: 'Robotics',
    learningGoals: 'Fractions',
    specialRequirements: 'Captions',
  });
  expect(mockClose).toHaveBeenCalledTimes(1);
});
it('retains edits after failure and supports retry', async () => {
  mockSubmit.mockRejectedValueOnce(new Error('Please try again.'));
  render(<ClassRequestSheet {...props} />);
  subjects('Math');
  fireEvent.changeText(screen.getByLabelText('Learning goals'), 'Fractions');
  fireEvent.press(screen.getByLabelText('Submit request'));
  await screen.findByText('Please try again.');
  expect(screen.getByLabelText('Learning goals').props.value).toBe('Fractions');
  expect(mockClose).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText('Submit request'));
  await waitFor(() => expect(mockCreated).toHaveBeenCalledWith('request-1'));
});
it('guards double submissions and cannot close while submitting', async () => {
  let resolve!: (value: { channelId: string }) => void;
  mockSubmit.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(<ClassRequestSheet {...props} />);
  subjects('Math');
  fireEvent.press(screen.getByLabelText('Submit request'));
  fireEvent.press(screen.getByLabelText('Submit request'));
  fireEvent.press(screen.getByLabelText('Close class request'));
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockClose).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Select students').props.accessibilityState.disabled).toBe(
    true,
  );
  await act(async () => resolve({ channelId: 'request-1' }));
});
it('resets after closing and does not create a request on cancel', () => {
  const view = render(<ClassRequestSheet {...props} />);
  subjects('Math');
  fireEvent.changeText(screen.getByLabelText('Learning goals'), 'Draft');
  fireEvent.press(screen.getByLabelText('Close class request'));
  expect(mockSubmit).not.toHaveBeenCalled();
  view.rerender(<ClassRequestSheet {...props} visible={false} />);
  view.rerender(<ClassRequestSheet {...props} />);
  expect(screen.getByLabelText('Select subjects').props.accessibilityValue.text).toBe(
    'Choose subjects',
  );
  expect(screen.getByLabelText('Learning goals').props.value).toBe('');
});

it('does not send a stale custom subject when Other is deselected', async () => {
  render(<ClassRequestSheet {...props} />);
  subjects('Other');
  fireEvent.changeText(screen.getByLabelText('Other subject'), 'Robotics');
  subjects('Other', 'Math');
  fireEvent.press(screen.getByLabelText('Submit request'));
  await waitFor(() => expect(mockCreated).toHaveBeenCalled());
  expect(mockSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ subjects: ['Math'], otherSubject: null }),
  );
});
it('does not navigate after an in-flight request completes on an unmounted screen', async () => {
  let resolve!: (value: { channelId: string }) => void;
  mockSubmit.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const view = render(<ClassRequestSheet {...props} />);
  subjects('Math');
  fireEvent.press(screen.getByLabelText('Submit request'));
  view.unmount();
  await act(async () => resolve({ channelId: 'request-1' }));
  expect(mockCreated).not.toHaveBeenCalled();
  expect(mockClose).not.toHaveBeenCalled();
});

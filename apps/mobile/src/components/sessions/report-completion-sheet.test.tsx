import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { SessionCompletionVM } from '@iconicedu/shared-types';
import { lightColors } from '@/lib/theme';

const mockReport = jest.fn();
jest.mock('@/lib/api/session-completions', () => ({
  reportSessionCompletion: (...args: unknown[]) => mockReport(...args),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@iconicedu/ui-native', () => ({
  BottomSheet: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? children : null),
}));

import { ReportCompletionSheet } from './report-completion-sheet';

const completion = { id: 'c-1', orgId: 'org-1' } as SessionCompletionVM;

beforeEach(() => mockReport.mockReset());

it('submits the chosen category and trimmed details, then reports back', async () => {
  mockReport.mockResolvedValue({ success: true });
  const onReported = jest.fn();
  const screen = render(
    <ReportCompletionSheet
      completion={completion}
      confirmedBy="staff"
      colors={lightColors}
      onClose={jest.fn()}
      onReported={onReported}
    />,
  );

  expect(screen.getByText(/Staff marked this session as complete for you/)).toBeTruthy();
  expect(screen.getByLabelText('Submit report')).toBeDisabled();

  fireEvent.press(screen.getByLabelText('Session did not happen'));
  fireEvent.changeText(screen.getByLabelText('Report details'), '  Tutor never joined  ');
  fireEvent.press(screen.getByLabelText('Submit report'));

  await waitFor(() => expect(onReported).toHaveBeenCalledWith('c-1'));
  expect(mockReport).toHaveBeenCalledWith({
    orgId: 'org-1',
    sessionCompletionId: 'c-1',
    reportCategory: 'did_not_happen',
    reportReason: 'Tutor never joined',
  });
});

it('explains auto-confirmation and shows the API error when submitting fails', async () => {
  mockReport.mockRejectedValue(new Error("You've already reported this session."));
  const onReported = jest.fn();
  const screen = render(
    <ReportCompletionSheet
      completion={completion}
      confirmedBy="system"
      colors={lightColors}
      onClose={jest.fn()}
      onReported={onReported}
    />,
  );

  expect(screen.getByText(/marked complete automatically/)).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Other'));
  fireEvent.press(screen.getByLabelText('Submit report'));

  expect(await screen.findByText("You've already reported this session.")).toBeTruthy();
  expect(onReported).not.toHaveBeenCalled();
});

it('renders nothing without a session to report', () => {
  const screen = render(
    <ReportCompletionSheet
      completion={null}
      confirmedBy={null}
      colors={lightColors}
      onClose={jest.fn()}
      onReported={jest.fn()}
    />,
  );

  expect(screen.queryByText('Report this session')).toBeNull();
});

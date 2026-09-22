import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AiRefineSheet } from './ai-refine-sheet';

const mockRefineDraftWithAi = jest.fn();

jest.mock('@/lib/api/messages/queries', () => ({
  refineDraftWithAi: (...args: unknown[]) => mockRefineDraftWithAi(...args),
}));

jest.mock('@/lib/analytics/report-error', () => ({
  reportMobileObservedError: jest.fn(),
}));

describe('AiRefineSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseProps = {
    visible: true,
    draftText: 'hey can u send me the notes from today',
    orgId: 'org-1',
    channelId: 'channel-1',
    profileId: 'profile-1',
  };

  it('renders the instruction picker with all options', () => {
    render(<AiRefineSheet {...baseProps} onClose={jest.fn()} onReplace={jest.fn()} />);

    expect(screen.getByLabelText('Proofread')).toBeTruthy();
    expect(screen.getByLabelText('Make clearer')).toBeTruthy();
    expect(screen.getByLabelText('Make shorter')).toBeTruthy();
    expect(screen.getByLabelText('Warmer tone')).toBeTruthy();
    expect(screen.getByLabelText('More professional')).toBeTruthy();
    expect(screen.getByLabelText('Translate')).toBeTruthy();
    expect(screen.getByLabelText('Custom')).toBeTruthy();
  });

  it('invokes refine immediately for a direct instruction and shows a loading state', async () => {
    let resolveRefine: (value: unknown) => void = () => {};
    mockRefineDraftWithAi.mockReturnValue(
      new Promise((resolve) => {
        resolveRefine = resolve;
      }),
    );

    render(<AiRefineSheet {...baseProps} onClose={jest.fn()} onReplace={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Proofread'));

    expect(mockRefineDraftWithAi).toHaveBeenCalledWith({
      orgId: 'org-1',
      channelId: 'channel-1',
      profileId: 'profile-1',
      content: baseProps.draftText,
      instruction: 'proofread',
      customInstruction: undefined,
      targetLanguage: undefined,
    });
    expect(screen.getByText('Refining your draft…')).toBeTruthy();

    resolveRefine({
      refinedText: 'Hey, could you send me today’s notes?',
      factsPreserved: true,
    });

    await waitFor(() => {
      expect(screen.getByText('Hey, could you send me today’s notes?')).toBeTruthy();
    });
  });

  it('prompts for a target language before invoking translate', async () => {
    mockRefineDraftWithAi.mockResolvedValue({
      refinedText: 'Hola, ¿puedes enviarme las notas de hoy?',
      factsPreserved: true,
    });

    render(<AiRefineSheet {...baseProps} onClose={jest.fn()} onReplace={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Translate'));

    expect(mockRefineDraftWithAi).not.toHaveBeenCalled();
    const languageInput = screen.getByLabelText('Target language');
    fireEvent.changeText(languageInput, 'Spanish');
    fireEvent.press(screen.getByLabelText('Continue'));

    await waitFor(() => {
      expect(mockRefineDraftWithAi).toHaveBeenCalledWith(
        expect.objectContaining({ instruction: 'translate', targetLanguage: 'Spanish' }),
      );
    });
  });

  it('caps the custom instruction input at 500 characters', () => {
    render(<AiRefineSheet {...baseProps} onClose={jest.fn()} onReplace={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Custom'));

    const input = screen.getByLabelText('Custom instructions');
    fireEvent.changeText(input, 'a'.repeat(600));

    expect(input.props.value).toHaveLength(500);
    expect(screen.getByText('500/500')).toBeTruthy();
  });

  it('surfaces flaggedNotes as a warning when factsPreserved is false, without blocking Replace', async () => {
    mockRefineDraftWithAi.mockResolvedValue({
      refinedText: 'See you at 3pm.',
      factsPreserved: false,
      flaggedNotes: ['Original time (2pm) may have changed'],
    });
    const onReplace = jest.fn();

    render(<AiRefineSheet {...baseProps} onClose={jest.fn()} onReplace={onReplace} />);
    fireEvent.press(screen.getByLabelText('Make clearer'));

    await waitFor(() => {
      expect(screen.getByText('Double-check before sending')).toBeTruthy();
    });
    expect(screen.getByText('• Original time (2pm) may have changed')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Replace'));
    expect(onReplace).toHaveBeenCalledWith('See you at 3pm.');
  });

  it('shows the thrown error message and lets the user try again', async () => {
    mockRefineDraftWithAi.mockRejectedValueOnce(
      new Error('Daily refine limit reached. Try again tomorrow.'),
    );
    mockRefineDraftWithAi.mockResolvedValueOnce({
      refinedText: 'Fixed draft.',
      factsPreserved: true,
    });

    render(<AiRefineSheet {...baseProps} onClose={jest.fn()} onReplace={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Proofread'));

    await waitFor(() => {
      expect(
        screen.getByText('Daily refine limit reached. Try again tomorrow.'),
      ).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Try again'));

    await waitFor(() => {
      expect(screen.getByText('Fixed draft.')).toBeTruthy();
    });
    expect(mockRefineDraftWithAi).toHaveBeenCalledTimes(2);
  });

  it('dismisses without changes when "Keep original" is pressed', async () => {
    mockRefineDraftWithAi.mockResolvedValue({
      refinedText: 'Fixed draft.',
      factsPreserved: true,
    });
    const onClose = jest.fn();
    const onReplace = jest.fn();

    render(<AiRefineSheet {...baseProps} onClose={onClose} onReplace={onReplace} />);
    fireEvent.press(screen.getByLabelText('Proofread'));

    await waitFor(() => {
      expect(screen.getByLabelText('Keep original')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Keep original'));

    expect(onClose).toHaveBeenCalled();
    expect(onReplace).not.toHaveBeenCalled();
  });
});

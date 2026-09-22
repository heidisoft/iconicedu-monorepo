import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MessageInput } from './message-input';

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

// DropdownMenu is mocked the same way the rest of this codebase mocks Radix menu
// primitives in tests (see nav-user.test.tsx): a lightweight passthrough that keeps the
// controlled open/onOpenChange contract without relying on Radix's pointer-capture
// behavior in jsdom.
vi.mock('@iconicedu/ui-web/ui/dropdown-menu', () => {
  const ReactLib = require('react');
  const OpenChangeContext = ReactLib.createContext<((open: boolean) => void) | undefined>(
    undefined,
  );

  const DropdownMenu = ({
    children,
    onOpenChange,
  }: {
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    ReactLib.createElement(OpenChangeContext.Provider, { value: onOpenChange }, children);

  const DropdownMenuTrigger = ({ children }: { children: React.ReactElement }) => {
    const onOpenChange = ReactLib.useContext(OpenChangeContext);
    return ReactLib.cloneElement(children, {
      onClick: (event: unknown) => {
        children.props.onClick?.(event);
        onOpenChange?.(true);
      },
    });
  };

  const passthrough = ({ children, ...props }: { children?: React.ReactNode }) =>
    ReactLib.createElement('div', props, children);

  const DropdownMenuItem = ({
    children,
    onSelect,
    ...props
  }: {
    children?: React.ReactNode;
    onSelect?: (event: Event) => void;
  }) =>
    ReactLib.createElement(
      'button',
      {
        type: 'button',
        ...props,
        onClick: () => {
          onSelect?.({ preventDefault: () => undefined } as unknown as Event);
        },
      },
      children,
    );

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent: passthrough,
    DropdownMenuItem,
    DropdownMenuLabel: passthrough,
    DropdownMenuSeparator: passthrough,
  };
});

// Dialog is mocked to a simple open-gated passthrough so the AI-refine preview/step
// content can be asserted directly without exercising Radix's portal + focus-trap
// machinery in jsdom.
vi.mock('@iconicedu/ui-web/ui/dialog', () => {
  const ReactLib = require('react');
  const passthrough = ({ children, ...props }: { children?: React.ReactNode }) =>
    ReactLib.createElement('div', props, children);

  return {
    Dialog: ({ children, open }: { children?: React.ReactNode; open?: boolean }) =>
      open ? ReactLib.createElement('div', null, children) : null,
    DialogContent: passthrough,
    DialogHeader: passthrough,
    DialogTitle: passthrough,
    DialogDescription: passthrough,
    DialogFooter: passthrough,
  };
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function deferredResponse() {
  let resolve!: (body: unknown) => void;
  const promise = new Promise<Response>((res) => {
    resolve = (body: unknown) => res(jsonResponse(body));
  });
  return { promise, resolve };
}

const REFINE_TRIGGER_LABEL = 'Refine with AI';
const SUGGESTED_REPLIES_LABEL = 'Suggested replies';
const DRAFT_LONG_ENOUGH = 'This draft could use a little polish before sending.';

async function typeContent(user: ReturnType<typeof userEvent.setup>, value: string) {
  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
  await user.clear(textarea);
  await user.type(textarea, value);
  return textarea;
}

describe('MessageInput AI-assist affordances', () => {
  beforeEach(() => {
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('does not render either AI affordance when both flags are false', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={vi.fn()} channelId="channel-1" />);

    await typeContent(user, DRAFT_LONG_ENOUGH);

    expect(screen.queryByLabelText(REFINE_TRIGGER_LABEL)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(SUGGESTED_REPLIES_LABEL)).not.toBeInTheDocument();
  });

  it('only shows the refine trigger once the draft passes the length threshold', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={vi.fn()} channelId="channel-1" showAiRefine />);

    expect(screen.queryByLabelText(REFINE_TRIGGER_LABEL)).not.toBeInTheDocument();

    await typeContent(user, 'too short');
    expect(screen.queryByLabelText(REFINE_TRIGGER_LABEL)).not.toBeInTheDocument();

    await typeContent(user, DRAFT_LONG_ENOUGH);
    expect(screen.getByLabelText(REFINE_TRIGGER_LABEL)).toBeInTheDocument();
  });

  it('runs the refine flow end to end: invoke, pick instruction, preview, replace, undo', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        refinedText: 'This draft has been polished by AI.',
        factsPreserved: true,
      }),
    );

    render(<MessageInput onSend={vi.fn()} channelId="channel-1" showAiRefine />);
    const textarea = await typeContent(user, DRAFT_LONG_ENOUGH);

    await user.click(screen.getByLabelText(REFINE_TRIGGER_LABEL));
    await user.click(screen.getByText('Proofread'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/ai-assist/refine',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"instruction":"proofread"'),
        }),
      );
    });
    const [, requestInit] = vi.mocked(fetch).mock.calls[0]!;
    const requestBody = JSON.parse(requestInit!.body as string);
    expect(requestBody.channelId).toBe('channel-1');
    expect(requestBody.content).toBe(DRAFT_LONG_ENOUGH);
    expect(requestBody.selectionStart).toBeUndefined();
    expect(requestBody.selectionEnd).toBeUndefined();

    expect(
      await screen.findByText('This draft has been polished by AI.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Replace' }));

    expect(textarea.value).toBe('This draft has been polished by AI.');
    expect(toastSuccessMock).toHaveBeenCalledTimes(1);

    const [, toastOptions] = toastSuccessMock.mock.calls[0]!;
    act(() => {
      toastOptions.action.onClick();
    });

    expect(textarea.value).toBe(DRAFT_LONG_ENOUGH);
  });

  it('surfaces flaggedNotes prominently when factsPreserved is false', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        success: true,
        refinedText: 'Refined text missing a detail.',
        factsPreserved: false,
        flaggedNotes: ['Removed the mentioned phone number'],
      }),
    );

    render(<MessageInput onSend={vi.fn()} channelId="channel-1" showAiRefine />);
    await typeContent(user, DRAFT_LONG_ENOUGH);

    await user.click(screen.getByLabelText(REFINE_TRIGGER_LABEL));
    await user.click(screen.getByText('Proofread'));

    expect(await screen.findByText('This may have changed:')).toBeInTheDocument();
    expect(screen.getByText('Removed the mentioned phone number')).toBeInTheDocument();
  });

  it('shows a toast with the server message when refine fails', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: false, message: 'Daily AI limit reached' }),
    );

    render(<MessageInput onSend={vi.fn()} channelId="channel-1" showAiRefine />);
    await typeContent(user, DRAFT_LONG_ENOUGH);

    await user.click(screen.getByLabelText(REFINE_TRIGGER_LABEL));
    await user.click(screen.getByText('Proofread'));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Daily AI limit reached');
    });
  });

  it('runs the suggested-replies flow: invoke, loading, chips, insert without sending', async () => {
    const user = userEvent.setup();
    const { promise, resolve } = deferredResponse();
    vi.mocked(fetch).mockReturnValueOnce(promise);
    const onSend = vi.fn();

    render(<MessageInput onSend={onSend} channelId="channel-1" showAiSuggestedReplies />);

    const trigger = screen.getByLabelText(SUGGESTED_REPLIES_LABEL);
    await user.click(trigger);

    await waitFor(() => expect(trigger).toBeDisabled());

    resolve({
      success: true,
      suggestions: ['Sounds good, thank you!', 'Let me check and get back to you.'],
    });

    expect(await screen.findByText('Sounds good, thank you!')).toBeInTheDocument();
    expect(screen.getByText('Let me check and get back to you.')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/ai-assist/suggested-replies',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ channelId: 'channel-1' }),
      }),
    );

    await user.click(screen.getByText('Sounds good, thank you!'));

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Sounds good, thank you!');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('renders a subtle empty state instead of an error for an empty suggestions array', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: true, suggestions: [] }),
    );

    render(
      <MessageInput onSend={vi.fn()} channelId="channel-1" showAiSuggestedReplies />,
    );

    await user.click(screen.getByLabelText(SUGGESTED_REPLIES_LABEL));

    expect(await screen.findByText('No suggestions right now.')).toBeInTheDocument();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('shows a toast with the server message when suggested replies fail', async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: false, message: 'AI assist is not available' }),
    );

    render(
      <MessageInput onSend={vi.fn()} channelId="channel-1" showAiSuggestedReplies />,
    );

    await user.click(screen.getByLabelText(SUGGESTED_REPLIES_LABEL));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('AI assist is not available');
    });
  });
});

/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserProfileVM } from '@iconicedu/shared-types';

import { MESSAGE_INPUT_FILE_ACCEPT } from './message-input.attachments';
import { buildAssignmentDraftFromContent, MessageInput } from './message-input';
import {
  getMentionCandidates,
  getMentionPopupPosition,
  getMentionState,
  matchesMentionQuery,
} from './message-input.utils';
import { readMessageDraft } from './message-draft-store';

function createParticipant(
  overrides: Partial<UserProfileVM> & { ids?: Partial<UserProfileVM['ids']> } = {},
) {
  return {
    kind: 'guardian',
    ids: {
      id: 'user-1',
      orgId: 'org-1',
      accountId: 'account-1',
      ...(overrides.ids ?? {}),
    },
    profile: {
      displayName: 'Alex Johnson',
      firstName: 'Alex',
      lastName: 'Johnson',
      email: 'iconicedudev+alex@gmail.com',
      avatar: null,
      ...(overrides.profile ?? {}),
    },
    prefs: {},
    meta: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    accountEmail: 'iconicedudev+alex@gmail.com',
    ...(overrides as Omit<UserProfileVM, 'ids' | 'profile'>),
  } as UserProfileVM;
}

describe('message-input mention helpers', () => {
  it('detects a mention query at the start of the message', () => {
    expect(getMentionState('@alex hi', 5)).toEqual({
      query: 'alex',
      start: 0,
      end: 5,
    });
  });

  it('detects a mention query at the cursor', () => {
    expect(getMentionState('Hello @tay', 10)).toEqual({
      query: 'tay',
      start: 6,
      end: 10,
    });
  });

  it('returns null when the cursor is not in a mention token', () => {
    expect(getMentionState('hello there', 11)).toBeNull();
    expect(getMentionState('email@test.com', 14)).toBeNull();
  });

  it('builds mention candidates without the current user', () => {
    const self = createParticipant({
      ids: { id: 'self' },
      profile: {
        displayName: 'Myself',
        firstName: 'My',
        lastName: 'Self',
        email: 'iconicedudev+me@gmail.com',
      },
      accountEmail: 'iconicedudev+me@gmail.com',
    });
    const other = createParticipant({
      ids: { id: 'other' },
      profile: {
        displayName: 'Taylor Reed',
        firstName: 'Taylor',
        lastName: 'Reed',
        email: 'iconicedudev+taylor@gmail.com',
      },
      accountEmail: 'iconicedudev+taylor@gmail.com',
    });

    expect(getMentionCandidates([self, other], 'self')).toEqual([
      {
        id: 'other',
        displayName: 'Taylor Reed',
        fullName: 'Taylor Reed',
        email: 'iconicedudev+taylor@gmail.com',
        avatarUrl: undefined,
      },
    ]);
  });

  it('matches a mention query against name and email', () => {
    const candidate = getMentionCandidates(
      [
        createParticipant({
          ids: { id: 'other' },
          profile: {
            displayName: 'Taylor Reed',
            firstName: 'Taylor',
            lastName: 'Reed',
            email: 'iconicedudev+taylor@gmail.com',
          },
          accountEmail: 'iconicedudev+taylor@gmail.com',
        }),
      ],
      'self',
    )[0];

    expect(matchesMentionQuery(candidate, 'tay')).toBe(true);
    expect(matchesMentionQuery(candidate, 'reed')).toBe(true);
    expect(matchesMentionQuery(candidate, 'gmail')).toBe(true);
    expect(matchesMentionQuery(candidate, 'alex')).toBe(false);
  });

  it('positions the popup from the caret location inside the textarea', () => {
    const wrapper = document.createElement('div');
    const textarea = document.createElement('textarea');
    textarea.value = '@tay';

    Object.defineProperty(textarea, 'clientWidth', {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(textarea, 'scrollLeft', {
      configurable: true,
      value: 0,
    });
    Object.defineProperty(textarea, 'scrollTop', {
      configurable: true,
      value: 0,
    });

    wrapper.getBoundingClientRect = () =>
      ({
        left: 20,
        top: 40,
        width: 360,
        height: 120,
        right: 380,
        bottom: 160,
        x: 20,
        y: 40,
        toJSON: () => ({}),
      }) as DOMRect;
    textarea.getBoundingClientRect = () =>
      ({
        left: 32,
        top: 52,
        width: 320,
        height: 80,
        right: 352,
        bottom: 132,
        x: 32,
        y: 52,
        toJSON: () => ({}),
      }) as DOMRect;

    const originalCreateElement = document.createElement.bind(document);

    const marker = {
      offsetLeft: 48,
      offsetTop: 24,
      textContent: '',
    } as unknown as HTMLSpanElement;

    const computedStyleSpy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      boxSizing: 'border-box',
      font: '16px sans-serif',
      fontFamily: 'sans-serif',
      fontSize: '16px',
      fontWeight: '400',
      fontStyle: 'normal',
      letterSpacing: '0px',
      lineHeight: '20px',
      padding: '8px 12px',
      border: '0px',
      textTransform: 'none',
      textIndent: '0px',
      tabSize: '4',
    } as CSSStyleDeclaration);

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
    ) => {
      if (tagName === 'div') {
        return {
          style: {},
          textContent: '',
          appendChild: vi.fn(),
        } as unknown as HTMLDivElement;
      }

      if (tagName === 'span') {
        return marker;
      }

      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    const appendSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);
    const removeSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node);

    const position = getMentionPopupPosition(wrapper, textarea, 4);

    expect(position).toEqual({
      left: 60,
      top: 62,
      maxWidth: 284,
    });

    appendSpy.mockRestore();
    removeSpy.mockRestore();
    computedStyleSpy.mockRestore();
    createElementSpy.mockRestore();
  });

  it('clamps the popup left position to keep a small left gutter', () => {
    const wrapper = document.createElement('div');
    const textarea = document.createElement('textarea');
    const originalCreateElement = document.createElement.bind(document);
    textarea.value = '@a';

    Object.defineProperty(textarea, 'clientWidth', {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(textarea, 'scrollLeft', {
      configurable: true,
      value: 50,
    });
    Object.defineProperty(textarea, 'scrollTop', {
      configurable: true,
      value: 0,
    });

    wrapper.getBoundingClientRect = () =>
      ({
        left: 20,
        top: 40,
        width: 360,
        height: 120,
        right: 380,
        bottom: 160,
        x: 20,
        y: 40,
        toJSON: () => ({}),
      }) as DOMRect;
    textarea.getBoundingClientRect = () =>
      ({
        left: 32,
        top: 52,
        width: 320,
        height: 80,
        right: 352,
        bottom: 132,
        x: 32,
        y: 52,
        toJSON: () => ({}),
      }) as DOMRect;

    const marker = {
      offsetLeft: 10,
      offsetTop: 24,
      textContent: '',
    } as unknown as HTMLSpanElement;

    const computedStyleSpy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      boxSizing: 'border-box',
      font: '16px sans-serif',
      fontFamily: 'sans-serif',
      fontSize: '16px',
      fontWeight: '400',
      fontStyle: 'normal',
      letterSpacing: '0px',
      lineHeight: '20px',
      padding: '8px 12px',
      border: '0px',
      textTransform: 'none',
      textIndent: '0px',
      tabSize: '4',
    } as CSSStyleDeclaration);

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
    ) => {
      if (tagName === 'div') {
        return {
          style: {},
          textContent: '',
          appendChild: vi.fn(),
        } as unknown as HTMLDivElement;
      }

      if (tagName === 'span') {
        return marker;
      }

      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    const appendSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);
    const removeSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node);

    const position = getMentionPopupPosition(wrapper, textarea, 2);

    expect(position?.left).toBe(12);

    appendSpy.mockRestore();
    removeSpy.mockRestore();
    computedStyleSpy.mockRestore();
    createElementSpy.mockRestore();
  });

  it('accepts common document and archive file types for attachments', () => {
    expect(MESSAGE_INPUT_FILE_ACCEPT).toContain('.pdf');
    expect(MESSAGE_INPUT_FILE_ACCEPT).toContain('.docx');
    expect(MESSAGE_INPUT_FILE_ACCEPT).toContain('.xlsx');
    expect(MESSAGE_INPUT_FILE_ACCEPT).toContain('.pptx');
    expect(MESSAGE_INPUT_FILE_ACCEPT).toContain('.zip');
  });

  it('builds assignment drafts for homework and lesson composer flows', () => {
    const content =
      'Fractions Practice Set\nFocus on equivalent fractions and number lines.';

    expect(buildAssignmentDraftFromContent('homework', content)).toMatchObject({
      kind: 'homework',
      title: 'Fractions Practice Set',
      description:
        'Fractions Practice Set\nFocus on equivalent fractions and number lines.',
      message: 'Fractions Practice Set\nFocus on equivalent fractions and number lines.',
      subject: '',
    });

    expect(buildAssignmentDraftFromContent('lesson', '')).toMatchObject({
      kind: 'lesson',
      title: 'Lesson assignment',
      description: '',
      message: '',
      subject: '',
    });
  });
});

const draftScope = {
  accountId: 'account-1',
  profileId: 'user-1',
  orgId: 'org-1',
  channelId: 'channel-1',
  threadId: null,
};

describe('MessageInput drafts and send reliability', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('never touches localStorage when enableMessageDrafts is off', async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSend={vi.fn()}
        draftScope={draftScope}
        enableMessageDrafts={false}
      />,
    );

    await user.type(screen.getByPlaceholderText('Write a message...'), 'unsaved text');

    expect(readMessageDraft(draftScope)).toBeNull();
    expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
  });

  it('autosaves the composer text as a draft after the debounce window', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSend={vi.fn()} draftScope={draftScope} enableMessageDrafts />);

    await user.type(
      screen.getByPlaceholderText('Write a message...'),
      'Hi there, quick question',
    );

    await waitFor(
      () => {
        expect(readMessageDraft(draftScope)?.content).toBe('Hi there, quick question');
      },
      { timeout: 2000 },
    );
    await screen.findByText('Draft saved');
  });

  it('restores a saved draft into the composer on mount', async () => {
    window.localStorage.setItem(
      'message-draft:account-1:user-1:org-1:channel-1:main',
      JSON.stringify({
        version: 1,
        ...draftScope,
        content: 'Restored draft text',
        updatedAt: new Date().toISOString(),
      }),
    );

    render(<MessageInput onSend={vi.fn()} draftScope={draftScope} enableMessageDrafts />);

    expect(await screen.findByDisplayValue('Restored draft text')).toBeInTheDocument();
    expect(await screen.findByText('Draft restored')).toBeInTheDocument();
  });

  it('clears the draft after a successful send', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageInput onSend={onSend} draftScope={draftScope} enableMessageDrafts />);

    const textarea = screen.getByPlaceholderText('Write a message...');
    await user.type(textarea, 'Message to send');
    await waitFor(() => {
      expect(readMessageDraft(draftScope)).not.toBeNull();
    });

    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalled();
    });
    expect(readMessageDraft(draftScope)).toBeNull();
  });

  it('keeps the draft when the send fails, so nothing typed is lost', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValue(new Error('network error'));
    render(<MessageInput onSend={onSend} draftScope={draftScope} enableMessageDrafts />);

    const textarea = screen.getByPlaceholderText('Write a message...');
    await user.type(textarea, 'Will fail to send');
    await waitFor(() => {
      expect(readMessageDraft(draftScope)).not.toBeNull();
    });

    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalled();
    });
    // Composer content (and therefore the draft) survives a failed send.
    expect(readMessageDraft(draftScope)?.content).toBe('Will fail to send');
    expect(screen.getByDisplayValue('Will fail to send')).toBeInTheDocument();
  });

  it('generates a clientMessageId and passes it to onSend when reliability is enabled', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageInput onSend={onSend} enableMessageSendReliability />);

    await user.type(screen.getByPlaceholderText('Write a message...'), 'Reliable send');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('Reliable send', [], null, expect.any(String));
    });
  });

  it('does not pass a clientMessageId when reliability is disabled (default)', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<MessageInput onSend={onSend} />);

    await user.type(screen.getByPlaceholderText('Write a message...'), 'Plain send');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('Plain send', [], null, undefined);
    });
  });

  it('reuses the same clientMessageId when retrying the same failed text send', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValue(new Error('network blip'));
    render(<MessageInput onSend={onSend} enableMessageSendReliability />);

    await user.type(screen.getByPlaceholderText('Write a message...'), 'Retry me');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));

    // Composer content survived the failure — press Send again without
    // editing it, simulating a retry after an ambiguous failure.
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));

    const firstId = onSend.mock.calls[0]![3];
    const secondId = onSend.mock.calls[1]![3];
    expect(firstId).toEqual(expect.any(String));
    expect(secondId).toBe(firstId);
  });

  it('generates a fresh clientMessageId once the retried content changes', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValueOnce(new Error('network blip'));
    onSend.mockResolvedValueOnce(undefined);
    render(<MessageInput onSend={onSend} enableMessageSendReliability />);

    const textarea = screen.getByPlaceholderText('Write a message...');
    await user.type(textarea, 'Original');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));

    await user.type(textarea, ' edited');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));

    const firstId = onSend.mock.calls[0]![3];
    const secondId = onSend.mock.calls[1]![3];
    expect(secondId).not.toBe(firstId);
  });
});

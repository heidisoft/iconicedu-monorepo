/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserProfileVM } from '@iconicedu/shared-types';

import { MESSAGE_INPUT_FILE_ACCEPT } from './message-input.attachments';
import { buildAssignmentDraftFromContent, MessageInput } from './message-input';
import { MessageSendRejectedError } from './message-send-rejected-error';
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

describe('MessageInput audience selection', () => {
  it.each(['staff', 'educator'] as const)(
    '%s can select one exact parent, then send to everyone after reset',
    async (kind) => {
      const user = userEvent.setup();
      const onSend = vi.fn().mockResolvedValue(undefined);
      const self = createParticipant({ kind, ids: { id: 'sender' } });
      const first = createParticipant({
        ids: { id: 'parent-A' },
        profile: { ...createParticipant().profile, displayName: 'Parent Alpha' },
      });
      const second = createParticipant({
        ids: { id: 'parent-B' },
        profile: { ...createParticipant().profile, displayName: 'Parent Beta' },
      });
      render(
        <MessageInput
          onSend={onSend}
          participants={[self, first, second]}
          audienceParticipants={[self, first, second]}
          currentUserId="sender"
        />,
      );
      await user.click(screen.getByRole('button', { name: /Message audience:/i }));
      expect(screen.queryByRole('menuitemcheckbox', { name: /Alex Johnson/ })).toBeNull();
      await user.click(screen.getByRole('menuitemcheckbox', { name: /Parent Alpha/ }));
      await user.keyboard('{Escape}');
      await user.type(screen.getByPlaceholderText('Write a message...'), 'Private');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() =>
        expect(onSend).toHaveBeenLastCalledWith('Private', [], null, undefined, [
          'parent-A',
        ]),
      );
      await user.type(screen.getByPlaceholderText('Write a message...'), 'Public');
      await user.click(screen.getByRole('button', { name: 'Send' }));
      await waitFor(() =>
        expect(onSend).toHaveBeenLastCalledWith('Public', [], null, undefined),
      );
    },
  );
  it('preserves the selected recipients on failure and retry', async () => {
    const user = userEvent.setup();
    const onSend = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue(undefined);
    const parent = createParticipant({ ids: { id: 'parent-1' } });
    const self = createParticipant({ kind: 'staff', ids: { id: 'sender' } });
    render(
      <MessageInput
        onSend={onSend}
        participants={[self, parent]}
        audienceParticipants={[self, parent]}
        currentUserId="sender"
      />,
    );
    await user.click(screen.getByRole('button', { name: /Message audience:/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Parent' }));
    await user.type(screen.getByPlaceholderText('Write a message...'), 'Private retry');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(screen.getByPlaceholderText('Write a message...')).toHaveValue(
      'Private retry',
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
    expect(onSend).toHaveBeenLastCalledWith('Private retry', [], null, undefined, [
      'parent-1',
    ]);
  });
  it('sends the resolved parent audience and resets to everyone', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const parent = createParticipant({ ids: { id: 'parent-1' } });
    const self = createParticipant({ kind: 'staff', ids: { id: 'staff-1' } });
    render(
      <MessageInput
        onSend={onSend}
        participants={[self, parent]}
        audienceParticipants={[self, parent]}
        currentUserId="staff-1"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Message audience:/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Parent' }));
    await user.type(screen.getByPlaceholderText('Write a message...'), 'Welcome');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(onSend).toHaveBeenCalledWith('Welcome', [], null, undefined, ['parent-1']),
    );
    expect(
      screen.getByRole('button', { name: /Everyone in this channel/i }),
    ).toBeTruthy();
  });
});

describe('MessageInput mention suggestions in private messages', () => {
  const member = (id: string, name: string, kind: 'staff' | 'educator' | 'guardian') =>
    createParticipant({
      kind,
      ids: { id },
      profile: { ...createParticipant().profile, displayName: name },
    });
  const channel = [
    member('staff-1', 'Sam Staff', 'staff'),
    member('parent-1', 'Pat Parent', 'guardian'),
    member('parent-2', 'Quinn Parent', 'guardian'),
  ];

  async function suggestionsAfterTypingAt(
    props: Partial<React.ComponentProps<typeof MessageInput>> = {},
    pickAudience?: RegExp,
  ) {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSend={vi.fn()}
        participants={channel}
        audienceParticipants={channel}
        currentUserId="staff-1"
        {...props}
      />,
    );
    if (pickAudience) {
      await user.click(screen.getByRole('button', { name: /Message audience:/i }));
      await user.click(screen.getByRole('menuitemcheckbox', { name: pickAudience }));
      await user.keyboard('{Escape}');
    }
    await user.type(screen.getByPlaceholderText('Write a message...'), '@');
    return screen.queryAllByRole('option').map((option) => option.textContent ?? '');
  }

  it('suggests every other member for an everyone message', async () => {
    const options = await suggestionsAfterTypingAt();
    expect(options.some((text) => text.includes('Pat Parent'))).toBe(true);
    expect(options.some((text) => text.includes('Quinn Parent'))).toBe(true);
  });

  it('suggests only the selected audience for a private message', async () => {
    const options = await suggestionsAfterTypingAt({}, /Pat Parent/);
    expect(options.some((text) => text.includes('Pat Parent'))).toBe(true);
    expect(options.some((text) => text.includes('Quinn Parent'))).toBe(false);
  });

  it('suggests only the inherited audience in a private thread reply', async () => {
    const options = await suggestionsAfterTypingAt({
      audienceParticipants: undefined,
      inheritedAudienceLabel: 'Pat Parent',
      inheritedAudienceProfileIds: ['staff-1', 'parent-1'],
    });
    expect(options.some((text) => text.includes('Pat Parent'))).toBe(true);
    expect(options.some((text) => text.includes('Quinn Parent'))).toBe(false);
  });
});

describe('MessageInput refused attachment sends', () => {
  it('shows the refusal reason and keeps the attachment', async () => {
    const reason = 'You cannot send private messages to students';
    const onAttachFiles = vi.fn().mockRejectedValue(new MessageSendRejectedError(reason));
    const { container } = render(
      <MessageInput
        onSend={vi.fn()}
        onAttachFiles={onAttachFiles}
        currentUserId="sender"
      />,
    );
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['x'], 'note.pdf', { type: 'application/pdf' })] },
    });
    await waitFor(() => expect(screen.getByText('note.pdf')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText(reason)).toBeTruthy());
    expect(onAttachFiles).toHaveBeenCalledTimes(1);
    expect(screen.getByText('note.pdf')).toBeTruthy();
  });
});

describe('MessageInput audience safeguarding', () => {
  const member = (id: string, kind: 'staff' | 'educator' | 'guardian' | 'child') =>
    createParticipant({
      kind,
      ids: { id },
      profile: { ...createParticipant().profile, displayName: `${kind} ${id}` },
    });
  const channel = [
    member('staff-1', 'staff'),
    member('tutor-1', 'educator'),
    member('parent-1', 'guardian'),
    member('parent-2', 'guardian'),
    member('student-1', 'child'),
    member('student-2', 'child'),
  ];

  async function openPicker(currentUserId: string) {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSend={vi.fn()}
        participants={channel}
        audienceParticipants={channel}
        currentUserId={currentUserId}
      />,
    );
    const trigger = screen.queryByRole('button', { name: /Message audience:/i });
    if (trigger) await user.click(trigger);
    return { user, trigger };
  }

  const options = () =>
    screen.queryAllByRole('menuitemcheckbox').map((item) => item.textContent ?? '');

  it('hides the audience picker from students', async () => {
    const { trigger } = await openPicker('student-1');
    expect(trigger).toBeNull();
  });

  it('shows the picker to a staff observer who is not in the participant list', async () => {
    const user = userEvent.setup();
    render(
      <MessageInput
        onSend={vi.fn()}
        participants={channel}
        audienceParticipants={channel.filter((person) => person.ids.id !== 'staff-1')}
        currentUserId="staff-1"
        currentUserKind="staff"
      />,
    );
    await user.click(screen.getByRole('button', { name: /Message audience:/i }));
    expect(screen.getAllByRole('menuitemcheckbox').length).toBeGreaterThan(0);
  });

  it("uses the sender's own kind over the participant list", async () => {
    render(
      <MessageInput
        onSend={vi.fn()}
        participants={channel}
        audienceParticipants={channel}
        currentUserId="staff-1"
        currentUserKind="child"
      />,
    );
    expect(screen.queryByRole('button', { name: /Message audience:/i })).toBeNull();
  });

  it('hides the audience picker when the sender is unknown', async () => {
    const { trigger } = await openPicker('not-in-channel');
    expect(trigger).toBeNull();
  });

  it('lets parents choose only staff and tutors', async () => {
    await openPicker('parent-1');
    const visible = options();
    expect(visible.some((text) => text.includes('staff-1'))).toBe(false);
    expect(screen.getByRole('menuitemcheckbox', { name: /^Staff/ })).toBeTruthy();
    expect(visible.some((text) => text.includes('tutor-1'))).toBe(true);
    expect(visible.some((text) => /parent-2|student-/.test(text))).toBe(false);
    expect(screen.queryByRole('menuitem', { name: /^Parents?$/ })).toBeNull();
  });

  it('lets tutors choose students and explains the parent is included', async () => {
    const { user } = await openPicker('tutor-1');
    expect(options()).toHaveLength(5);
    await user.click(screen.getByRole('menuitemcheckbox', { name: /student-1/ }));
    await user.keyboard('{Escape}');
    expect(screen.getByText(/their parent is included automatically/)).toBeTruthy();
  });

  it('lets staff choose anyone', async () => {
    await openPicker('staff-1');
    expect(options()).toHaveLength(5);
  });

  it('offers staff as one option and never lists them by name', async () => {
    const owner = member('owner-1', 'staff');
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(
      <MessageInput
        onSend={onSend}
        participants={[...channel, owner]}
        audienceParticipants={[...channel, owner]}
        currentUserId="parent-1"
      />,
    );
    await user.click(screen.getByRole('button', { name: /Message audience:/i }));
    expect(options().some((text) => /staff-1|owner-1/.test(text))).toBe(false);
    await user.click(screen.getByRole('menuitemcheckbox', { name: /^Staff/ }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Message audience: Staff' })).toBeTruthy();
    expect(screen.getByText(/Visible only to staff and you/)).toBeTruthy();

    await user.type(screen.getByPlaceholderText('Write a message...'), 'Heads up');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(onSend).toHaveBeenLastCalledWith('Heads up', [], null, undefined, [
        'staff-1',
        'owner-1',
      ]),
    );
  });

  it('combines staff with a named tutor', async () => {
    const { user } = await openPicker('parent-1');
    await user.click(screen.getByRole('menuitemcheckbox', { name: /^Staff/ }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: /tutor-1/ }));
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('button', { name: 'Message audience: Staff, educator tutor-1' }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Visible only to staff, educator tutor-1 and you/),
    ).toBeTruthy();
  });

  it('offers whole groups and single people side by side', async () => {
    const { user } = await openPicker('staff-1');
    // Two parents and two students: plural; one tutor: singular.
    expect(screen.getByRole('menuitem', { name: 'Parents' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Tutor' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Students' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Specific people' })).toBeTruthy();
    // No other staff in the channel, so no Staff option for this sender.
    expect(screen.queryByRole('menuitemcheckbox', { name: /^Staff/ })).toBeNull();

    await user.click(screen.getByRole('menuitem', { name: 'Students' }));
    expect(
      screen.getByRole('button', { name: 'Message audience: Students' }),
    ).toBeTruthy();
  });

  it('targets one person from the specific people list', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(
      <MessageInput
        onSend={onSend}
        participants={channel}
        audienceParticipants={channel}
        currentUserId="staff-1"
      />,
    );
    await user.click(screen.getByRole('button', { name: /Message audience:/i }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: /guardian parent-2/ }));
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('button', { name: 'Message audience: guardian parent-2' }),
    ).toBeTruthy();
    await user.type(screen.getByPlaceholderText('Write a message...'), 'Just you');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(onSend).toHaveBeenLastCalledWith('Just you', [], null, undefined, [
        'parent-2',
      ]),
    );
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

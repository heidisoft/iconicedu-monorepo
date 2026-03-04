import { describe, expect, it } from 'vitest';
import type { UserProfileVM } from '@iconicedu/shared-types';

import { MESSAGE_INPUT_FILE_ACCEPT } from './message-input.attachments';
import {
  buildHomeworkDraftFromContent,
  hasHomeworkTrigger,
  stripHomeworkTrigger,
} from './message-input';
import {
  getMentionCandidates,
  getMentionPopupPosition,
  getMentionState,
  matchesMentionQuery,
} from './message-input.utils';

function createParticipant(overrides: Partial<UserProfileVM> & { ids?: Partial<UserProfileVM['ids']> } = {}) {
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
      email: 'alex@example.com',
      avatar: null,
      ...(overrides.profile ?? {}),
    },
    prefs: {},
    meta: {
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    accountEmail: 'alex@example.com',
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
      profile: { displayName: 'Myself', firstName: 'My', lastName: 'Self', email: 'me@example.com' },
      accountEmail: 'me@example.com',
    });
    const other = createParticipant({
      ids: { id: 'other' },
      profile: { displayName: 'Taylor Reed', firstName: 'Taylor', lastName: 'Reed', email: 'taylor@example.com' },
      accountEmail: 'taylor@example.com',
    });

    expect(getMentionCandidates([self, other], 'self')).toEqual([
      {
        id: 'other',
        displayName: 'Taylor Reed',
        fullName: 'Taylor Reed',
        email: 'taylor@example.com',
        avatarUrl: undefined,
      },
    ]);
  });

  it('matches a mention query against name and email', () => {
    const candidate = getMentionCandidates(
      [
        createParticipant({
          ids: { id: 'other' },
          profile: { displayName: 'Taylor Reed', firstName: 'Taylor', lastName: 'Reed', email: 'taylor@example.com' },
          accountEmail: 'taylor@example.com',
        }),
      ],
      'self',
    )[0];

    expect(matchesMentionQuery(candidate, 'tay')).toBe(true);
    expect(matchesMentionQuery(candidate, 'reed')).toBe(true);
    expect(matchesMentionQuery(candidate, 'example')).toBe(true);
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
      ({ left: 20, top: 40, width: 360, height: 120, right: 380, bottom: 160, x: 20, y: 40, toJSON: () => ({}) }) as DOMRect;
    textarea.getBoundingClientRect = () =>
      ({ left: 32, top: 52, width: 320, height: 80, right: 352, bottom: 132, x: 32, y: 52, toJSON: () => ({}) }) as DOMRect;

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

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
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

    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

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
      ({ left: 20, top: 40, width: 360, height: 120, right: 380, bottom: 160, x: 20, y: 40, toJSON: () => ({}) }) as DOMRect;
    textarea.getBoundingClientRect = () =>
      ({ left: 32, top: 52, width: 320, height: 80, right: 352, bottom: 132, x: 32, y: 52, toJSON: () => ({}) }) as DOMRect;

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

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
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

    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

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

  it('detects the homework trigger and builds a structured draft from content', () => {
    const content =
      '@homework Fractions Practice Set\nFocus on equivalent fractions and number lines.';

    expect(hasHomeworkTrigger(content)).toBe(true);
    expect(stripHomeworkTrigger(content)).toBe(
      'Fractions Practice Set\nFocus on equivalent fractions and number lines.',
    );
    expect(buildHomeworkDraftFromContent(content)).toMatchObject({
      title: 'Fractions Practice Set',
      description: 'Fractions Practice Set\nFocus on equivalent fractions and number lines.',
      subject: '',
    });
  });
});

import type { UserProfileVM } from '@iconicedu/shared-types';

import { getProfileDisplayName, getProfileFullName } from '../../lib/display-name';

export type MentionState = {
  query: string;
  start: number;
  end: number;
};

export type MentionCandidate = {
  id: string;
  displayName: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
};

export type MentionPopupPosition = {
  left: number;
  top: number;
  maxWidth: number;
};

export function getMentionState(
  value: string,
  caretPosition: number | null,
): MentionState | null {
  if (caretPosition === null) return null;
  const beforeCursor = value.slice(0, caretPosition);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) return null;

  return {
    query: match[1] ?? '',
    start: caretPosition - ((match[1] ?? '').length + 1),
    end: caretPosition,
  };
}

export function getMentionCandidates(
  participants: UserProfileVM[],
  currentUserId?: string | null,
): MentionCandidate[] {
  return participants
    .filter((participant) => participant.ids.id !== currentUserId)
    .map((participant) => ({
      id: participant.ids.id,
      displayName: getProfileDisplayName(participant.profile, 'User'),
      fullName: getProfileFullName(participant.profile, 'User'),
      email: participant.accountEmail?.trim() || participant.profile.email?.trim() || '',
      avatarUrl: participant.profile.avatar?.url ?? undefined,
    }));
}

export function matchesMentionQuery(candidate: MentionCandidate, query: string): boolean {
  if (!query) return true;
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [candidate.displayName, candidate.fullName, candidate.email].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}

function getCaretCoordinates(textarea: HTMLTextAreaElement, caretPosition: number) {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const marker = document.createElement('span');
  const textBeforeCaret = textarea.value.slice(0, caretPosition);
  const textAfterCaret = textarea.value.slice(caretPosition) || '.';

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.boxSizing = computed.boxSizing;
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.font = computed.font;
  mirror.style.fontFamily = computed.fontFamily;
  mirror.style.fontSize = computed.fontSize;
  mirror.style.fontWeight = computed.fontWeight;
  mirror.style.fontStyle = computed.fontStyle;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.lineHeight = computed.lineHeight;
  mirror.style.padding = computed.padding;
  mirror.style.border = computed.border;
  mirror.style.textTransform = computed.textTransform;
  mirror.style.textIndent = computed.textIndent;
  mirror.style.tabSize = computed.tabSize;

  mirror.textContent = textBeforeCaret;
  marker.textContent = textAfterCaret;
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const left = marker.offsetLeft - textarea.scrollLeft;
  const top = marker.offsetTop - textarea.scrollTop;
  const lineHeight = Number.parseFloat(computed.lineHeight) || Number.parseFloat(computed.fontSize) || 16;

  document.body.removeChild(mirror);

  return { left, top, lineHeight };
}

export function getMentionPopupPosition(
  wrapper: HTMLElement | null,
  textarea: HTMLTextAreaElement | null,
  caretPosition: number | null,
): MentionPopupPosition | null {
  if (!wrapper || !textarea || caretPosition === null) {
    return null;
  }

  const wrapperRect = wrapper.getBoundingClientRect();
  const textareaRect = textarea.getBoundingClientRect();
  const caret = getCaretCoordinates(textarea, caretPosition);
  const left = textareaRect.left - wrapperRect.left + caret.left;
  const top = textareaRect.top - wrapperRect.top + caret.top + caret.lineHeight + 6;
  const maxWidth = Math.max(224, wrapperRect.width - left - 16);

  return {
    left: Math.max(12, left),
    top,
    maxWidth,
  };
}

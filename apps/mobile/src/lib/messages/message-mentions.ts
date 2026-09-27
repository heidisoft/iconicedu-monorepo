import type { MessageMentionVM } from '@iconicedu/shared-types';
import type { ChannelMemberProfileItem } from '@/lib/api/channel/queries';

/**
 * Mobile port of the web mention-authoring utilities in
 * packages/ui-web/src/components/messages/message-input.utils.ts and
 * message-mentions.utils.ts. RN has no DOM caret/selection API for a plain
 * TextInput as rich as a <textarea>, so mention detection here is driven by
 * the same before-cursor regex approach web uses, fed by RN's
 * onSelectionChange event instead of selectionStart.
 *
 * IMPORTANT: extractMentionsFromMessageText must stay behaviorally identical
 * to the web version and to the server's `sanitizeMentions` (apps/api's
 * messages.service.ts and apps/web's actions/messages.ts): a mention is only
 * valid when `content.slice(mention.start, mention.end) === '@' + displayName`
 * and the referenced profile is a real channel member.
 */

export type MentionCandidate = {
  id: string;
  displayName: string;
  role: string | null;
};

export type MentionState = {
  query: string;
  start: number;
  end: number;
};

/** Builds mention candidates from the channel member list, excluding the current user. */
export function getMentionCandidates(
  members: ChannelMemberProfileItem[] | null | undefined,
  currentProfileId?: string | null,
): MentionCandidate[] {
  if (!Array.isArray(members)) return [];
  return members
    .filter((member) => member.id !== currentProfileId)
    .map((member) => ({
      id: member.id,
      displayName: member.name,
      role: member.role,
    }))
    .filter((candidate) => candidate.displayName.trim().length > 0);
}

/**
 * Ranks candidates for a query: exact match first, then prefix match, then
 * substring match — each group alphabetical by display name.
 */
export function rankMentionCandidates(
  candidates: MentionCandidate[],
  query: string,
): MentionCandidate[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...candidates].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  const exact: MentionCandidate[] = [];
  const prefix: MentionCandidate[] = [];
  const substring: MentionCandidate[] = [];

  for (const candidate of candidates) {
    const normalizedName = candidate.displayName.toLowerCase();
    if (normalizedName === normalizedQuery) {
      exact.push(candidate);
    } else if (normalizedName.startsWith(normalizedQuery)) {
      prefix.push(candidate);
    } else if (normalizedName.includes(normalizedQuery)) {
      substring.push(candidate);
    }
  }

  const byName = (a: MentionCandidate, b: MentionCandidate) =>
    a.displayName.localeCompare(b.displayName);

  return [...exact.sort(byName), ...prefix.sort(byName), ...substring.sort(byName)];
}

/**
 * Disambiguates candidates sharing the exact same display name by appending
 * minimal role context (e.g. "Alex Chen (Tutor)") — never full email/family
 * data, matching the P0 scope for this capability.
 */
export function disambiguateMentionCandidateLabels(
  candidates: MentionCandidate[],
): Array<MentionCandidate & { label: string }> {
  const nameCounts = new Map<string, number>();
  for (const candidate of candidates) {
    nameCounts.set(
      candidate.displayName,
      (nameCounts.get(candidate.displayName) ?? 0) + 1,
    );
  }

  return candidates.map((candidate) => {
    const isDuplicate = (nameCounts.get(candidate.displayName) ?? 0) > 1;
    const label =
      isDuplicate && candidate.role
        ? `${candidate.displayName} (${candidate.role})`
        : candidate.displayName;
    return { ...candidate, label };
  });
}

/**
 * Detects an in-progress `@query` mention immediately before the caret, the
 * same way web's getMentionState does for a textarea's selectionStart.
 */
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

/**
 * Inserts `@displayName` (plus a trailing space) at the given mention range
 * and returns the new text plus the caret position right after the inserted
 * mention — mirrors selecting a suggestion in the web mention popup.
 */
export function insertMention(
  value: string,
  mentionRange: { start: number; end: number },
  displayName: string,
): { nextValue: string; caret: number } {
  const mentionText = `@${displayName} `;
  const nextValue =
    value.slice(0, mentionRange.start) + mentionText + value.slice(mentionRange.end);
  return { nextValue, caret: mentionRange.start + mentionText.length };
}

/**
 * Re-derives MessageMentionVM[] from plain text + a list of candidates,
 * scanning for `@DisplayName` substrings. This MUST match the server's
 * sanitizeMentions invariant: content.slice(start, end) === '@' + displayName,
 * and the next character (if any) must be whitespace or punctuation so a
 * mention isn't matched as a prefix of a longer word.
 */
export function extractMentionsFromMessageText(
  text: string,
  candidates: MentionCandidate[],
): MessageMentionVM[] {
  const displayNames = candidates
    .filter((candidate) => candidate.displayName.length > 0)
    .map((candidate) => ({ profileId: candidate.id, displayName: candidate.displayName }))
    // Longest display name first so "Alex Chen" doesn't get pre-empted by a
    // hypothetical shorter "Alex" candidate at the same position.
    .sort((a, b) => b.displayName.length - a.displayName.length);

  const mentions: MessageMentionVM[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const atIndex = text.indexOf('@', cursor);
    if (atIndex === -1) break;

    const previousChar = atIndex === 0 ? '' : text[atIndex - 1];
    if (previousChar && !/\s/.test(previousChar)) {
      cursor = atIndex + 1;
      continue;
    }

    const match = displayNames.find(({ displayName }) => {
      const mentionText = `@${displayName}`;
      if (!text.startsWith(mentionText, atIndex)) return false;
      const nextChar = text[atIndex + mentionText.length] ?? '';
      return nextChar === '' || /[\s.,!?;:)]/.test(nextChar);
    });

    if (!match) {
      cursor = atIndex + 1;
      continue;
    }

    const mentionText = `@${match.displayName}`;
    mentions.push({
      profileId: match.profileId,
      displayName: match.displayName,
      start: atIndex,
      end: atIndex + mentionText.length,
    });
    cursor = atIndex + mentionText.length;
  }

  return mentions;
}

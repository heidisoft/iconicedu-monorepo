import type { MessageMentionVM, UserProfileVM } from '@iconicedu/shared-types';

import { getProfileDisplayName } from '../../lib/display-name';

export type MessageTextSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; mention: MessageMentionVM };

export function extractMentionsFromMessageText(
  text: string,
  participants: UserProfileVM[],
  currentUserId?: string | null,
): MessageMentionVM[] {
  const displayNames = participants
    .filter((participant) => participant.ids.id !== currentUserId)
    .map((participant) => ({
      profileId: participant.ids.id,
      displayName: getProfileDisplayName(participant.profile, 'User'),
    }))
    .filter((participant) => participant.displayName.length > 0)
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

export function buildMessageTextSegments(
  text: string,
  mentions?: MessageMentionVM[] | null,
): MessageTextSegment[] {
  if (!mentions?.length) {
    return [{ type: 'text', text }];
  }

  const sortedMentions = [...mentions]
    .filter((mention) => mention.start >= 0 && mention.end > mention.start && mention.end <= text.length)
    .sort((a, b) => a.start - b.start);

  const segments: MessageTextSegment[] = [];
  let cursor = 0;

  sortedMentions.forEach((mention) => {
    if (mention.start < cursor) {
      return;
    }

    if (mention.start > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, mention.start) });
    }

    segments.push({ type: 'mention', mention });
    cursor = mention.end;
  });

  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) });
  }

  return segments;
}

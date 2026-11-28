import type { MessageVisibilityVM } from '@iconicedu/shared-types';

export type MessageAudienceParticipant = {
  id: string;
  name: string;
  role: string | null;
};

export type MessageVisibilityCopy = {
  summary: string;
  audienceNames: string[];
};

export function getMessageVisibilityCopy(input: {
  visibility: MessageVisibilityVM;
  currentProfileId?: string;
  participants?: MessageAudienceParticipant[];
}): MessageVisibilityCopy | null {
  const { visibility, currentProfileId, participants = [] } = input;
  if (visibility.type === 'all') return null;
  if (visibility.type === 'sender-only') {
    return { summary: 'Only visible to you', audienceNames: ['You'] };
  }
  if (visibility.type === 'recipient-only') {
    const participant = participants.find((item) => item.id === visibility.userId);
    const name = visibility.userId === currentProfileId ? 'You' : participant?.name;
    return {
      summary: name
        ? `Only visible to ${name.toLowerCase() === 'you' ? 'you' : name}`
        : 'Only visible to recipient',
      audienceNames: [name ?? 'Recipient'],
    };
  }

  const ids = [...new Set(visibility.userIds)];
  const participantNames = new Map(participants.map((item) => [item.id, item.name]));
  const audienceNames = ids.map((id) =>
    id === currentProfileId ? 'You' : (participantNames.get(id) ?? 'Channel member'),
  );
  const includesCurrentProfile = Boolean(
    currentProfileId && ids.includes(currentProfileId),
  );

  if (includesCurrentProfile) {
    const otherCount = Math.max(0, ids.length - 1);
    return {
      summary:
        otherCount === 0
          ? 'Only visible to you'
          : `Only visible to you + ${otherCount} ${otherCount === 1 ? 'other' : 'others'}`,
      audienceNames,
    };
  }

  const firstName = audienceNames[0];
  const remainingCount = Math.max(0, audienceNames.length - 1);
  return {
    summary:
      remainingCount === 0
        ? `Only visible to ${firstName ?? 'selected person'}`
        : `Only visible to ${firstName ?? 'selected person'} + ${remainingCount} ${remainingCount === 1 ? 'other' : 'others'}`,
    audienceNames,
  };
}

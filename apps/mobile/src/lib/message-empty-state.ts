type MobileEmptyStateCopy = {
  title: string;
  description: string;
  icon: 'message-square' | 'life-buoy' | 'graduation-cap';
};

export function buildMobileChannelEmptyStateCopy(input: {
  channelKind: 'dm' | 'support' | 'learning-space' | 'generic';
  currentUserKind?: string | null;
  title?: string | null;
  studentNames?: string[];
}): MobileEmptyStateCopy {
  if (input.channelKind === 'dm') {
    const otherParticipantName = input.title?.trim() || 'there';
    return {
      title: `Say hello to ${otherParticipantName}!`,
      description:
        'This is a direct message conversation. Chat here whenever you want, keep replies respectful, and keep the conversation in one place.',
      icon: 'message-square',
    };
  }

  if (input.channelKind === 'support') {
    return {
      title: 'Talk to support here',
      description:
        'Use this support channel for payment questions, class scheduling issues, teacher, parent, or student concerns, and any other operational help. Our support staff will help you resolve the issue.',
      icon: 'life-buoy',
    };
  }

  if (input.channelKind === 'learning-space') {
    return {
      title: 'Start the class conversation',
      description:
        'Use this class channel to communicate about the class, schedule changes, cancellations, homework, and shared learning resources.',
      icon: 'graduation-cap',
    };
  }

  return {
    title: 'No messages yet',
    description: 'Looks like you have not started a conversation yet.',
    icon: 'message-square',
  };
}

import { buildMobileChannelEmptyStateCopy } from './message-empty-state';

describe('buildMobileChannelEmptyStateCopy', () => {
  it('matches the web direct-message copy', () => {
    expect(
      buildMobileChannelEmptyStateCopy({
        channelKind: 'dm',
        title: 'Tutor Jane',
      }),
    ).toEqual({
      title: 'Say hello to Tutor Jane!',
      description:
        'This is a direct message conversation. Chat here whenever you want, keep replies respectful, and keep the conversation in one place.',
      icon: 'message-square',
    });
  });

  it('matches the web support copy', () => {
    expect(
      buildMobileChannelEmptyStateCopy({
        channelKind: 'support',
      }),
    ).toEqual({
      title: 'Talk to support here',
      description:
        'Use this support channel for payment questions, class scheduling issues, teacher, parent, or student concerns, and any other operational help. Our support staff will help you resolve the issue.',
      icon: 'life-buoy',
    });
  });

  it('uses the shared classroom fallback for guardians', () => {
    expect(
      buildMobileChannelEmptyStateCopy({
        channelKind: 'learning-space',
        currentUserKind: 'guardian',
      }),
    ).toEqual({
      title: 'Start the class conversation',
      description:
        'Use this class channel to communicate about the class, schedule changes, cancellations, homework, and shared learning resources.',
      icon: 'graduation-cap',
    });
  });

  it('uses the shared classroom fallback for educators', () => {
    expect(
      buildMobileChannelEmptyStateCopy({
        channelKind: 'learning-space',
        currentUserKind: 'educator',
        studentNames: ['Ava', 'Luca'],
      }),
    ).toEqual({
      title: 'Start the class conversation',
      description:
        'Use this class channel to communicate about the class, schedule changes, cancellations, homework, and shared learning resources.',
      icon: 'graduation-cap',
    });
  });

  it('uses the shared classroom fallback for students', () => {
    expect(
      buildMobileChannelEmptyStateCopy({
        channelKind: 'learning-space',
        currentUserKind: 'child',
      }),
    ).toEqual({
      title: 'Start the class conversation',
      description:
        'Use this class channel to communicate about the class, schedule changes, cancellations, homework, and shared learning resources.',
      icon: 'graduation-cap',
    });
  });

  it('matches the generic channel fallback from web', () => {
    expect(
      buildMobileChannelEmptyStateCopy({
        channelKind: 'generic',
      }),
    ).toEqual({
      title: 'No messages yet',
      description: 'Looks like you have not started a conversation yet.',
      icon: 'message-square',
    });
  });
});

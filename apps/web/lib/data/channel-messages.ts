import type { MessageVM, ThreadVM } from '@iconicedu/shared-types';
import {
  CHANNEL_IDS,
  MESSAGE_IDS,
  DEMO_ORG_ID,
  THREAD_IDS,
} from '@iconicedu/web/lib/data/ids';
import {
  CHILD_MAYA_PROFILE,
  CHILD_TEVIN_PROFILE,
  EDUCATOR_AVA_PROFILE,
  EDUCATOR_ELENA_PROFILE,
  EDUCATOR_LUCAS_PROFILE,
  EDUCATOR_MISHAN_PROFILE,
  EDUCATOR_PRIYA_PROFILE,
  GUARDIAN_RILEY_PROFILE,
  SYSTEM_PROFILE,
  STAFF_SUPPORT_PROFILE,
} from '@iconicedu/web/lib/data/profiles';

const THREAD_MATH_FEEDBACK: ThreadVM = {
  ids: { id: THREAD_IDS.mathFeedback, orgId: DEMO_ORG_ID },
  parent: {
    messageId: MESSAGE_IDS.mathHomework,
    snippet: 'Complete problems 1-10 in the worksheet.',
    authorId: EDUCATOR_PRIYA_PROFILE.ids.id,
    authorName: EDUCATOR_PRIYA_PROFILE.profile.displayName,
  },
  stats: {
    messageCount: 1,
    lastReplyAt: '2025-12-20T20:10:00.000Z',
  },
  participants: [EDUCATOR_PRIYA_PROFILE, GUARDIAN_RILEY_PROFILE, CHILD_TEVIN_PROFILE],
  readState: {
    threadId: THREAD_IDS.mathFeedback,
    channelId: CHANNEL_IDS.mathSpace,
    lastReadMessageId: MESSAGE_IDS.mathHomeworkSubmit,
    lastReadAt: '2025-12-20T20:10:00.000Z',
    unreadCount: 2,
  },
};

const THREAD_ELA_HOMEWORK: ThreadVM = {
  ids: { id: THREAD_IDS.elaHomework, orgId: DEMO_ORG_ID },
  parent: {
    messageId: MESSAGE_IDS.elaHomework,
    snippet: 'Draft a short story using the prompt provided.',
    authorId: EDUCATOR_ELENA_PROFILE.ids.id,
    authorName: EDUCATOR_ELENA_PROFILE.profile.displayName,
  },
  stats: {
    messageCount: 1,
    lastReplyAt: '2025-12-18T19:25:00.000Z',
  },
  participants: [EDUCATOR_ELENA_PROFILE, GUARDIAN_RILEY_PROFILE, CHILD_MAYA_PROFILE],
  readState: {
    threadId: THREAD_IDS.elaHomework,
    channelId: CHANNEL_IDS.elaSpace,
    lastReadMessageId: MESSAGE_IDS.elaHomework,
    lastReadAt: '2025-12-18T19:25:00.000Z',
    unreadCount: 0,
  },
};

export const MATH_CHANNEL_MESSAGES: MessageVM[] = [
  {
    ids: { id: MESSAGE_IDS.mathWelcome, orgId: DEMO_ORG_ID },
    core: {
      type: 'text',
      sender: GUARDIAN_RILEY_PROFILE,
      createdAt: '2025-12-18T18:00:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [
        { emoji: '👍', count: 2, reactedByMe: true },
        { emoji: '✨', count: 1 },
      ],
    },
    state: { isSaved: true },
    content: {
      text: 'Welcome to Math Foundations. We will focus on fractions and number sense this week.',
    },
  },
  {
    ids: { id: MESSAGE_IDS.mathHomework, orgId: DEMO_ORG_ID },
    core: {
      type: 'lesson-assignment',
      sender: EDUCATOR_PRIYA_PROFILE,
      createdAt: '2025-12-19T17:30:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [],
      thread: THREAD_MATH_FEEDBACK,
    },
    state: { isSaved: false },
    content: {
      text: 'Please complete the worksheet before our next session.',
    },
    assignment: {
      title: 'Fractions Practice Set',
      description: 'Focus on equivalent fractions and number lines.',
      dueAt: '2025-12-22T03:00:00.000Z',
      subject: 'Math',
      attachments: [
        {
          type: 'file',
          name: 'fractions-practice.pdf',
          url: 'https://files.example.com/fractions-practice.pdf',
          size: 312000,
          mimeType: 'application/pdf',
        },
      ],
      estimatedDuration: 45,
      difficulty: 'intermediate',
    },
  },
  {
    ids: { id: MESSAGE_IDS.mathHomeworkSubmit, orgId: DEMO_ORG_ID },
    core: {
      type: 'homework-submission',
      sender: CHILD_TEVIN_PROFILE,
      createdAt: '2025-12-20T19:40:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [{ emoji: '⭐', count: 1 }],
      thread: {
        ...THREAD_MATH_FEEDBACK,
        parent: {
          ...THREAD_MATH_FEEDBACK.parent,
          messageId: MESSAGE_IDS.mathHomework,
        },
      },
    },
    state: { isSaved: false },
    content: { text: 'Here is my worksheet submission.' },
    homework: {
      assignmentTitle: 'Fractions Practice Set',
      submittedAt: '2025-12-20T19:40:00.000Z',
      attachments: [
        {
          type: 'image',
          name: 'fractions-work.jpg',
          url: 'https://images.example.com/fractions-work.jpg',
          width: 1600,
          height: 1200,
        },
      ],
      status: 'submitted',
    },
  },
  {
    ids: { id: MESSAGE_IDS.mathFeedbackRequest, orgId: DEMO_ORG_ID },
    core: {
      type: 'feedback-request',
      sender: EDUCATOR_PRIYA_PROFILE,
      createdAt: '2025-12-20T20:00:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [],
    },
    state: { isSaved: true },
    content: { text: 'How did this session feel for you?' },
    feedback: {
      prompt: "Rate today's math session",
      sessionTitle: 'Math Foundations - Fractions',
      rating: 5,
      submittedAt: '2025-12-20T20:05:00.000Z',
      comment: 'Great pace and clear examples.',
    },
  },
  {
    ids: { id: MESSAGE_IDS.mathProgress, orgId: DEMO_ORG_ID },
    core: {
      type: 'progress-update',
      sender: EDUCATOR_PRIYA_PROFILE,
      createdAt: '2025-12-21T17:30:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [{ emoji: '📈', count: 1 }],
    },
    state: { isSaved: false },
    content: {
      text: 'Tevin improved accuracy on fraction problems this week.',
    },
    progress: {
      subject: 'Math',
      metric: 'Accuracy',
      previousValue: 65,
      currentValue: 82,
      targetValue: 90,
      improvement: 17,
      summary: 'Great progress on equivalent fractions.',
    },
  },
  {
    ids: { id: MESSAGE_IDS.mathSessionSummary, orgId: DEMO_ORG_ID },
    core: {
      type: 'session-summary',
      sender: EDUCATOR_PRIYA_PROFILE,
      createdAt: '2025-12-21T18:15:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [],
    },
    state: { isSaved: true },
    content: { text: "Summary from today's math session." },
    session: {
      title: 'Math Foundations - Fractions',
      startAt: '2025-12-21T17:00:00.000Z',
      durationMinutes: 45,
      summary: 'Reviewed equivalent fractions and number line placement.',
      highlights: ['Strong participation', 'Accurate number line placement'],
      nextSteps: ['Practice with mixed numbers', 'Review worksheet corrections'],
    },
  },
  {
    ids: { id: MESSAGE_IDS.mathSessionComplete, orgId: DEMO_ORG_ID },
    core: {
      type: 'session-complete',
      sender: SYSTEM_PROFILE,
      createdAt: '2025-12-21T18:20:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [{ emoji: '✅', count: 1 }],
    },
    state: { isSaved: false },
    content: { text: 'Session ready to mark as complete.' },
    session: {
      title: 'Math Foundations - Fractions',
      startAt: '2025-12-21T17:00:00.000Z',
      endAt: '2025-12-21T17:45:00.000Z',
      completedAt: null,
    },
  },
];

export const SCIENCE_CHANNEL_MESSAGES: MessageVM[] = [
  {
    ids: { id: MESSAGE_IDS.scienceWelcome, orgId: DEMO_ORG_ID },
    core: {
      type: 'text',
      sender: EDUCATOR_LUCAS_PROFILE,
      createdAt: '2025-12-18T18:30:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [{ emoji: '🔬', count: 2 }],
    },
    state: { isSaved: false },
    content: {
      text: 'Welcome to Science Lab Explorers. We will focus on simple experiments.',
    },
  },
  {
    ids: { id: MESSAGE_IDS.scienceResource, orgId: DEMO_ORG_ID },
    core: {
      type: 'file',
      sender: EDUCATOR_LUCAS_PROFILE,
      createdAt: '2025-12-19T18:45:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [],
    },
    state: { isSaved: true },
    content: { text: 'Lab guide for next week.' },
    attachment: {
      type: 'file',
      name: 'science-lab-guide.pdf',
      url: 'https://files.example.com/science-lab-guide.pdf',
      size: 402000,
      mimeType: 'application/pdf',
    },
  },
];

export const ELA_CHANNEL_MESSAGES: MessageVM[] = [
  {
    ids: { id: MESSAGE_IDS.elaWelcome, orgId: DEMO_ORG_ID },
    core: {
      type: 'text',
      sender: EDUCATOR_ELENA_PROFILE,
      createdAt: '2025-12-18T19:00:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [{ emoji: '📘', count: 1 }],
    },
    state: { isSaved: false },
    content: {
      text: 'Welcome to Writing Workshop. We will craft strong narratives.',
    },
  },
  {
    ids: { id: MESSAGE_IDS.elaSummary, orgId: DEMO_ORG_ID },
    core: {
      type: 'session-summary',
      sender: EDUCATOR_ELENA_PROFILE,
      createdAt: '2025-12-18T19:20:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [],
    },
    state: { isSaved: true },
    content: { text: "Summary for today's writing session." },
    session: {
      title: 'Writing Workshop - Story Seeds',
      startAt: '2025-12-18T18:30:00.000Z',
      durationMinutes: 45,
      summary: 'Explored story openings and character development.',
      highlights: ['Strong opening paragraph', 'Great descriptive language'],
      nextSteps: ['Draft first scene', 'Review dialogue tips'],
    },
  },
  {
    ids: { id: MESSAGE_IDS.elaHomework, orgId: DEMO_ORG_ID },
    core: {
      type: 'lesson-assignment',
      sender: EDUCATOR_ELENA_PROFILE,
      createdAt: '2025-12-18T19:25:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [],
      thread: THREAD_ELA_HOMEWORK,
    },
    state: { isSaved: false },
    content: {
      text: 'Draft a short story using the prompt in the worksheet.',
    },
    assignment: {
      title: 'Story Prompt Draft',
      description: 'Use the prompt to craft a 1-page draft.',
      dueAt: '2025-12-23T03:00:00.000Z',
      subject: 'ELA',
      attachments: [
        {
          type: 'file',
          name: 'story-prompt.pdf',
          url: 'https://files.example.com/story-prompt.pdf',
          size: 156000,
          mimeType: 'application/pdf',
        },
      ],
      estimatedDuration: 40,
      difficulty: 'beginner',
    },
  },
];

export const CHESS_CHANNEL_MESSAGES: MessageVM[] = [
  {
    ids: { id: MESSAGE_IDS.chessWelcome, orgId: DEMO_ORG_ID },
    core: {
      type: 'text',
      sender: EDUCATOR_MISHAN_PROFILE,
      createdAt: '2025-12-18T20:00:00.000Z',
      visibility: { type: 'all' },
    },
    social: {
      reactions: [{ emoji: '♟️', count: 2 }],
    },
    state: { isSaved: false },
    content: {
      text: 'Welcome to Chess Strategy Lab. We will review openings and tactics.',
    },
  },
  {
    ids: { id: MESSAGE_IDS.chessEventReminder, orgId: DEMO_ORG_ID },
    core: {
      type: 'event-reminder',
      sender: EDUCATOR_MISHAN_PROFILE,
      createdAt: '2025-12-18T20:10:00.000Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: { isSaved: false },
    content: {
      text: 'Reminder: Chess Strategy Lab this Friday.',
    },
    event: {
      title: 'Chess Strategy Lab',
      startAt: '2025-12-26T00:30:00.000Z',
      endAt: '2025-12-26T01:15:00.000Z',
      location: 'Zoom',
      meetingLink:
        'https://us06web.zoom.us/j/88676118659?pwd=gsLCQZrCkU60T91Dc37DaaNiWdsgTq.1',
      attendees: [EDUCATOR_MISHAN_PROFILE, CHILD_TEVIN_PROFILE],
    },
  },
];

export const DM_PRIYA_MESSAGES: MessageVM[] = [
  {
    ids: { id: MESSAGE_IDS.dmPriya1, orgId: DEMO_ORG_ID },
    core: {
      type: 'text',
      sender: GUARDIAN_RILEY_PROFILE,
      createdAt: '2025-12-18T17:10:00.000Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'Hi Priya, quick question about the fractions worksheet.' },
  },
  {
    ids: { id: MESSAGE_IDS.dmPriya2, orgId: DEMO_ORG_ID },
    core: {
      type: 'image',
      sender: EDUCATOR_PRIYA_PROFILE,
      createdAt: '2025-12-18T17:25:00.000Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'Here is the sample solution.' },
    attachment: {
      type: 'image',
      name: 'fractions-sample.png',
      url: 'https://images.example.com/fractions-sample.png',
      width: 1200,
      height: 900,
    },
  },
];

export const DM_ELENA_MESSAGES: MessageVM[] = [
  {
    ids: { id: MESSAGE_IDS.dmElena1, orgId: DEMO_ORG_ID },
    core: {
      type: 'file',
      sender: EDUCATOR_ELENA_PROFILE,
      createdAt: '2025-12-18T16:40:00.000Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'Sharing a story outline template.' },
    attachment: {
      type: 'file',
      name: 'story-outline.docx',
      url: 'https://files.example.com/story-outline.docx',
      size: 182000,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  },
];

export const DM_LUCAS_MESSAGES: MessageVM[] = [
  {
    ids: { id: MESSAGE_IDS.dmLucas1, orgId: DEMO_ORG_ID },
    core: {
      type: 'text',
      sender: EDUCATOR_LUCAS_PROFILE,
      createdAt: '2025-12-18T17:50:00.000Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: "Looking forward to tomorrow's lab. Please prep vinegar." },
  },
];

export const DM_MISHAN_MESSAGES: MessageVM[] = [
  {
    ids: { id: MESSAGE_IDS.dmMishan1, orgId: DEMO_ORG_ID },
    core: {
      type: 'audio-recording',
      sender: EDUCATOR_MISHAN_PROFILE,
      createdAt: '2025-12-18T18:10:00.000Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: "Audio recap of today's chess puzzle." },
    audio: {
      url: 'https://files.example.com/chess-recap.mp3',
      durationSeconds: 42,
      waveform: [0.2, 0.4, 0.3, 0.6, 0.5],
      fileSize: 89000,
      mimeType: 'audio/mpeg',
    },
  },
];

export const DM_AVA_MESSAGES: MessageVM[] = [
  {
    ids: { id: MESSAGE_IDS.dmAva1, orgId: DEMO_ORG_ID },
    core: {
      type: 'text',
      sender: EDUCATOR_AVA_PROFILE,
      createdAt: '2025-12-18T18:20:00.000Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'Quick check-in: Tevin did great today.' },
  },
];

export const SUPPORT_CHANNEL_MESSAGES: MessageVM[] = [
  {
    ids: { id: MESSAGE_IDS.supportWelcome, orgId: DEMO_ORG_ID },
    core: {
      type: 'text',
      sender: STAFF_SUPPORT_PROFILE,
      createdAt: '2025-12-18T16:00:00.000Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: { isSaved: false },
    content: {
      text: 'Hi Riley, this is ICONIC Support. How can we help today?',
    },
  },
  {
    ids: { id: MESSAGE_IDS.supportReply, orgId: DEMO_ORG_ID },
    core: {
      type: 'text',
      sender: GUARDIAN_RILEY_PROFILE,
      createdAt: '2025-12-18T16:05:00.000Z',
      visibility: { type: 'all' },
    },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: "I need help rescheduling next week's session." },
  },
];

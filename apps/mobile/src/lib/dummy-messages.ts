import type { MessageVM, UserProfileVM } from '@iconicedu/shared-types';
import type { ChannelListItem } from '@/lib/api/queries';

const ORG = 'b3a5f6e3-2f6a-4c12-9d3a-1f1f1b0a6f1a';

function mkProfile(
  kind: string,
  id: string,
  accountId: string,
  displayName: string,
  seed: string,
): UserProfileVM {
  return {
    kind,
    ids: { id, orgId: ORG, accountId },
    profile: {
      displayName,
      avatar: { source: 'seed', seed, url: null, updatedAt: '2025-01-01T00:00:00.000Z' },
    },
    prefs: {},
    meta: { createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
  } as unknown as UserProfileVM;
}

/** The viewer profile ID used to determine "own" messages in demo mode */
export const DEMO_PROFILE_ID = 'c7d4a3c8-4c9a-4b2a-9a25-32bf0f5d2c01';

// ─── Profiles ─────────────────────────────────────────────────────────────────
const RILEY   = mkProfile('guardian', 'c7d4a3c8-4c9a-4b2a-9a25-32bf0f5d2c01', '411bd6fd-47f6-429b-ad87-d504487fd086', 'Riley Morgan',   'riley-morgan');
const PRIYA   = mkProfile('educator', 'f1a2b3c4-d5e6-4f70-8a9b-1c2d3e4f5a60', 'b8d8af5f-8e2f-4b0e-9fb1-2a4cfd2a1d01', 'Priya Nair',     'priya-nair');
const ELENA   = mkProfile('educator', 'a1b2c3d4-e5f6-4a70-9b8c-2d3e4f5a6b70', '2fd71a22-1d0a-4b6f-8c2a-7c0b51a7c8c2', 'Elena Brooks',   'elena-brooks');
const LUCAS   = mkProfile('educator', 'b2c3d4e5-f6a7-4b80-8c9d-3e4f5a6b7c80', '9c0a2d15-6b8d-4c6c-9a0d-0b7c2a4e6f13', 'Lucas Choi',     'lucas-choi');
const MISHAN  = mkProfile('educator', 'c3d4e5f6-a7b8-4c90-9d0e-4f5a6b7c8d90', 'c28f6b74-9b0f-4e5c-9a33-3b9f2b4a1c24', 'Mishan Perera',  'mishan-perera');
const AVA     = mkProfile('educator', 'd4e5f6a7-b8c9-4da0-8e1f-5a6b7c8d9e01', '7f2c9a11-5f3d-4c2b-9d2f-6c2b1a0d9e35', 'Ava Patel',      'ava-patel');
const SUPPORT = mkProfile('staff',    'e5f6a7b8-c9d0-4eb1-9f2a-6b7c8d9e0f12', '64b3c1f9-7a2b-4c6d-8d17-5a7f3c1b2d46', 'ICONIC Support', 'iconic-support');
const SYSTEM  = mkProfile('system',   '1a5b3c9d-2e4f-4c7a-8b9d-0e1f2a3b4c5d', '0f7c5b31-5f7b-4b43-9a7f-8b6c3f94b2a1', 'ICONIC System',  'iconic-system');
const TEVIN   = mkProfile('child',    '9b7c0d12-1f2a-4c3b-9d4e-0f5a6b7c8d91', '0b6f1c2e-7f4b-4c25-9a2b-1f3b0f4f9a01', 'Tevin Morgan',   'tevin-morgan');

// ─── Demo channel IDs (keep 'demo-' prefix for isDemo detection) ──────────────
const CH = {
  math:     'demo-channel-math',
  science:  'demo-channel-science',
  ela:      'demo-channel-ela',
  chess:    'demo-channel-chess',
  dmPriya:  'demo-dm-priya',
  dmElena:  'demo-dm-elena',
  dmLucas:  'demo-dm-lucas',
  dmMishan: 'demo-dm-mishan',
  dmAva:    'demo-dm-ava',
  support:  'demo-dm-support',
} as const;

// ─── Math Foundations (7 messages) ───────────────────────────────────────────
const MATH_MESSAGES: MessageVM[] = [
  {
    ids: { id: '4ce1d2e3-a4b5-4df0-8c6d-0f1a2b3c4d56', orgId: ORG },
    core: { type: 'text', sender: RILEY, createdAt: '2025-12-18T18:00:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [{ emoji: '👍', count: 2, reactedByMe: true }, { emoji: '✨', count: 1 }] },
    state: { isSaved: true },
    content: { text: 'Welcome to Math Foundations. We will focus on fractions and number sense this week.' },
  },
  {
    ids: { id: '5df2e3f4-b5c6-4e01-9d7e-1a2b3c4d5e67', orgId: ORG },
    core: { type: 'lesson-assignment', sender: PRIYA, createdAt: '2025-12-19T17:30:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'Please complete the worksheet before our next session.' },
    assignment: {
      title: 'Fractions Practice Set',
      description: 'Focus on equivalent fractions and number lines.',
      dueAt: '2025-12-22T03:00:00.000Z',
      subject: 'Math',
      attachments: [{ type: 'file', name: 'fractions-practice.pdf', url: 'https://files.example.com/fractions-practice.pdf', size: 312000, mimeType: 'application/pdf' }],
      estimatedDuration: 45,
      difficulty: 'intermediate',
    },
  },
  {
    ids: { id: '6ef3f4a5-c6d7-4f12-8e8f-2b3c4d5e6f78', orgId: ORG },
    core: { type: 'homework-submission', sender: TEVIN, createdAt: '2025-12-20T19:40:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [{ emoji: '⭐', count: 1 }] },
    state: { isSaved: false },
    content: { text: 'Here is my worksheet submission.' },
    homework: {
      assignmentTitle: 'Fractions Practice Set',
      submittedAt: '2025-12-20T19:40:00.000Z',
      attachments: [{ type: 'image', name: 'fractions-work.jpg', url: 'https://images.example.com/fractions-work.jpg', width: 1600, height: 1200 }],
      status: 'submitted',
    },
  },
  {
    ids: { id: '7f04a5b6-d7e8-4013-9f9a-3c4d5e6f7a89', orgId: ORG },
    core: { type: 'feedback-request', sender: PRIYA, createdAt: '2025-12-20T20:00:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
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
    ids: { id: '8015b6c7-e8f9-4124-8a0b-4d5e6f7a8b90', orgId: ORG },
    core: { type: 'progress-update', sender: PRIYA, createdAt: '2025-12-21T17:30:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [{ emoji: '📈', count: 1 }] },
    state: { isSaved: false },
    content: { text: 'Tevin improved accuracy on fraction problems this week.' },
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
    ids: { id: '9126c7d8-f901-4235-9b1c-5e6f7a8b9c01', orgId: ORG },
    core: { type: 'session-summary', sender: PRIYA, createdAt: '2025-12-21T18:15:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
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
    ids: { id: 'a137d8e9-0123-4346-8c2d-6f7a8b9c0d13', orgId: ORG },
    core: { type: 'session-complete', sender: SYSTEM, createdAt: '2025-12-21T18:20:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [{ emoji: '✅', count: 1 }] },
    state: { isSaved: false },
    content: { text: 'Session ready to mark as complete.' },
    session: {
      title: 'Math Foundations - Fractions',
      startAt: '2025-12-21T17:00:00.000Z',
      endAt: '2025-12-21T17:45:00.000Z',
      completedAt: null,
    },
  },
] as MessageVM[];

// ─── Science Lab Explorers (2 messages) ──────────────────────────────────────
const SCIENCE_MESSAGES: MessageVM[] = [
  {
    ids: { id: 'a237d8e9-0123-4346-8c2d-6f7a8b9c0d12', orgId: ORG },
    core: { type: 'text', sender: LUCAS, createdAt: '2025-12-18T18:30:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [{ emoji: '🔬', count: 2 }] },
    state: { isSaved: false },
    content: { text: 'Welcome to Science Lab Explorers. We will focus on simple experiments.' },
  },
  {
    ids: { id: 'b348e9f0-1234-4457-9d3e-7a8b9c0d1e23', orgId: ORG },
    core: { type: 'file', sender: LUCAS, createdAt: '2025-12-19T18:45:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
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
] as MessageVM[];

// ─── Writing Workshop / ELA (3 messages) ─────────────────────────────────────
const ELA_MESSAGES: MessageVM[] = [
  {
    ids: { id: 'c459f001-2345-4568-8e4f-8b9c0d1e2f34', orgId: ORG },
    core: { type: 'text', sender: ELENA, createdAt: '2025-12-18T19:00:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [{ emoji: '📘', count: 1 }] },
    state: { isSaved: false },
    content: { text: 'Welcome to Writing Workshop. We will craft strong narratives.' },
  },
  {
    ids: { id: 'd56a0112-3456-4679-9f50-9c0d1e2f3a45', orgId: ORG },
    core: { type: 'session-summary', sender: ELENA, createdAt: '2025-12-18T19:20:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
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
    ids: { id: 'e67b1223-4567-478a-8a61-ad1e2f3a4b56', orgId: ORG },
    core: { type: 'lesson-assignment', sender: ELENA, createdAt: '2025-12-18T19:25:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'Draft a short story using the prompt in the worksheet.' },
    assignment: {
      title: 'Story Prompt Draft',
      description: 'Use the prompt to craft a 1-page draft.',
      dueAt: '2025-12-23T03:00:00.000Z',
      subject: 'ELA',
      attachments: [{ type: 'file', name: 'story-prompt.pdf', url: 'https://files.example.com/story-prompt.pdf', size: 156000, mimeType: 'application/pdf' }],
      estimatedDuration: 40,
      difficulty: 'beginner',
    },
  },
] as MessageVM[];

// ─── Chess Strategy Lab (2 messages) ─────────────────────────────────────────
const CHESS_MESSAGES: MessageVM[] = [
  {
    ids: { id: 'f78c2334-5678-489b-9b72-be2f3a4b5c67', orgId: ORG },
    core: { type: 'text', sender: MISHAN, createdAt: '2025-12-18T20:00:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [{ emoji: '♟️', count: 2 }] },
    state: { isSaved: false },
    content: { text: 'Welcome to Chess Strategy Lab. We will review openings and tactics.' },
  },
  {
    ids: { id: '089d3445-6789-49ac-8c83-cf3a4b5c6d78', orgId: ORG },
    core: { type: 'event-reminder', sender: MISHAN, createdAt: '2025-12-18T20:10:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'Reminder: Chess Strategy Lab this Friday.' },
    event: {
      title: 'Chess Strategy Lab',
      startAt: '2025-12-26T00:30:00.000Z',
      endAt: '2025-12-26T01:15:00.000Z',
      location: 'Zoom',
      meetingLink: 'https://us06web.zoom.us/j/88676118659?pwd=gsLCQZrCkU60T91Dc37DaaNiWdsgTq.1',
      attendees: [MISHAN, TEVIN],
    },
  },
] as MessageVM[];

// ─── DM: Priya Nair (2 messages) ─────────────────────────────────────────────
const DM_PRIYA_MESSAGES: MessageVM[] = [
  {
    ids: { id: '19ae4556-789a-4abd-9d94-d04b5c6d7e89', orgId: ORG },
    core: { type: 'text', sender: RILEY, createdAt: '2025-12-18T17:10:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'Hi Priya, quick question about the fractions worksheet.' },
  },
  {
    ids: { id: '2abf5667-89ab-4bce-8ea5-e15c6d7e8f90', orgId: ORG },
    core: { type: 'image', sender: PRIYA, createdAt: '2025-12-18T17:25:00.000Z', visibility: { type: 'all' } },
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
] as MessageVM[];

// ─── DM: Elena Brooks (1 message) ────────────────────────────────────────────
const DM_ELENA_MESSAGES: MessageVM[] = [
  {
    ids: { id: '3bc06778-9abc-4cdf-9fb6-f26d7e8f9011', orgId: ORG },
    core: { type: 'file', sender: ELENA, createdAt: '2025-12-18T16:40:00.000Z', visibility: { type: 'all' } },
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
] as MessageVM[];

// ─── DM: Lucas Choi (1 message) ──────────────────────────────────────────────
const DM_LUCAS_MESSAGES: MessageVM[] = [
  {
    ids: { id: '4cd17889-abcd-4d01-8ac7-037e8f901222', orgId: ORG },
    core: { type: 'text', sender: LUCAS, createdAt: '2025-12-18T17:50:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: "Looking forward to tomorrow's lab. Please prep vinegar." },
  },
] as MessageVM[];

// ─── DM: Mishan Perera (1 audio message) ─────────────────────────────────────
const DM_MISHAN_MESSAGES: MessageVM[] = [
  {
    ids: { id: '5de2899a-bcde-4e12-9bd8-148f90123333', orgId: ORG },
    core: { type: 'audio-recording', sender: MISHAN, createdAt: '2025-12-18T18:10:00.000Z', visibility: { type: 'all' } },
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
] as MessageVM[];

// ─── DM: Ava Patel (1 message) ───────────────────────────────────────────────
const DM_AVA_MESSAGES: MessageVM[] = [
  {
    ids: { id: '6ef39aab-cdef-4f23-8cea-259012344444', orgId: ORG },
    core: { type: 'text', sender: AVA, createdAt: '2025-12-18T18:20:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'Quick check-in: Tevin did great today.' },
  },
] as MessageVM[];

// ─── DM: ICONIC Support (2 messages) ─────────────────────────────────────────
const SUPPORT_MESSAGES: MessageVM[] = [
  {
    ids: { id: '7004abbd-def0-4024-9dfb-36a123455555', orgId: ORG },
    core: { type: 'text', sender: SUPPORT, createdAt: '2025-12-18T16:00:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: 'Hi Riley, this is ICONIC Support. How can we help today?' },
  },
  {
    ids: { id: '8115bccf-ef01-4135-8e0c-47b234566666', orgId: ORG },
    core: { type: 'text', sender: RILEY, createdAt: '2025-12-18T16:05:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    state: { isSaved: false },
    content: { text: "I need help rescheduling next week's session." },
  },
] as MessageVM[];

// ─── Message map ──────────────────────────────────────────────────────────────
/** Map demo channelId → demo messages, used by conversation screens */
export const DEMO_MESSAGE_MAP: Record<string, MessageVM[]> = {
  [CH.math]:     MATH_MESSAGES,
  [CH.science]:  SCIENCE_MESSAGES,
  [CH.ela]:      ELA_MESSAGES,
  [CH.chess]:    CHESS_MESSAGES,
  [CH.dmPriya]:  DM_PRIYA_MESSAGES,
  [CH.dmElena]:  DM_ELENA_MESSAGES,
  [CH.dmLucas]:  DM_LUCAS_MESSAGES,
  [CH.dmMishan]: DM_MISHAN_MESSAGES,
  [CH.dmAva]:    DM_AVA_MESSAGES,
  [CH.support]:  SUPPORT_MESSAGES,
};

// ─── Channel list items ───────────────────────────────────────────────────────
export const DEMO_DM_CHANNELS: ChannelListItem[] = [
  {
    id: CH.dmPriya,
    org_id: ORG,
    topic: 'Priya Nair',
    description: 'Math tutor',
    kind: 'dm',
    updated_at: '2025-12-18T17:25:00.000Z',
    unread_count: 1,
    last_message_text: 'Here is the sample solution.',
    last_message_at: '2025-12-18T17:25:00.000Z',
    last_message_sender: 'Priya Nair',
  },
  {
    id: CH.dmElena,
    org_id: ORG,
    topic: 'Elena Brooks',
    description: 'ELA / Writing tutor',
    kind: 'dm',
    updated_at: '2025-12-18T16:40:00.000Z',
    unread_count: 1,
    last_message_text: 'Sharing a story outline template.',
    last_message_at: '2025-12-18T16:40:00.000Z',
    last_message_sender: 'Elena Brooks',
  },
  {
    id: CH.dmLucas,
    org_id: ORG,
    topic: 'Lucas Choi',
    description: 'Science tutor',
    kind: 'dm',
    updated_at: '2025-12-18T17:50:00.000Z',
    unread_count: 1,
    last_message_text: "Looking forward to tomorrow's lab. Please prep vinegar.",
    last_message_at: '2025-12-18T17:50:00.000Z',
    last_message_sender: 'Lucas Choi',
  },
  {
    id: CH.dmMishan,
    org_id: ORG,
    topic: 'Mishan Perera',
    description: 'Chess coach',
    kind: 'dm',
    updated_at: '2025-12-18T18:10:00.000Z',
    unread_count: 1,
    last_message_text: "Audio recap of today's chess puzzle.",
    last_message_at: '2025-12-18T18:10:00.000Z',
    last_message_sender: 'Mishan Perera',
  },
  {
    id: CH.dmAva,
    org_id: ORG,
    topic: 'Ava Patel',
    description: 'Math tutor',
    kind: 'dm',
    updated_at: '2025-12-18T18:20:00.000Z',
    unread_count: 1,
    last_message_text: 'Quick check-in: Tevin did great today.',
    last_message_at: '2025-12-18T18:20:00.000Z',
    last_message_sender: 'Ava Patel',
  },
  {
    id: CH.support,
    org_id: ORG,
    topic: 'ICONIC Support',
    description: 'Help & account support',
    kind: 'dm',
    updated_at: '2025-12-18T16:05:00.000Z',
    unread_count: 0,
    last_message_text: "I need help rescheduling next week's session.",
    last_message_at: '2025-12-18T16:05:00.000Z',
    last_message_sender: 'Riley Morgan',
  },
];

export const DEMO_CHANNEL_LIST: ChannelListItem[] = [
  {
    id: CH.math,
    org_id: ORG,
    topic: 'Math Foundations',
    description: 'Fractions & number sense',
    kind: 'channel',
    updated_at: '2025-12-21T18:20:00.000Z',
    unread_count: 0,
    last_message_text: 'Session ready to mark as complete.',
    last_message_at: '2025-12-21T18:20:00.000Z',
    last_message_sender: 'ICONIC System',
    icon_emoji: '📐',
    student_name: 'Tevin',
  },
  {
    id: CH.science,
    org_id: ORG,
    topic: 'Science Lab Explorers',
    description: 'Simple experiments',
    kind: 'channel',
    updated_at: '2025-12-19T18:45:00.000Z',
    unread_count: 1,
    last_message_text: 'Lab guide for next week.',
    last_message_at: '2025-12-19T18:45:00.000Z',
    last_message_sender: 'Lucas Choi',
    icon_emoji: '🔬',
    student_name: 'Tevin',
  },
  {
    id: CH.ela,
    org_id: ORG,
    topic: 'Writing Workshop',
    description: 'Narratives & storytelling',
    kind: 'channel',
    updated_at: '2025-12-18T19:25:00.000Z',
    unread_count: 2,
    last_message_text: 'Draft a short story using the prompt in the worksheet.',
    last_message_at: '2025-12-18T19:25:00.000Z',
    last_message_sender: 'Elena Brooks',
    icon_emoji: '✏️',
    student_name: 'Maya',
  },
  {
    id: CH.chess,
    org_id: ORG,
    topic: 'Chess Strategy Lab',
    description: 'Openings & tactical patterns',
    kind: 'channel',
    updated_at: '2025-12-18T20:10:00.000Z',
    unread_count: 1,
    last_message_text: 'Reminder: Chess Strategy Lab this Friday.',
    last_message_at: '2025-12-18T20:10:00.000Z',
    last_message_sender: 'Mishan Perera',
    icon_emoji: '♟️',
    student_name: 'Tevin',
  },
];

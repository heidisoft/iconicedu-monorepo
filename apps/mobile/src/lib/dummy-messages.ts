import type { MessageVM, UserProfileVM } from '@iconicedu/shared-types';

const ORG = 'org-demo';

function mkSender(id: string, name: string): UserProfileVM {
  return {
    kind: 'educator',
    ids: { id, orgId: ORG, accountId: `acct-${id}` },
    profile: {
      displayName: name,
      avatar: { source: 'seed', seed: id },
    },
    prefs: {},
    meta: { createdAt: '2025-12-01T00:00:00.000Z', updatedAt: '2025-12-01T00:00:00.000Z' },
  } as unknown as UserProfileVM;
}

/** The viewer profile ID used to determine "own" messages in demo mode */
export const DEMO_PROFILE_ID = 'riley-001';

const PRIYA  = mkSender('priya-001',  'Priya S.');
const RILEY  = mkSender('riley-001',  'Riley T.');
const TEVIN  = mkSender('tevin-001',  'Tevin T.');
const MISHAN = mkSender('mishan-001', 'Mishan K.');
const SYSTEM = mkSender('system-001', 'ICONIC System');

export const DEMO_MATH_MESSAGES: MessageVM[] = [
  {
    ids: { id: 'msg-m1', orgId: ORG },
    core: { type: 'text', sender: RILEY, createdAt: '2025-12-18T18:00:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    content: { text: "Hey Priya! Tevin's been excited about fractions this week." },
  },
  {
    ids: { id: 'msg-m2', orgId: ORG },
    core: { type: 'text', sender: PRIYA, createdAt: '2025-12-18T18:02:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [{ emoji: '❤️', count: 1 }] },
    content: { text: "That's wonderful! He's doing great. I've put together a practice set." },
  },
  {
    ids: { id: 'msg-m3', orgId: ORG },
    core: { type: 'lesson-assignment', sender: PRIYA, createdAt: '2025-12-19T17:30:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    content: { text: 'Please complete the worksheet before our next session.' },
    assignment: {
      title: 'Fractions Practice Set',
      description: 'Focus on equivalent fractions and number lines. Try all 10 problems.',
      dueAt: '2025-12-22T03:00:00.000Z',
      subject: 'Math',
      attachments: [
        { type: 'file', name: 'fractions-practice.pdf', url: '#', size: 312000, mimeType: 'application/pdf' },
      ],
      estimatedDuration: 45,
      difficulty: 'intermediate',
    },
  },
  {
    ids: { id: 'msg-m4', orgId: ORG },
    core: { type: 'homework-submission', sender: TEVIN, createdAt: '2025-12-20T19:40:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [{ emoji: '⭐', count: 1 }] },
    content: { text: 'Here is my worksheet submission.' },
    homework: {
      assignmentTitle: 'Fractions Practice Set',
      submittedAt: '2025-12-20T19:40:00.000Z',
      attachments: [
        { type: 'image', name: 'fractions-work.jpg', url: '#', width: 1600, height: 1200 },
      ],
      status: 'submitted',
    },
  },
  {
    ids: { id: 'msg-m5', orgId: ORG },
    core: { type: 'progress-update', sender: PRIYA, createdAt: '2025-12-21T17:30:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [{ emoji: '📈', count: 1 }] },
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
    ids: { id: 'msg-m6', orgId: ORG },
    core: { type: 'session-summary', sender: PRIYA, createdAt: '2025-12-21T18:15:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    content: { text: "Summary from today's math session." },
    session: {
      title: 'Math Foundations — Fractions',
      startAt: '2025-12-21T17:00:00.000Z',
      durationMinutes: 45,
      summary: 'Reviewed equivalent fractions and number line placement. Excellent focus throughout.',
      highlights: ['Strong participation', 'Accurate number line placement'],
      nextSteps: ['Practice with mixed numbers', 'Review worksheet corrections'],
    },
  },
  {
    ids: { id: 'msg-m7', orgId: ORG },
    core: { type: 'session-complete', sender: SYSTEM, createdAt: '2025-12-21T18:20:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    content: { text: 'Session complete.' },
    session: {
      title: 'Math Foundations — Fractions',
      startAt: '2025-12-21T17:00:00.000Z',
      endAt: '2025-12-21T17:45:00.000Z',
      completedAt: null,
    },
  },
] as MessageVM[];

export const DEMO_DM_MESSAGES: MessageVM[] = [
  {
    ids: { id: 'msg-dm1', orgId: ORG },
    core: { type: 'text', sender: RILEY, createdAt: '2025-12-18T17:10:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    content: { text: 'Hi Priya, quick question about the fractions worksheet.' },
  },
  {
    ids: { id: 'msg-dm2', orgId: ORG },
    core: { type: 'text', sender: PRIYA, createdAt: '2025-12-18T17:15:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    content: { text: 'Of course! What would you like to know?' },
  },
  {
    ids: { id: 'msg-dm3', orgId: ORG },
    core: { type: 'text', sender: RILEY, createdAt: '2025-12-18T17:20:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    content: { text: "Tevin's struggling with problem 7. Should he use fraction bars?" },
  },
  {
    ids: { id: 'msg-dm4', orgId: ORG },
    core: { type: 'text', sender: PRIYA, createdAt: '2025-12-18T17:25:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    content: { text: 'Absolutely! Fraction bars or physical manipulatives are perfect. Try drawing number lines too.' },
  },
] as MessageVM[];

export const DEMO_CHESS_MESSAGES: MessageVM[] = [
  {
    ids: { id: 'msg-c1', orgId: ORG },
    core: { type: 'text', sender: MISHAN, createdAt: '2025-12-18T20:00:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [{ emoji: '♟️', count: 2 }] },
    content: { text: 'Welcome to Chess Strategy Lab! This week: openings and tactical patterns.' },
  },
  {
    ids: { id: 'msg-c2', orgId: ORG },
    core: { type: 'event-reminder', sender: MISHAN, createdAt: '2025-12-18T20:10:00.000Z', visibility: { type: 'all' } },
    social: { reactions: [] },
    content: { text: 'Reminder: Chess Strategy Lab this Friday.' },
    event: {
      title: 'Chess Strategy Lab',
      startAt: '2025-12-26T00:30:00.000Z',
      endAt: '2025-12-26T01:15:00.000Z',
      location: 'Zoom',
      meetingLink: 'https://zoom.us/j/demo',
      attendees: [MISHAN, TEVIN],
    },
  },
] as MessageVM[];

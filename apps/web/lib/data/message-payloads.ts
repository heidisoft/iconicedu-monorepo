import { MESSAGE_IDS, DEMO_ORG_ID } from '@iconicedu/web/lib/data/ids';

type MessagePayloadRecordVM = {
  ids: {
    id: string;
    orgId: string;
    messageId: string;
  };
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export const MESSAGE_PAYLOAD_RECORDS: MessagePayloadRecordVM[] = [
  {
    ids: {
      id: 'f1b2c3d4-1111-4b2c-8d3e-9f0a1b2c3d4e',
      orgId: DEMO_ORG_ID,
      messageId: MESSAGE_IDS.mathWelcome,
    },
    type: 'text',
    payload: {
      text: 'Welcome to Math Foundations. We will focus on fractions and number sense this week.',
    },
    createdAt: '2025-12-18T18:00:00.000Z',
    updatedAt: '2025-12-18T18:00:00.000Z',
  },
  {
    ids: {
      id: 'f2c3d4e5-2222-4c3d-9e4f-0a1b2c3d4e5f',
      orgId: DEMO_ORG_ID,
      messageId: MESSAGE_IDS.mathHomework,
    },
    type: 'lesson-assignment',
    payload: {
      title: 'Fractions Practice Set',
      description: 'Focus on equivalent fractions and number lines.',
      dueAt: '2025-12-22T03:00:00.000Z',
      subject: 'Math',
    },
    createdAt: '2025-12-19T17:30:00.000Z',
    updatedAt: '2025-12-19T17:30:00.000Z',
  },
  {
    ids: {
      id: 'f3d4e5f6-3333-4d4e-8f5a-1b2c3d4e5f60',
      orgId: DEMO_ORG_ID,
      messageId: MESSAGE_IDS.scienceResource,
    },
    type: 'file',
    payload: {
      name: 'science-lab-guide.pdf',
      url: 'https://files.example.com/science-lab-guide.pdf',
      mimeType: 'application/pdf',
      size: 402000,
    },
    createdAt: '2025-12-19T18:45:00.000Z',
    updatedAt: '2025-12-19T18:45:00.000Z',
  },
  {
    ids: {
      id: 'f4e5f607-4444-4e5f-9a6b-2c3d4e5f6071',
      orgId: DEMO_ORG_ID,
      messageId: MESSAGE_IDS.elaHomework,
    },
    type: 'lesson-assignment',
    payload: {
      title: 'Short Story Draft',
      description: 'Draft a short story using the prompt provided.',
      dueAt: '2025-12-23T03:00:00.000Z',
      subject: 'ELA',
    },
    createdAt: '2025-12-18T19:10:00.000Z',
    updatedAt: '2025-12-18T19:10:00.000Z',
  },
];

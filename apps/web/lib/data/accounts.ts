import type { UserAccountVM } from '@iconicedu/shared-types';
import { ACCOUNT_IDS, DEMO_ORG_ID } from '@iconicedu/web/lib/data/ids';
import {
  CHILD_MAYA_ROLE,
  CHILD_TEHARA_ROLE,
  CHILD_TEVIN_ROLE,
  EDUCATOR_AVA_ROLE,
  EDUCATOR_ELENA_ROLE,
  EDUCATOR_LUCAS_ROLE,
  EDUCATOR_MISHAN_ROLE,
  EDUCATOR_PRIYA_ROLE,
  GUARDIAN_ROLE,
  STAFF_SUPPORT_ROLE,
} from '@iconicedu/web/lib/data/roles';

export const GUARDIAN_ACCOUNT: UserAccountVM = {
  ids: { id: ACCOUNT_IDS.guardianRiley, orgId: DEMO_ORG_ID },
  contacts: {
    email: 'riley.morgan@iconic.edu',
    phoneE164: '+14085551234',
    whatsappE164: '+14085559876',
    emailVerified: true,
    phoneVerified: true,
    whatsappVerified: false,
    emailVerifiedAt: '2025-01-08T15:20:00.000Z',
    phoneVerifiedAt: '2025-01-08T15:25:00.000Z',
    preferredContactChannels: ['email', 'sms'],
  },
  access: {
    userRoles: [GUARDIAN_ROLE],
    activeContext: { roleKey: 'guardian' },
  },
  lifecycle: {
    status: 'active',
    createdAt: '2024-12-15T10:05:00.000Z',
    updatedAt: '2025-02-01T08:30:00.000Z',
  },
};

export const CHILD_TEVIN_ACCOUNT: UserAccountVM = {
  ids: { id: ACCOUNT_IDS.childTevin, orgId: DEMO_ORG_ID },
  contacts: {
    email: 'tevin.morgan@iconic.edu',
    emailVerified: true,
    emailVerifiedAt: '2025-01-02T09:30:00.000Z',
    preferredContactChannels: ['email'],
  },
  access: {
    userRoles: [CHILD_TEVIN_ROLE],
    activeContext: { roleKey: 'child' },
  },
  lifecycle: {
    status: 'active',
    createdAt: '2025-01-02T09:00:00.000Z',
    updatedAt: '2025-02-10T11:15:00.000Z',
  },
};

export const CHILD_TEHARA_ACCOUNT: UserAccountVM = {
  ids: { id: ACCOUNT_IDS.childTehara, orgId: DEMO_ORG_ID },
  contacts: {
    email: 'tehara.morgan@iconic.edu',
    emailVerified: false,
    emailVerifiedAt: null,
    preferredContactChannels: ['email'],
  },
  access: {
    userRoles: [CHILD_TEHARA_ROLE],
    activeContext: { roleKey: 'child' },
  },
  lifecycle: {
    status: 'active',
    createdAt: '2025-01-02T09:05:00.000Z',
    updatedAt: '2025-02-10T11:20:00.000Z',
  },
};

export const CHILD_MAYA_ACCOUNT: UserAccountVM = {
  ids: { id: ACCOUNT_IDS.childMaya, orgId: DEMO_ORG_ID },
  contacts: {
    email: 'maya.morgan@iconic.edu',
    emailVerified: true,
    emailVerifiedAt: '2025-01-02T09:45:00.000Z',
    preferredContactChannels: ['email'],
  },
  access: {
    userRoles: [CHILD_MAYA_ROLE],
    activeContext: { roleKey: 'child' },
  },
  lifecycle: {
    status: 'active',
    createdAt: '2025-01-02T09:10:00.000Z',
    updatedAt: '2025-02-10T11:25:00.000Z',
  },
};

export const EDUCATOR_PRIYA_ACCOUNT: UserAccountVM = {
  ids: { id: ACCOUNT_IDS.educatorPriya, orgId: DEMO_ORG_ID },
  contacts: {
    email: 'priya.nair@iconic.edu',
    phoneE164: '+14155550111',
    emailVerified: true,
    phoneVerified: true,
    emailVerifiedAt: '2024-09-15T10:00:00.000Z',
    phoneVerifiedAt: '2024-09-15T10:10:00.000Z',
    preferredContactChannels: ['email'],
  },
  access: {
    userRoles: [EDUCATOR_PRIYA_ROLE],
    activeContext: { roleKey: 'educator' },
  },
  lifecycle: {
    status: 'active',
    createdAt: '2024-09-01T12:00:00.000Z',
    updatedAt: '2025-01-15T09:30:00.000Z',
  },
};

export const EDUCATOR_ELENA_ACCOUNT: UserAccountVM = {
  ids: { id: ACCOUNT_IDS.educatorElena, orgId: DEMO_ORG_ID },
  contacts: {
    email: 'elena.brooks@iconic.edu',
    phoneE164: '+14155550222',
    emailVerified: true,
    phoneVerified: true,
    emailVerifiedAt: '2024-09-15T10:05:00.000Z',
    phoneVerifiedAt: '2024-09-15T10:15:00.000Z',
    preferredContactChannels: ['email'],
  },
  access: {
    userRoles: [EDUCATOR_ELENA_ROLE],
    activeContext: { roleKey: 'educator' },
  },
  lifecycle: {
    status: 'active',
    createdAt: '2024-09-01T12:05:00.000Z',
    updatedAt: '2025-01-18T10:10:00.000Z',
  },
};

export const EDUCATOR_LUCAS_ACCOUNT: UserAccountVM = {
  ids: { id: ACCOUNT_IDS.educatorLucas, orgId: DEMO_ORG_ID },
  contacts: {
    email: 'lucas.choi@iconic.edu',
    phoneE164: '+14155550333',
    emailVerified: true,
    phoneVerified: false,
    emailVerifiedAt: '2024-09-16T09:00:00.000Z',
    phoneVerifiedAt: null,
    preferredContactChannels: ['email'],
  },
  access: {
    userRoles: [EDUCATOR_LUCAS_ROLE],
    activeContext: { roleKey: 'educator' },
  },
  lifecycle: {
    status: 'active',
    createdAt: '2024-09-01T12:10:00.000Z',
    updatedAt: '2025-01-20T11:00:00.000Z',
  },
};

export const EDUCATOR_MISHAN_ACCOUNT: UserAccountVM = {
  ids: { id: ACCOUNT_IDS.educatorMishan, orgId: DEMO_ORG_ID },
  contacts: {
    email: 'mishan.perera@iconic.edu',
    phoneE164: '+14155550444',
    emailVerified: true,
    phoneVerified: true,
    emailVerifiedAt: '2024-09-20T08:45:00.000Z',
    phoneVerifiedAt: '2024-09-20T08:55:00.000Z',
    preferredContactChannels: ['email', 'sms'],
  },
  access: {
    userRoles: [EDUCATOR_MISHAN_ROLE],
    activeContext: { roleKey: 'educator' },
  },
  lifecycle: {
    status: 'active',
    createdAt: '2024-09-01T12:15:00.000Z',
    updatedAt: '2025-01-25T12:00:00.000Z',
  },
};

export const EDUCATOR_AVA_ACCOUNT: UserAccountVM = {
  ids: { id: ACCOUNT_IDS.educatorAva, orgId: DEMO_ORG_ID },
  contacts: {
    email: 'ava.patel@iconic.edu',
    phoneE164: '+14155550555',
    emailVerified: true,
    phoneVerified: true,
    emailVerifiedAt: '2024-09-20T08:50:00.000Z',
    phoneVerifiedAt: '2024-09-20T09:00:00.000Z',
    preferredContactChannels: ['email'],
  },
  access: {
    userRoles: [EDUCATOR_AVA_ROLE],
    activeContext: { roleKey: 'educator' },
  },
  lifecycle: {
    status: 'active',
    createdAt: '2024-09-01T12:20:00.000Z',
    updatedAt: '2025-01-30T14:00:00.000Z',
  },
};

export const STAFF_SUPPORT_ACCOUNT: UserAccountVM = {
  ids: { id: ACCOUNT_IDS.staffSupport, orgId: DEMO_ORG_ID },
  contacts: {
    email: 'support@iconic.edu',
    phoneE164: '+14155550666',
    emailVerified: true,
    phoneVerified: true,
    emailVerifiedAt: '2024-08-25T09:00:00.000Z',
    phoneVerifiedAt: '2024-08-25T09:10:00.000Z',
    preferredContactChannels: ['email', 'sms'],
  },
  access: {
    userRoles: [STAFF_SUPPORT_ROLE],
    activeContext: { roleKey: 'staff' },
  },
  lifecycle: {
    status: 'active',
    createdAt: '2024-08-15T08:30:00.000Z',
    updatedAt: '2025-02-01T08:00:00.000Z',
  },
};

export const ACCOUNTS: UserAccountVM[] = [
  GUARDIAN_ACCOUNT,
  CHILD_TEVIN_ACCOUNT,
  CHILD_TEHARA_ACCOUNT,
  CHILD_MAYA_ACCOUNT,
  EDUCATOR_PRIYA_ACCOUNT,
  EDUCATOR_ELENA_ACCOUNT,
  EDUCATOR_LUCAS_ACCOUNT,
  EDUCATOR_MISHAN_ACCOUNT,
  EDUCATOR_AVA_ACCOUNT,
  STAFF_SUPPORT_ACCOUNT,
];

export const ACCOUNTS_BY_ID: Record<string, UserAccountVM> = {
  [GUARDIAN_ACCOUNT.ids.id]: GUARDIAN_ACCOUNT,
  [CHILD_TEVIN_ACCOUNT.ids.id]: CHILD_TEVIN_ACCOUNT,
  [CHILD_TEHARA_ACCOUNT.ids.id]: CHILD_TEHARA_ACCOUNT,
  [CHILD_MAYA_ACCOUNT.ids.id]: CHILD_MAYA_ACCOUNT,
  [EDUCATOR_PRIYA_ACCOUNT.ids.id]: EDUCATOR_PRIYA_ACCOUNT,
  [EDUCATOR_ELENA_ACCOUNT.ids.id]: EDUCATOR_ELENA_ACCOUNT,
  [EDUCATOR_LUCAS_ACCOUNT.ids.id]: EDUCATOR_LUCAS_ACCOUNT,
  [EDUCATOR_MISHAN_ACCOUNT.ids.id]: EDUCATOR_MISHAN_ACCOUNT,
  [EDUCATOR_AVA_ACCOUNT.ids.id]: EDUCATOR_AVA_ACCOUNT,
  [STAFF_SUPPORT_ACCOUNT.ids.id]: STAFF_SUPPORT_ACCOUNT,
};

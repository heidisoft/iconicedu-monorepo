import type { UserRoleVM } from '@iconicedu/shared-types';
import { ACCOUNT_IDS, DEMO_ORG_ID } from '@iconicedu/web/lib/data/ids';

export const ROLE_IDS = {
  guardian: '0b1c2d3e-4f50-41a2-9b3c-4d5e6f7a8b90',
  childTevin: '1c2d3e4f-5a60-42b3-8c4d-5e6f7a8b9c01',
  childTehara: '2d3e4f5a-6b70-43c4-9d5e-6f7a8b9c0d12',
  childMaya: '3e4f5a6b-7c80-44d5-8e6f-7a8b9c0d1e23',
  educatorPriya: '4f5a6b7c-8d90-45e6-9f70-8b9c0d1e2f34',
  educatorElena: '5a6b7c8d-9e01-46f7-8a81-9c0d1e2f3a45',
  educatorLucas: '6b7c8d9e-0f12-4708-9b92-ad1e2f3a4b56',
  educatorMishan: '7c8d9e0f-1a23-4819-8ca3-be2f3a4b5c67',
  educatorAva: '8d9e0f1a-2b34-492a-9db4-cf3a4b5c6d78',
  staffSupport: '9e0f1a2b-3c45-4a3b-8ec5-d04b5c6d7e89',
} as const;

export const GUARDIAN_ROLE: UserRoleVM = {
  ids: { id: ROLE_IDS.guardian, orgId: DEMO_ORG_ID },
  roleKey: 'guardian',
  audit: {
    assignedAt: '2025-01-05T14:10:00.000Z',
  },
};

export const CHILD_TEVIN_ROLE: UserRoleVM = {
  ids: { id: ROLE_IDS.childTevin, orgId: DEMO_ORG_ID },
  roleKey: 'child',
  audit: {
    assignedAt: '2025-01-06T10:15:00.000Z',
  },
};

export const CHILD_TEHARA_ROLE: UserRoleVM = {
  ids: { id: ROLE_IDS.childTehara, orgId: DEMO_ORG_ID },
  roleKey: 'child',
  audit: {
    assignedAt: '2025-01-06T10:20:00.000Z',
  },
};

export const CHILD_MAYA_ROLE: UserRoleVM = {
  ids: { id: ROLE_IDS.childMaya, orgId: DEMO_ORG_ID },
  roleKey: 'child',
  audit: {
    assignedAt: '2025-01-06T10:25:00.000Z',
  },
};

export const EDUCATOR_PRIYA_ROLE: UserRoleVM = {
  ids: { id: ROLE_IDS.educatorPriya, orgId: DEMO_ORG_ID },
  roleKey: 'educator',
  audit: {
    assignedAt: '2024-09-12T12:00:00.000Z',
  },
};

export const EDUCATOR_ELENA_ROLE: UserRoleVM = {
  ids: { id: ROLE_IDS.educatorElena, orgId: DEMO_ORG_ID },
  roleKey: 'educator',
  audit: {
    assignedAt: '2024-09-12T12:05:00.000Z',
  },
};

export const EDUCATOR_LUCAS_ROLE: UserRoleVM = {
  ids: { id: ROLE_IDS.educatorLucas, orgId: DEMO_ORG_ID },
  roleKey: 'educator',
  audit: {
    assignedAt: '2024-09-12T12:10:00.000Z',
  },
};

export const EDUCATOR_MISHAN_ROLE: UserRoleVM = {
  ids: { id: ROLE_IDS.educatorMishan, orgId: DEMO_ORG_ID },
  roleKey: 'educator',
  audit: {
    assignedAt: '2024-09-12T12:15:00.000Z',
  },
};

export const EDUCATOR_AVA_ROLE: UserRoleVM = {
  ids: { id: ROLE_IDS.educatorAva, orgId: DEMO_ORG_ID },
  roleKey: 'educator',
  audit: {
    assignedAt: '2024-09-12T12:20:00.000Z',
  },
};

export const STAFF_SUPPORT_ROLE: UserRoleVM = {
  ids: { id: ROLE_IDS.staffSupport, orgId: DEMO_ORG_ID },
  roleKey: 'staff',
  audit: {
    assignedAt: '2024-08-20T09:00:00.000Z',
  },
};

export const USER_ROLES_BY_ACCOUNT = {
  [ACCOUNT_IDS.guardianRiley]: [GUARDIAN_ROLE],
  [ACCOUNT_IDS.childTevin]: [CHILD_TEVIN_ROLE],
  [ACCOUNT_IDS.childTehara]: [CHILD_TEHARA_ROLE],
  [ACCOUNT_IDS.childMaya]: [CHILD_MAYA_ROLE],
  [ACCOUNT_IDS.educatorPriya]: [EDUCATOR_PRIYA_ROLE],
  [ACCOUNT_IDS.educatorElena]: [EDUCATOR_ELENA_ROLE],
  [ACCOUNT_IDS.educatorLucas]: [EDUCATOR_LUCAS_ROLE],
  [ACCOUNT_IDS.educatorMishan]: [EDUCATOR_MISHAN_ROLE],
  [ACCOUNT_IDS.educatorAva]: [EDUCATOR_AVA_ROLE],
  [ACCOUNT_IDS.staffSupport]: [STAFF_SUPPORT_ROLE],
} as const;

export const USER_ROLES: UserRoleVM[] = [
  GUARDIAN_ROLE,
  CHILD_TEVIN_ROLE,
  CHILD_TEHARA_ROLE,
  CHILD_MAYA_ROLE,
  EDUCATOR_PRIYA_ROLE,
  EDUCATOR_ELENA_ROLE,
  EDUCATOR_LUCAS_ROLE,
  EDUCATOR_MISHAN_ROLE,
  EDUCATOR_AVA_ROLE,
  STAFF_SUPPORT_ROLE,
];

import type { FamilyLinkVM, FamilyVM } from '@iconicedu/shared-types';
import {
  ACCOUNT_IDS,
  FAMILY_IDS,
  FAMILY_LINK_IDS,
  DEMO_ORG_ID,
} from '@iconicedu/web/lib/data/ids';

export const MORGAN_FAMILY: FamilyVM = {
  ids: { id: FAMILY_IDS.morganFamily, orgId: DEMO_ORG_ID },
  displayName: 'Morgan Family',
};

export const FAMILY_LINK_RILEY_TEVIN: FamilyLinkVM = {
  ids: {
    id: FAMILY_LINK_IDS.rileyTevin,
    orgId: DEMO_ORG_ID,
    familyId: FAMILY_IDS.morganFamily,
  },
  accounts: {
    guardianAccountId: ACCOUNT_IDS.guardianRiley,
    childAccountId: ACCOUNT_IDS.childTevin,
  },
  relation: 'guardian',
  permissionsScope: ['scheduling', 'billing', 'learning-progress'],
};

export const FAMILY_LINK_RILEY_TEHARA: FamilyLinkVM = {
  ids: {
    id: FAMILY_LINK_IDS.rileyTehara,
    orgId: DEMO_ORG_ID,
    familyId: FAMILY_IDS.morganFamily,
  },
  accounts: {
    guardianAccountId: ACCOUNT_IDS.guardianRiley,
    childAccountId: ACCOUNT_IDS.childTehara,
  },
  relation: 'guardian',
  permissionsScope: ['scheduling', 'learning-progress'],
};

export const FAMILY_LINK_RILEY_MAYA: FamilyLinkVM = {
  ids: {
    id: FAMILY_LINK_IDS.rileyMaya,
    orgId: DEMO_ORG_ID,
    familyId: FAMILY_IDS.morganFamily,
  },
  accounts: {
    guardianAccountId: ACCOUNT_IDS.guardianRiley,
    childAccountId: ACCOUNT_IDS.childMaya,
  },
  relation: 'guardian',
  permissionsScope: ['scheduling', 'learning-progress'],
};

export const FAMILY_LINKS: FamilyLinkVM[] = [
  FAMILY_LINK_RILEY_TEVIN,
  FAMILY_LINK_RILEY_TEHARA,
  FAMILY_LINK_RILEY_MAYA,
];

export const FAMILIES: FamilyVM[] = [MORGAN_FAMILY];

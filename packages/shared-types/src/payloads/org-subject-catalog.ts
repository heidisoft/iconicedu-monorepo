import type { UUID } from '@iconicedu/shared-types/shared/shared';

export type CreateOrgSubjectCatalogItemInput = {
  orgId: UUID;
  subject: string;
};

export type UpdateOrgSubjectCatalogItemInput = {
  orgId: UUID;
  subjectId: UUID;
  isActive: boolean;
};

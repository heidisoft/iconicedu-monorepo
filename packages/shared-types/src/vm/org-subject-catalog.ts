import type { ISODateTime, UUID } from '@iconicedu/shared-types/shared/shared';

export interface OrgSubjectCatalogItemVM {
  id: UUID;
  orgId: UUID;
  subject: string;
  subjectKey: string;
  isActive: boolean;
  sortOrder: number;
  learningSpaceCount: number;
  educatorProfileCount: number;
  usageCount: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface OrgSubjectCatalogSnapshotVM {
  items: OrgSubjectCatalogItemVM[];
}

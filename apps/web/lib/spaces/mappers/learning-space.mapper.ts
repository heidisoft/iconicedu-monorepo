import type {
  ClassScheduleVM,
  LearningSpaceLinkVM,
  LearningSpaceVM,
  UserProfileVM,
  ChannelVM,
} from '@iconicedu/shared-types';
import type { LearningSpaceRow, LearningSpaceLinkRow } from '@iconicedu/shared-types';

type LearningSpaceMapperInput = {
  channels: {
    primaryChannel: ChannelVM;
    relatedChannels?: ChannelVM[];
  };
  participants: UserProfileVM[];
  links?: LearningSpaceLinkVM[] | null;
  scheduleSeries?: ClassScheduleVM | null;
};

export function mapLearningSpaceLinkRow(row: LearningSpaceLinkRow): LearningSpaceLinkVM {
  return {
    label: row.label,
    iconKey: row.icon_key ?? null,
    url: row.url ?? null,
    status: (row.status as LearningSpaceLinkVM['status']) ?? null,
    hidden: row.hidden ?? null,
  };
}

export function mapLearningSpaceRowToVM(
  row: LearningSpaceRow,
  input: LearningSpaceMapperInput,
): LearningSpaceVM {
  return {
    ids: {
      id: row.id,
      orgId: row.org_id,
    },
    basics: {
      kind: row.kind as LearningSpaceVM['basics']['kind'],
      status: row.status as LearningSpaceVM['basics']['status'],
      title: row.title,
      iconKey: row.icon_key ?? null,
      subject: row.subject ?? null,
      description: row.description ?? null,
    },
    channels: {
      primaryChannel: input.channels.primaryChannel,
      relatedChannels: input.channels.relatedChannels ?? undefined,
    },
    schedule: input.scheduleSeries ? { scheduleSeries: input.scheduleSeries } : undefined,
    resources: input.links ? { links: input.links } : undefined,
    lifecycle: {
      createdAt: row.created_at,
      createdBy: row.created_by ?? row.org_id,
      archivedAt: row.archived_at ?? null,
    },
    participants: input.participants,
  };
}

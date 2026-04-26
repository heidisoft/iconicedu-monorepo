import type {
  ChannelCapabilityRow,
  ChannelReadStateRow,
  ChannelRow,
  ChannelUiTabKeyVM,
  ChannelVM,
  ChannelMediaItemVM,
  ChannelFileItemVM,
  MessageVM,
  ChannelContextVM,
  ChannelCapabilityRecordVM,
  ChannelDmVM,
  ChannelMiniVM,
  ChannelReadStateVM,
  ChannelCapabilityVM,
  ChannelLiveSessionConfigVM,
  UserProfileVM,
  EntityRefVM,
  ChannelUiDefaultsVM,
} from '@iconicedu/shared-types';
import { resolveThemeKey } from '@iconicedu/web/lib/profile/derive';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseUiDefaults(uiDefaultsValue: unknown): Partial<ChannelUiDefaultsVM> | null {
  if (!isRecord(uiDefaultsValue)) {
    return null;
  }

  const parsed: Partial<ChannelUiDefaultsVM> = {};

  parsed.themeKey =
    resolveThemeKey(
      typeof uiDefaultsValue.themeKey === 'string' ? uiDefaultsValue.themeKey : null,
    ) ?? null;

  if (typeof uiDefaultsValue.defaultRightPanelOpen === 'boolean') {
    parsed.defaultRightPanelOpen = uiDefaultsValue.defaultRightPanelOpen;
  }

  if (
    typeof uiDefaultsValue.defaultRightPanelKey === 'string' &&
    (uiDefaultsValue.defaultRightPanelKey === 'channel_info' ||
      uiDefaultsValue.defaultRightPanelKey === 'saved')
  ) {
    parsed.defaultRightPanelKey = uiDefaultsValue.defaultRightPanelKey;
  }

  if (Array.isArray(uiDefaultsValue.disabledTabs)) {
    const disabledTabs = uiDefaultsValue.disabledTabs.filter(
      (value): value is ChannelUiTabKeyVM =>
        value === 'messages' ||
        value === 'files' ||
        value === 'schedule' ||
        value === 'saved' ||
        value === 'members',
    );
    if (disabledTabs.length > 0) {
      parsed.disabledTabs = Array.from(new Set(disabledTabs));
    }
  }

  if (isRecord(uiDefaultsValue.infoPanel)) {
    const infoPanel: NonNullable<ChannelUiDefaultsVM['infoPanel']> = {};
    const infoPanelValue = uiDefaultsValue.infoPanel;
    if (typeof infoPanelValue.showHeader === 'boolean') {
      infoPanel.showHeader = infoPanelValue.showHeader;
    }
    if (typeof infoPanelValue.showDetails === 'boolean') {
      infoPanel.showDetails = infoPanelValue.showDetails;
    }
    if (typeof infoPanelValue.showMedia === 'boolean') {
      infoPanel.showMedia = infoPanelValue.showMedia;
    }
    if (typeof infoPanelValue.showMembers === 'boolean') {
      infoPanel.showMembers = infoPanelValue.showMembers;
    }
    if (typeof infoPanelValue.showQuickActions === 'boolean') {
      infoPanel.showQuickActions = infoPanelValue.showQuickActions;
    }
    if (typeof infoPanelValue.showHiddenQuickActions === 'boolean') {
      infoPanel.showHiddenQuickActions = infoPanelValue.showHiddenQuickActions;
    }
    parsed.infoPanel = infoPanel;
  }

  return parsed;
}

function parseLiveSessionConfig(value: unknown): ChannelLiveSessionConfigVM | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.enabled !== 'boolean' || typeof value.provider !== 'string') {
    return null;
  }

  if (
    value.provider !== 'daily' &&
    value.provider !== 'zoom' &&
    value.provider !== 'jitsi' &&
    value.provider !== 'custom'
  ) {
    return null;
  }

  if (
    value.mode !== undefined &&
    value.mode !== null &&
    value.mode !== 'video' &&
    value.mode !== 'audio'
  ) {
    return null;
  }

  return {
    enabled: value.enabled,
    provider: value.provider,
    mode: value.mode === 'video' || value.mode === 'audio' ? value.mode : null,
    joinUrl:
      value.provider === 'custom' &&
      typeof value.joinUrl === 'string' &&
      value.joinUrl.trim().length > 0
        ? value.joinUrl.trim()
        : null,
  };
}

export function mapChannelRowToMiniVM(
  row: ChannelRow,
  input?: {
    participants?: UserProfileVM[];
    context?: ChannelContextVM | null;
    dm?: ChannelDmVM | null;
  },
): ChannelMiniVM {
  return {
    ids: { id: row.id, orgId: row.org_id },
    basics: {
      kind: (row.kind ?? 'channel') as ChannelMiniVM['basics']['kind'],
      topic: row.topic,
      iconKey: row.icon_key ?? undefined,
      visibility: (row.visibility ?? 'private') as ChannelMiniVM['basics']['visibility'],
      purpose: (row.purpose ?? 'general') as ChannelMiniVM['basics']['purpose'],
    },
    lifecycle: {
      status: (row.status ?? 'active') as ChannelMiniVM['lifecycle']['status'],
    },
    dm: input?.dm ?? undefined,
    context: input?.context ?? null,
    participants: input?.participants ?? [],
  };
}

export function mapChannelRowToVM(
  row: ChannelRow,
  input: {
    participants: UserProfileVM[];
    messages: MessageVM[];
    media: ChannelMediaItemVM[];
    files: ChannelFileItemVM[];
    capabilities?: ChannelCapabilityVM[];
    readState?: ChannelReadStateVM;
  },
): ChannelVM {
  const isLearningSpace =
    row.purpose === 'learning-space' || row.primary_entity_kind === 'learning_space';
  const context: ChannelContextVM | null =
    row.primary_entity_kind && row.primary_entity_id
      ? {
          primaryEntity: {
            kind: row.primary_entity_kind as EntityRefVM['kind'],
            id: row.primary_entity_id,
          },
          capabilities: input.capabilities?.length ? input.capabilities : undefined,
          liveSession: parseLiveSessionConfig(row.live_session_config),
        }
      : input.capabilities?.length
        ? {
            capabilities: input.capabilities,
            liveSession: parseLiveSessionConfig(row.live_session_config),
          }
        : parseLiveSessionConfig(row.live_session_config)
          ? { liveSession: parseLiveSessionConfig(row.live_session_config) }
          : null;

  const dm: ChannelDmVM | undefined = row.dm_key ? { dmKey: row.dm_key } : undefined;
  const parsedUiDefaults = parseUiDefaults(row.ui_defaults);
  const channelUiDefaults: ChannelUiDefaultsVM | undefined =
    parsedUiDefaults || row.ui_theme_key || isLearningSpace
      ? {
          ...(parsedUiDefaults ?? {}),
          themeKey:
            resolveThemeKey(row.ui_theme_key ?? null) ??
            parsedUiDefaults?.themeKey ??
            null,
          disabledTabs: parsedUiDefaults?.disabledTabs ?? null,
          defaultRightPanelOpen: parsedUiDefaults?.defaultRightPanelOpen,
          defaultRightPanelKey:
            parsedUiDefaults?.defaultRightPanelKey ??
            (isLearningSpace ? 'channel_info' : undefined),
        }
      : undefined;

  return {
    ids: { id: row.id, orgId: row.org_id },
    basics: {
      kind: (row.kind ?? 'channel') as ChannelVM['basics']['kind'],
      topic: row.topic,
      iconKey: row.icon_key ?? null,
      description: row.description ?? null,
      visibility: (row.visibility ?? 'private') as ChannelVM['basics']['visibility'],
      purpose: (row.purpose ?? 'general') as ChannelVM['basics']['purpose'],
    },
    lifecycle: {
      status: (row.status ?? 'active') as ChannelVM['lifecycle']['status'],
      createdBy: row.created_by_profile_id ?? row.created_by ?? row.org_id,
      createdAt: row.created_at,
      archivedAt: row.archived_at ?? null,
    },
    postingPolicy: {
      kind: (row.posting_policy_kind ??
        'members-only') as ChannelVM['postingPolicy']['kind'],
      allowThreads: row.allow_threads ?? undefined,
      allowReactions: row.allow_reactions ?? undefined,
    },
    dm,
    context,
    collections: {
      participants: input.participants,
      messages: {
        items: input.messages,
        total: input.messages.length,
      },
      media: {
        items: input.media,
        total: input.media.length,
      },
      files: {
        items: input.files,
        total: input.files.length,
      },
      readState: input.readState,
    },
    ui: channelUiDefaults,
  };
}

export function mapChannelCapabilityRow(row: ChannelCapabilityRow): ChannelCapabilityVM {
  return row.capability as ChannelCapabilityVM;
}

export function mapChannelCapabilityRowToRecordVM(
  row: ChannelCapabilityRow,
): ChannelCapabilityRecordVM {
  return {
    ids: {
      id: row.id,
      orgId: row.org_id,
      channelId: row.channel_id,
    },
    capability: row.capability as ChannelCapabilityRecordVM['capability'],
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

export function mapChannelReadStateRow(row: ChannelReadStateRow): ChannelReadStateVM {
  return {
    channelId: row.channel_id,
    lastReadMessageId: row.last_read_message_id ?? undefined,
    lastReadAt: row.last_read_at ?? undefined,
    unreadCount: Math.max(0, row.unread_count ?? 0),
    threadUnreadCount: Math.max(0, row.thread_unread_count ?? 0),
  };
}

export function createDefaultChannelReadState(channelId: string): ChannelReadStateVM {
  return {
    channelId,
    unreadCount: 0,
  };
}

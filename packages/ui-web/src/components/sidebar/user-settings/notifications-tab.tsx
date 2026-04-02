import * as React from 'react';
import { Bell, ChevronDown, Megaphone, Wallet } from 'lucide-react';
import { reportObservedError } from '@iconicedu/utils';

import { Button } from '@iconicedu/ui-web/ui/button';
import { UserSettingsTabSection } from '@iconicedu/ui-web/components/sidebar/user-settings/components/user-settings-tab-section';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { Switch } from '@iconicedu/ui-web/ui/switch';
import { toast } from 'sonner';
import { notificationChannelOptions } from '@iconicedu/ui-web/components/sidebar/user-settings/constants';
import type { ActivityVerbVM } from '@iconicedu/shared-types';

const GLOBAL_ALERT_SCOPE_ID = '__global__';

type NotificationSectionItem = {
  key: string;
  label: string;
};

type NotificationSection = {
  key: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NotificationSectionItem[];
};

type ScopedNotificationPreference = {
  scopeKind: 'channel' | 'learning_space';
  scopeId: string;
  prefKey: string;
  channels: string[];
  muted?: boolean | null;
};

const defineNotificationItems = <T extends NotificationSectionItem[]>(items: T) => items;

const ACTIVITY_SCOPED_VERB_KEYS: ActivityVerbVM[] = [
  'class.created',
  'classes.created',
  'class.updated',
  'classes.updated',
  'class.archived',
  'classes.archived',
  'class.session.scheduled',
  'class.sessions.scheduled',
  'class.session.rescheduled',
  'class.sessions.rescheduled',
  'class.session.canceled',
  'class.sessions.canceled',
  'session.started',
  'sessions.started',
  'session.ended',
  'sessions.ended',
  'dm.posted',
  'dms.posted',
  'dm.edited',
  'dms.edited',
  'dm.deleted',
  'dms.deleted',
  'dm.reaction.added',
  'dms.reactions.added',
  'dm.reaction.removed',
  'dms.reactions.removed',
  'message.posted',
  'messages.posted',
  'message.edited',
  'messages.edited',
  'message.deleted',
  'messages.deleted',
  'reaction.added',
  'reactions.added',
  'reaction.removed',
  'reactions.removed',
  'homework.assigned',
  'homeworks.assigned',
  'homework.submitted',
  'homeworks.submitted',
  'homework.reviewed',
  'homeworks.reviewed',
  'summary.posted',
  'summaries.posted',
  'file.uploaded',
  'files.uploaded',
  'file.deleted',
  'files.deleted',
  'member.invited',
  'members.invited',
  'members.joined',
  'members.removed',
  'member.joined',
  'member.removed',
  'payment.reminder',
  'payments.reminder',
  'payment.reminder.sent',
  'payments.reminder.sent',
  'payment.received',
  'payments.received',
  'payment.failed',
  'payments.failed',
  'session.reminder.sent',
  'sessions.reminder.sent',
  'session.feedback_request.sent',
  'sessions.feedback_request.sent',
  'system.notice',
  'systems.notice',
];

const ACTIVITY_VERB_CONTEXT_ORDER = [
  'Class',
  'Session',
  'Direct Message',
  'Channel Message',
  'Homework',
  'Files & Notes',
  'Membership',
  'Billing',
  'System',
  'Other',
] as const;

function resolveActivityVerbContext(
  verb: ActivityVerbVM,
): (typeof ACTIVITY_VERB_CONTEXT_ORDER)[number] {
  if (verb.startsWith('class.') || verb.startsWith('classes.')) {
    return 'Class';
  }
  if (verb.startsWith('session.') || verb.startsWith('sessions.')) {
    return 'Session';
  }
  if (verb.startsWith('dm.') || verb.startsWith('dms.')) {
    return 'Direct Message';
  }
  if (
    verb.startsWith('message.') ||
    verb.startsWith('messages.') ||
    verb.startsWith('reaction.') ||
    verb.startsWith('reactions.')
  ) {
    return 'Channel Message';
  }
  if (verb.startsWith('homework.') || verb.startsWith('homeworks.')) {
    return 'Homework';
  }
  if (verb.startsWith('summary.') || verb.startsWith('summaries.')) {
    return 'Session';
  }
  if (
    verb.startsWith('file.') ||
    verb.startsWith('files.') ||
    verb.startsWith('notes.')
  ) {
    return 'Files & Notes';
  }
  if (
    verb.startsWith('member.') ||
    verb.startsWith('members.') ||
    verb.startsWith('role.') ||
    verb.startsWith('roles.')
  ) {
    return 'Membership';
  }
  if (verb.startsWith('payment.') || verb.startsWith('payments.')) {
    return 'Billing';
  }
  if (verb.startsWith('system.') || verb.startsWith('systems.')) {
    return 'System';
  }
  return 'Other';
}

function toTitleCaseToken(token: string): string {
  if (!token.length) {
    return token;
  }
  return token[0].toUpperCase() + token.slice(1).toLowerCase();
}

function formatActivityVerbLabel(verb: ActivityVerbVM): string {
  if (verb === 'session.reminder.sent' || verb === 'sessions.reminder.sent') {
    return 'Session - Reminders';
  }
  if (
    verb === 'session.feedback_request.sent' ||
    verb === 'sessions.feedback_request.sent'
  ) {
    return 'Session - Feedback Request';
  }

  return verb
    .split('.')
    .map((segment) =>
      segment
        .split('_')
        .map((token) => {
          if (token === 'dm' || token === 'dms') {
            return 'Direct Message';
          }
          if (token === 'class' || token === 'classes') {
            return 'Classroom';
          }
          return toTitleCaseToken(token);
        })
        .join(' '),
    )
    .join(' - ');
}

type VerbContext = (typeof ACTIVITY_VERB_CONTEXT_ORDER)[number];

type ScopedVerbFamily = {
  primaryKey: ActivityVerbVM;
  keys: ActivityVerbVM[];
  context: VerbContext;
  label: string;
};

function singularizeVerbToken(token: string): string {
  if (token === 'classes') {
    return 'class';
  }
  if (token === 'class') {
    return 'class';
  }
  if (token.endsWith('s')) {
    return token.slice(0, -1);
  }
  return token;
}

function normalizeVerbSignature(verb: ActivityVerbVM): string {
  return verb
    .split('.')
    .map((token) => singularizeVerbToken(token))
    .join('.');
}

type NotificationsTabProps = {
  isGuardianOrAdmin: boolean;
  notificationChannels: Record<string, string[]>;
  onNotificationChannelsChange: React.Dispatch<
    React.SetStateAction<Record<string, string[]>>
  >;
  profileId: string;
  orgId: string;
  onNotificationPreferenceSave?: (input: {
    profileId: string;
    orgId: string;
    prefKey: string;
    channels: string[];
    muted?: boolean | null;
    scopeKind?: 'channel' | 'learning_space';
    scopeId?: string;
  }) => Promise<void> | void;
  onNotificationPreferenceScopeDelete?: (input: {
    profileId: string;
    orgId: string;
    prefKey: string;
    scopeKind: 'channel' | 'learning_space';
    scopeId: string;
  }) => Promise<void> | void;
  notificationScopedDefaults?: ScopedNotificationPreference[];
  availableAlertChannels: Array<{
    id: string;
    label: string;
    kind?: 'channel' | 'dm' | 'group_dm';
  }>;
  availableAlertLearningSpaces: Array<{ id: string; label: string }>;
};

export function NotificationsTab({
  isGuardianOrAdmin,
  notificationChannels,
  onNotificationChannelsChange,
  profileId,
  orgId,
  onNotificationPreferenceSave,
  onNotificationPreferenceScopeDelete,
  notificationScopedDefaults = [],
  availableAlertChannels,
  availableAlertLearningSpaces,
}: NotificationsTabProps) {
  const sections = [
    {
      key: 'general',
      title: 'General',
      icon: Bell,
      items: defineNotificationItems([
        {
          key: 'defaults.weekly_digest',
          label: 'Weekly digest of class activity',
        },
      ]),
    },
    ...(isGuardianOrAdmin
      ? [
          {
            key: 'billing',
            title: 'Billing & Payments',
            icon: Wallet,
            items: defineNotificationItems([
              { key: 'payment.reminder', label: 'Payment reminder' },
              { key: 'payment.received', label: 'Payment received' },
              { key: 'payment.failed', label: 'Payment failed' },
            ]),
          },
        ]
      : []),
    {
      key: 'system',
      title: 'System Verb Notifications',
      icon: Megaphone,
      items: defineNotificationItems([{ key: 'system.notice', label: 'System notices' }]),
    },
  ] satisfies NotificationSection[];

  const notificationKeys = React.useMemo(
    () =>
      new Set<string>(
        sections.flatMap((section) => section.items.map((item) => item.key)),
      ),
    [sections],
  );

  const scopedChannels = React.useMemo(() => {
    const entries = Object.entries(notificationChannels).filter(([key]) =>
      notificationKeys.has(key),
    );
    return Object.fromEntries(entries);
  }, [notificationChannels, notificationKeys]);
  const scopedVerbLabels = React.useMemo(
    () =>
      new Map<string, string>(
        ACTIVITY_SCOPED_VERB_KEYS.map((verb) => [verb, formatActivityVerbLabel(verb)]),
      ),
    [],
  );
  const scopedVerbFamilies = React.useMemo(() => {
    const verbsBySignature = new Map<string, ActivityVerbVM[]>();
    for (const verb of ACTIVITY_SCOPED_VERB_KEYS) {
      const signature = normalizeVerbSignature(verb);
      const existing = verbsBySignature.get(signature) ?? [];
      existing.push(verb);
      verbsBySignature.set(signature, existing);
    }

    const families: ScopedVerbFamily[] = [];
    for (const [signature, keys] of verbsBySignature.entries()) {
      const primaryKey = (keys.find((key) => key === (signature as ActivityVerbVM)) ??
        keys[0]) as ActivityVerbVM;
      families.push({
        primaryKey,
        keys,
        context: resolveActivityVerbContext(primaryKey),
        label: scopedVerbLabels.get(primaryKey) ?? formatActivityVerbLabel(primaryKey),
      });
    }

    families.sort(
      (a, b) =>
        ACTIVITY_SCOPED_VERB_KEYS.indexOf(a.primaryKey) -
        ACTIVITY_SCOPED_VERB_KEYS.indexOf(b.primaryKey),
    );
    return families;
  }, [scopedVerbLabels]);
  const scopedVerbGroups = React.useMemo(() => {
    const grouped = new Map<VerbContext, ScopedVerbFamily[]>();
    for (const verbFamily of scopedVerbFamilies) {
      const context = verbFamily.context;
      const existing = grouped.get(context) ?? [];
      existing.push(verbFamily);
      grouped.set(context, existing);
    }
    return ACTIVITY_VERB_CONTEXT_ORDER.map((context) => ({
      context,
      verbs: grouped.get(context) ?? [],
    })).filter((group) => group.verbs.length > 0);
  }, [scopedVerbFamilies]);
  const channelAlertVerbGroups = React.useMemo(
    () =>
      scopedVerbGroups
        .filter(
          (group) =>
            group.context !== 'Direct Message' &&
            group.context !== 'Class' &&
            group.context !== 'Session' &&
            group.context !== 'Homework' &&
            group.context !== 'Billing' &&
            group.context !== 'System',
        )
        .map((group) => ({
          ...group,
          verbs: group.verbs.filter(
            (verbFamily) =>
              !verbFamily.keys.includes('summary.posted') &&
              !verbFamily.keys.includes('summaries.posted'),
          ),
        }))
        .filter((group) => group.verbs.length > 0),
    [scopedVerbGroups],
  );
  const classroomAlertVerbGroups = React.useMemo(
    () =>
      scopedVerbGroups.filter(
        (group) =>
          group.context !== 'Direct Message' &&
          group.context !== 'Billing' &&
          group.context !== 'System',
      ),
    [scopedVerbGroups],
  );
  const availableNonDmAlertChannels = React.useMemo(
    () =>
      availableAlertChannels.filter(
        (channel) => channel.kind !== 'dm' && channel.kind !== 'group_dm',
      ),
    [availableAlertChannels],
  );
  const availableDirectMessageAlertChannels = React.useMemo(
    () =>
      availableAlertChannels.filter(
        (channel) => channel.kind === 'dm' || channel.kind === 'group_dm',
      ),
    [availableAlertChannels],
  );
  const directMessageAlertVerbGroups = React.useMemo(() => {
    const directMessageGroups = scopedVerbGroups.filter(
      (group) => group.context === 'Direct Message',
    );
    const dmFileVerbFamilies = scopedVerbFamilies.filter(
      (verbFamily) =>
        verbFamily.keys.includes('file.uploaded') ||
        verbFamily.keys.includes('files.uploaded') ||
        verbFamily.keys.includes('file.deleted') ||
        verbFamily.keys.includes('files.deleted'),
    );
    if (!dmFileVerbFamilies.length) {
      return directMessageGroups;
    }
    return [
      ...directMessageGroups,
      {
        context: 'Files & Notes' as const,
        verbs: dmFileVerbFamilies,
      },
    ];
  }, [scopedVerbFamilies, scopedVerbGroups]);

  const [selectedScopedChannelId, setSelectedScopedChannelId] =
    React.useState<string>(GLOBAL_ALERT_SCOPE_ID);
  const [selectedScopedDmChannelId, setSelectedScopedDmChannelId] =
    React.useState<string>(GLOBAL_ALERT_SCOPE_ID);
  const [selectedScopedLearningSpaceId, setSelectedScopedLearningSpaceId] =
    React.useState<string>(GLOBAL_ALERT_SCOPE_ID);

  const [, setPendingPreferenceToasts] = React.useState<Record<string, boolean>>({});
  const pendingToastTimers = React.useRef<Record<string, number>>({});

  const toggleNotificationChannel = React.useCallback(
    (itemKey: string, channel: string, enabled: boolean) => {
      const current = notificationChannels[itemKey] ?? [];
      const hasChannel = current.includes(channel);
      if (enabled && hasChannel) {
        return;
      }
      if (!enabled && !hasChannel) {
        return;
      }
      const nextChannels = enabled
        ? [...current, channel]
        : current.filter((entry) => entry !== channel);
      onNotificationChannelsChange((prev) => ({
        ...prev,
        [itemKey]: nextChannels,
      }));
      if (onNotificationPreferenceSave) {
        const promise = onNotificationPreferenceSave({
          profileId,
          orgId,
          prefKey: itemKey,
          channels: nextChannels,
        });
        if (promise) {
          void promise
            .then(() => {
              setPendingPreferenceToasts((prev) => ({
                ...prev,
                [itemKey]: true,
              }));
            })
            .catch((error: unknown) => {
              reportObservedError({
                error,
                source: 'web.user_settings.notifications.save_preference',
                message: 'Failed to persist notification preference changes',
                context: {
                  profileId,
                  orgId,
                  itemKey,
                },
              });
            });
        }
      }
    },
    [
      notificationChannels,
      onNotificationChannelsChange,
      onNotificationPreferenceSave,
      profileId,
      orgId,
    ],
  );

  const handleMenuOpenChange = React.useCallback((itemKey: string, open: boolean) => {
    if (open) {
      return;
    }
    setPendingPreferenceToasts((prev) => {
      if (!prev[itemKey]) {
        return prev;
      }
      const now = Date.now();
      const lastToast = pendingToastTimers.current[itemKey] ?? 0;
      if (now - lastToast > 2000) {
        toast.success('Notification preferences saved');
        pendingToastTimers.current[itemKey] = now;
      }
      const next = { ...prev };
      delete next[itemKey];
      return next;
    });
  }, []);

  const formatNotificationChannels = (itemKey: string) => {
    const selected = scopedChannels[itemKey] ?? [];
    if (!selected.length) {
      return 'Off';
    }
    return selected
      .map(
        (key) => notificationChannelOptions.find((option) => option.key === key)?.label,
      )
      .filter(Boolean)
      .join(', ');
  };

  const scopedPreferenceByKey = React.useMemo(() => {
    return new Map<string, ScopedNotificationPreference>(
      notificationScopedDefaults.map((row) => [
        `${row.scopeKind}:${row.scopeId}:${row.prefKey}`,
        row,
      ]),
    );
  }, [notificationScopedDefaults]);

  const getScopedChannels = React.useCallback(
    (input: {
      scopeKind: 'channel' | 'learning_space';
      scopeId: string;
      prefKey: string;
    }): string[] => {
      const row = scopedPreferenceByKey.get(
        `${input.scopeKind}:${input.scopeId}:${input.prefKey}`,
      );
      if (row) {
        return row.channels ?? [];
      }
      return notificationChannels[input.prefKey] ?? [];
    },
    [notificationChannels, scopedPreferenceByKey],
  );

  const saveScopedPreference = React.useCallback(
    (input: {
      scopeKind: 'channel' | 'learning_space';
      scopeId: string;
      prefKey: string;
      channels: string[];
    }) => {
      if (!onNotificationPreferenceSave) {
        return;
      }
      return onNotificationPreferenceSave({
        profileId,
        orgId,
        prefKey: input.prefKey,
        channels: input.channels,
        scopeKind: input.scopeKind,
        scopeId: input.scopeId,
      });
    },
    [onNotificationPreferenceSave, orgId, profileId],
  );

  const resetScopedPreference = React.useCallback(
    (input: {
      scopeKind: 'channel' | 'learning_space';
      scopeId: string;
      prefKey: string;
    }) => {
      if (!onNotificationPreferenceScopeDelete) {
        return;
      }
      return onNotificationPreferenceScopeDelete({
        profileId,
        orgId,
        prefKey: input.prefKey,
        scopeKind: input.scopeKind,
        scopeId: input.scopeId,
      });
    },
    [onNotificationPreferenceScopeDelete, orgId, profileId],
  );

  const formatScopedChannels = React.useCallback(
    (input: {
      scopeKind: 'channel' | 'learning_space';
      scopeId: string;
      prefKey: string;
    }) => {
      const selected = getScopedChannels(input);
      if (!selected.length) {
        return 'Off';
      }
      return selected
        .map(
          (key) => notificationChannelOptions.find((option) => option.key === key)?.label,
        )
        .filter(Boolean)
        .join(', ');
    },
    [getScopedChannels],
  );
  const getScopedChannelsForVerbFamily = React.useCallback(
    (input: {
      scopeKind: 'channel' | 'learning_space';
      scopeId: string;
      prefKeys: ActivityVerbVM[];
    }): string[] =>
      input.scopeId === GLOBAL_ALERT_SCOPE_ID
        ? Array.from(
            new Set(
              input.prefKeys.flatMap((prefKey) => notificationChannels[prefKey] ?? []),
            ),
          )
        : Array.from(
            new Set(
              input.prefKeys.flatMap((prefKey) =>
                getScopedChannels({
                  scopeKind: input.scopeKind,
                  scopeId: input.scopeId,
                  prefKey,
                }),
              ),
            ),
          ),
    [getScopedChannels, notificationChannels],
  );

  const saveScopedPreferenceForVerbFamily = React.useCallback(
    async (input: {
      scopeKind: 'channel' | 'learning_space';
      scopeId: string;
      prefKeys: ActivityVerbVM[];
      channels: string[];
    }) => {
      await Promise.all(
        input.prefKeys.map((prefKey) =>
          Promise.resolve(
            saveScopedPreference({
              scopeKind: input.scopeKind,
              scopeId: input.scopeId,
              prefKey,
              channels: input.channels,
            }),
          ),
        ),
      );
    },
    [saveScopedPreference],
  );

  const savePreferenceForVerbFamily = React.useCallback(
    async (input: {
      scopeKind: 'channel' | 'learning_space';
      scopeId: string;
      prefKeys: ActivityVerbVM[];
      channels: string[];
    }) => {
      if (input.scopeId === GLOBAL_ALERT_SCOPE_ID) {
        onNotificationChannelsChange((prev) => {
          const next = { ...prev };
          input.prefKeys.forEach((prefKey) => {
            next[prefKey] = input.channels;
          });
          return next;
        });

        if (!onNotificationPreferenceSave) {
          return;
        }

        await Promise.all(
          input.prefKeys.map((prefKey) =>
            Promise.resolve(
              onNotificationPreferenceSave({
                profileId,
                orgId,
                prefKey,
                channels: input.channels,
              }),
            ),
          ),
        );
        return;
      }

      await saveScopedPreferenceForVerbFamily(input);
    },
    [
      onNotificationChannelsChange,
      onNotificationPreferenceSave,
      orgId,
      profileId,
      saveScopedPreferenceForVerbFamily,
    ],
  );

  const resetScopedPreferenceForVerbFamily = React.useCallback(
    async (input: {
      scopeKind: 'channel' | 'learning_space';
      scopeId: string;
      prefKeys: ActivityVerbVM[];
    }) => {
      await Promise.all(
        input.prefKeys.map((prefKey) =>
          Promise.resolve(
            resetScopedPreference({
              scopeKind: input.scopeKind,
              scopeId: input.scopeId,
              prefKey,
            }),
          ),
        ),
      );
    },
    [resetScopedPreference],
  );
  const resetPreferenceForVerbFamily = React.useCallback(
    async (input: {
      scopeKind: 'channel' | 'learning_space';
      scopeId: string;
      prefKeys: ActivityVerbVM[];
    }) => {
      if (input.scopeId === GLOBAL_ALERT_SCOPE_ID) {
        onNotificationChannelsChange((prev) => {
          const next = { ...prev };
          input.prefKeys.forEach((prefKey) => {
            next[prefKey] = [];
          });
          return next;
        });

        if (!onNotificationPreferenceSave) {
          return;
        }

        await Promise.all(
          input.prefKeys.map((prefKey) =>
            Promise.resolve(
              onNotificationPreferenceSave({
                profileId,
                orgId,
                prefKey,
                channels: [],
              }),
            ),
          ),
        );
        return;
      }

      await resetScopedPreferenceForVerbFamily(input);
    },
    [
      onNotificationChannelsChange,
      onNotificationPreferenceSave,
      orgId,
      profileId,
      resetScopedPreferenceForVerbFamily,
    ],
  );

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Notifications</h3>
            <p className="text-sm text-muted-foreground">
              Configure alerts, digests, and account notifications.
            </p>
          </div>
        </div>
        <div className="space-y-1 w-full">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <UserSettingsTabSection
                key={section.key}
                icon={<Icon className="h-5 w-5" />}
                title={section.title}
                subtitle={`${section.items.length} options`}
                showSeparator={index < sections.length - 1}
              >
                <div className="space-y-3">
                  {section.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-start justify-between gap-4 text-sm"
                    >
                      <span className="leading-5">{item.label}</span>
                      <DropdownMenu
                        onOpenChange={(open) => handleMenuOpenChange(item.key, open)}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs"
                          >
                            {formatNotificationChannels(item.key)}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {notificationChannelOptions.map((option) => {
                            const isChecked =
                              scopedChannels[item.key]?.includes(option.key) ?? false;
                            return (
                              <DropdownMenuItem
                                key={option.key}
                                onSelect={(event) => event.preventDefault()}
                                className="flex items-center justify-between gap-3"
                              >
                                <span>{option.label}</span>
                                <Switch
                                  checked={isChecked}
                                  onCheckedChange={(checked) =>
                                    toggleNotificationChannel(
                                      item.key,
                                      option.key,
                                      checked,
                                    )
                                  }
                                  aria-label={`${option.label} notifications for ${item.label}`}
                                />
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </UserSettingsTabSection>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <UserSettingsTabSection
          icon={<Bell className="h-5 w-5" />}
          title="Channel alerts"
          subtitle="Per-verb overrides for a specific channel"
          showSeparator={true}
        >
          <div className="space-y-3">
            <Select
              value={selectedScopedChannelId}
              onValueChange={setSelectedScopedChannelId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL_ALERT_SCOPE_ID}>
                  Global (all channels)
                </SelectItem>
                {availableNonDmAlertChannels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {channelAlertVerbGroups.map((group) => (
              <div key={`channel-group-${group.context}`} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.context}
                </p>
                {group.verbs.map((verbFamily) => (
                  <div
                    key={`channel-${verbFamily.primaryKey}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm">{verbFamily.label}</span>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs"
                          >
                            {formatScopedChannels({
                              scopeKind: 'channel',
                              scopeId: selectedScopedChannelId,
                              prefKey: verbFamily.primaryKey,
                            })}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {notificationChannelOptions.map((option) => {
                            const currentChannels = getScopedChannelsForVerbFamily({
                              scopeKind: 'channel',
                              scopeId: selectedScopedChannelId,
                              prefKeys: verbFamily.keys,
                            });
                            const isChecked = currentChannels.includes(option.key);
                            return (
                              <DropdownMenuItem
                                key={option.key}
                                onSelect={(event) => event.preventDefault()}
                                className="flex items-center justify-between gap-3"
                              >
                                <span>{option.label}</span>
                                <Switch
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const nextChannels = checked
                                      ? [...currentChannels, option.key]
                                      : currentChannels.filter(
                                          (item) => item !== option.key,
                                        );
                                    void savePreferenceForVerbFamily({
                                      scopeKind: 'channel',
                                      scopeId: selectedScopedChannelId,
                                      prefKeys: verbFamily.keys,
                                      channels: Array.from(new Set(nextChannels)),
                                    });
                                  }}
                                  aria-label={`${option.label} notifications for ${verbFamily.label}`}
                                />
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() =>
                          void resetPreferenceForVerbFamily({
                            scopeKind: 'channel',
                            scopeId: selectedScopedChannelId,
                            prefKeys: verbFamily.keys,
                          })
                        }
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {availableNonDmAlertChannels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No non-direct-message channels available for overrides.
              </p>
            ) : null}
          </div>
        </UserSettingsTabSection>
      </div>

      <div className="space-y-3">
        <UserSettingsTabSection
          icon={<Bell className="h-5 w-5" />}
          title="Direct message alerts"
          subtitle="Per-verb overrides for direct and group direct messages"
          showSeparator={true}
        >
          <div className="space-y-3">
            <Select
              value={selectedScopedDmChannelId}
              onValueChange={setSelectedScopedDmChannelId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a direct message" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL_ALERT_SCOPE_ID}>
                  Global (all direct messages)
                </SelectItem>
                {availableDirectMessageAlertChannels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {directMessageAlertVerbGroups.map((group) => (
              <div key={`dm-group-${group.context}`} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.context}
                </p>
                {group.verbs.map((verbFamily) => (
                  <div
                    key={`dm-${verbFamily.primaryKey}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm">{verbFamily.label}</span>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs"
                          >
                            {formatScopedChannels({
                              scopeKind: 'channel',
                              scopeId: selectedScopedDmChannelId,
                              prefKey: verbFamily.primaryKey,
                            })}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {notificationChannelOptions.map((option) => {
                            const currentChannels = getScopedChannelsForVerbFamily({
                              scopeKind: 'channel',
                              scopeId: selectedScopedDmChannelId,
                              prefKeys: verbFamily.keys,
                            });
                            const isChecked = currentChannels.includes(option.key);
                            return (
                              <DropdownMenuItem
                                key={option.key}
                                onSelect={(event) => event.preventDefault()}
                                className="flex items-center justify-between gap-3"
                              >
                                <span>{option.label}</span>
                                <Switch
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const nextChannels = checked
                                      ? [...currentChannels, option.key]
                                      : currentChannels.filter(
                                          (item) => item !== option.key,
                                        );
                                    void savePreferenceForVerbFamily({
                                      scopeKind: 'channel',
                                      scopeId: selectedScopedDmChannelId,
                                      prefKeys: verbFamily.keys,
                                      channels: Array.from(new Set(nextChannels)),
                                    });
                                  }}
                                  aria-label={`${option.label} notifications for ${verbFamily.label}`}
                                />
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() =>
                          void resetPreferenceForVerbFamily({
                            scopeKind: 'channel',
                            scopeId: selectedScopedDmChannelId,
                            prefKeys: verbFamily.keys,
                          })
                        }
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {availableDirectMessageAlertChannels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No direct message channels available for overrides.
              </p>
            ) : null}
          </div>
        </UserSettingsTabSection>
      </div>

      <div className="space-y-3">
        <UserSettingsTabSection
          icon={<Megaphone className="h-5 w-5" />}
          title="Classroom alerts"
          subtitle="Per-verb overrides for a specific classroom"
          showSeparator={false}
        >
          <div className="space-y-3">
            <Select
              value={selectedScopedLearningSpaceId}
              onValueChange={setSelectedScopedLearningSpaceId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a classroom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL_ALERT_SCOPE_ID}>
                  Global (all classrooms)
                </SelectItem>
                {availableAlertLearningSpaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {classroomAlertVerbGroups.map((group) => (
              <div key={`learning-space-group-${group.context}`} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.context}
                </p>
                {group.verbs.map((verbFamily) => (
                  <div
                    key={`learning-space-${verbFamily.primaryKey}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm">{verbFamily.label}</span>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs"
                          >
                            {formatScopedChannels({
                              scopeKind: 'learning_space',
                              scopeId: selectedScopedLearningSpaceId,
                              prefKey: verbFamily.primaryKey,
                            })}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {notificationChannelOptions.map((option) => {
                            const currentChannels = getScopedChannelsForVerbFamily({
                              scopeKind: 'learning_space',
                              scopeId: selectedScopedLearningSpaceId,
                              prefKeys: verbFamily.keys,
                            });
                            const isChecked = currentChannels.includes(option.key);
                            return (
                              <DropdownMenuItem
                                key={option.key}
                                onSelect={(event) => event.preventDefault()}
                                className="flex items-center justify-between gap-3"
                              >
                                <span>{option.label}</span>
                                <Switch
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const nextChannels = checked
                                      ? [...currentChannels, option.key]
                                      : currentChannels.filter(
                                          (item) => item !== option.key,
                                        );
                                    void savePreferenceForVerbFamily({
                                      scopeKind: 'learning_space',
                                      scopeId: selectedScopedLearningSpaceId,
                                      prefKeys: verbFamily.keys,
                                      channels: Array.from(new Set(nextChannels)),
                                    });
                                  }}
                                  aria-label={`${option.label} notifications for ${verbFamily.label}`}
                                />
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() =>
                          void resetPreferenceForVerbFamily({
                            scopeKind: 'learning_space',
                            scopeId: selectedScopedLearningSpaceId,
                            prefKeys: verbFamily.keys,
                          })
                        }
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {availableAlertLearningSpaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No classrooms available for overrides.
              </p>
            ) : null}
          </div>
        </UserSettingsTabSection>
      </div>
    </div>
  );
}

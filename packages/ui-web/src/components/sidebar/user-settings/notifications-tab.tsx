import * as React from 'react';
import {
  Bell,
  BookOpen,
  ChevronDown,
  Clock,
  FileText,
  Megaphone,
  MessageCircle,
  Wallet,
} from 'lucide-react';

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
  availableAlertChannels: Array<{ id: string; label: string }>;
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
      title: 'General Notifications',
      icon: Bell,
      items: defineNotificationItems([
        {
          key: 'defaults.message_updates',
          label: 'Master message update setting',
        },
        {
          key: 'defaults.weekly_digest',
          label: 'Weekly digest of class activity',
        },
        { key: 'defaults.sms_reminders', label: 'SMS reminders for upcoming sessions' },
        { key: 'system.alerts', label: 'System alerts and service notices' },
      ]),
    },
    {
      key: 'messages',
      title: 'Messages',
      icon: MessageCircle,
      items: defineNotificationItems([
        { key: 'dm.posted', label: 'Direct message posted' },
        { key: 'dm.reaction.added', label: 'Direct message reaction added' },
        { key: 'dm.reaction.removed', label: 'Direct message reaction removed' },
        { key: 'message.posted', label: 'Channel/class message posted' },
        { key: 'file.uploaded', label: 'File uploaded' },
      ]),
    },
    {
      key: 'schedule',
      title: 'Schedule & Sessions',
      icon: Clock,
      items: defineNotificationItems([
        { key: 'session.scheduled', label: 'Session scheduled' },
        { key: 'session.rescheduled', label: 'Session rescheduled' },
        { key: 'session.canceled', label: 'Session canceled' },
        { key: 'session.started', label: 'Session started' },
        { key: 'session.ended', label: 'Session ended' },
        { key: 'session.completed', label: 'Session completed' },
        { key: 'session.reminder.sent', label: 'Session reminder sent' },
        {
          key: 'session.feedback_request.sent',
          label: 'Session feedback request sent',
        },
      ]),
    },
    {
      key: 'classrooms',
      title: 'Classrooms',
      icon: BookOpen,
      items: defineNotificationItems([
        { key: 'class.created', label: 'Class created' },
        { key: 'class.updated', label: 'Class updated' },
        { key: 'class.archived', label: 'Class archived' },
        { key: 'member.invited', label: 'Participant invited' },
        { key: 'members.invited', label: 'Participants invited' },
        { key: 'member.joined', label: 'Participant joined' },
        { key: 'member.removed', label: 'Participant removed' },
        { key: 'members.removed', label: 'Participants removed' },
        { key: 'role.changed', label: 'Participant role changed' },
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
              { key: 'payment.reminder.sent', label: 'Payment reminder sent' },
              { key: 'payment.received', label: 'Payment received' },
              { key: 'payment.failed', label: 'Payment failed' },
            ]),
          },
        ]
      : []),
    {
      key: 'homework',
      title: 'Homework',
      icon: FileText,
      items: defineNotificationItems([
        { key: 'homework.assigned', label: 'Homework assigned' },
      ]),
    },
    {
      key: 'system',
      title: 'System Verb Notifications',
      icon: Megaphone,
      items: defineNotificationItems([
        { key: 'system.notice', label: 'System notice events' },
      ]),
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
  const scopedVerbKeys = React.useMemo(
    () =>
      sections
        .filter((section) => section.key !== 'general')
        .flatMap((section) => section.items.map((item) => item.key)),
    [sections],
  );
  const scopedVerbLabels = React.useMemo(
    () =>
      new Map(
        sections
          .filter((section) => section.key !== 'general')
          .flatMap((section) =>
            section.items.map((item) => [item.key, item.label] as const),
          ),
      ),
    [sections],
  );

  const [selectedScopedChannelId, setSelectedScopedChannelId] = React.useState<string>(
    availableAlertChannels[0]?.id ?? '',
  );
  const [selectedScopedLearningSpaceId, setSelectedScopedLearningSpaceId] =
    React.useState<string>(availableAlertLearningSpaces[0]?.id ?? '');

  React.useEffect(() => {
    if (!selectedScopedChannelId && availableAlertChannels[0]?.id) {
      setSelectedScopedChannelId(availableAlertChannels[0].id);
    }
  }, [availableAlertChannels, selectedScopedChannelId]);

  React.useEffect(() => {
    if (!selectedScopedLearningSpaceId && availableAlertLearningSpaces[0]?.id) {
      setSelectedScopedLearningSpaceId(availableAlertLearningSpaces[0].id);
    }
  }, [availableAlertLearningSpaces, selectedScopedLearningSpaceId]);

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
              console.error(error);
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
          icon={<MessageCircle className="h-5 w-5" />}
          title="Channel alerts"
          subtitle="Per-verb overrides for a specific channel"
          showSeparator={true}
        >
          {availableAlertChannels.length ? (
            <div className="space-y-3">
              <Select
                value={selectedScopedChannelId}
                onValueChange={setSelectedScopedChannelId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent>
                  {availableAlertChannels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {scopedVerbKeys.map((prefKey) => (
                <div
                  key={`channel-${prefKey}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-sm">
                    {scopedVerbLabels.get(prefKey) ?? prefKey}
                  </span>
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
                            prefKey,
                          })}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {notificationChannelOptions.map((option) => {
                          const currentChannels = getScopedChannels({
                            scopeKind: 'channel',
                            scopeId: selectedScopedChannelId,
                            prefKey,
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
                                  void saveScopedPreference({
                                    scopeKind: 'channel',
                                    scopeId: selectedScopedChannelId,
                                    prefKey,
                                    channels: Array.from(new Set(nextChannels)),
                                  });
                                }}
                                aria-label={`${option.label} notifications for ${scopedVerbLabels.get(prefKey) ?? prefKey}`}
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
                        void resetScopedPreference({
                          scopeKind: 'channel',
                          scopeId: selectedScopedChannelId,
                          prefKey,
                        })
                      }
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No channels available.</p>
          )}
        </UserSettingsTabSection>
      </div>

      <div className="space-y-3">
        <UserSettingsTabSection
          icon={<BookOpen className="h-5 w-5" />}
          title="Classroom alerts"
          subtitle="Per-verb overrides for a specific classroom"
          showSeparator={false}
        >
          {availableAlertLearningSpaces.length ? (
            <div className="space-y-3">
              <Select
                value={selectedScopedLearningSpaceId}
                onValueChange={setSelectedScopedLearningSpaceId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a classroom" />
                </SelectTrigger>
                <SelectContent>
                  {availableAlertLearningSpaces.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {scopedVerbKeys.map((prefKey) => (
                <div
                  key={`learning-space-${prefKey}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-sm">
                    {scopedVerbLabels.get(prefKey) ?? prefKey}
                  </span>
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
                            prefKey,
                          })}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {notificationChannelOptions.map((option) => {
                          const currentChannels = getScopedChannels({
                            scopeKind: 'learning_space',
                            scopeId: selectedScopedLearningSpaceId,
                            prefKey,
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
                                  void saveScopedPreference({
                                    scopeKind: 'learning_space',
                                    scopeId: selectedScopedLearningSpaceId,
                                    prefKey,
                                    channels: Array.from(new Set(nextChannels)),
                                  });
                                }}
                                aria-label={`${option.label} notifications for ${scopedVerbLabels.get(prefKey) ?? prefKey}`}
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
                        void resetScopedPreference({
                          scopeKind: 'learning_space',
                          scopeId: selectedScopedLearningSpaceId,
                          prefKey,
                        })
                      }
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No classrooms available.</p>
          )}
        </UserSettingsTabSection>
      </div>
    </div>
  );
}

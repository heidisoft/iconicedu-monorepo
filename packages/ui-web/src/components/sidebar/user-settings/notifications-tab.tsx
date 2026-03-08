import * as React from 'react';
import {
  Bell,
  BookOpen,
  ChevronDown,
  Clock,
  FileText,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  SlidersHorizontal,
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
  }) => Promise<void> | void;
};

export function NotificationsTab({
  isGuardianOrAdmin,
  notificationChannels,
  onNotificationChannelsChange,
  profileId,
  orgId,
  onNotificationPreferenceSave,
}: NotificationsTabProps) {
  const sections = [
    {
      key: 'defaults',
      title: 'Defaults',
      icon: Bell,
      items: defineNotificationItems([
        {
          key: 'defaults.message_updates',
          label: 'Email updates about new messages and schedule changes',
        },
        {
          key: 'defaults.weekly_digest',
          label: 'Weekly digest of class activity',
        },
        { key: 'defaults.sms_reminders', label: 'SMS reminders for upcoming sessions' },
      ]),
    },
    {
      key: 'messages',
      title: 'Messages',
      icon: MessageCircle,
      items: defineNotificationItems([
        { key: 'messages.direct_message', label: 'Email me when I get a direct message' },
        { key: 'messages.teacher_message', label: 'Email me when a teacher messages me' },
        { key: 'messages.mentions', label: 'Notify me about @mentions' },
        { key: 'messages.replies', label: 'Notify me about replies to my messages' },
        {
          key: 'messages.mute_busy',
          label: 'Mute busy channels (only @mentions and DMs)',
        },
      ]),
    },
    {
      key: 'schedule',
      title: 'Schedule & Sessions',
      icon: Clock,
      items: defineNotificationItems([
        { key: 'schedule.upcoming_reminder', label: 'Upcoming session reminder' },
        { key: 'schedule.starting_soon', label: 'Session starting soon' },
        { key: 'schedule.rescheduled', label: 'Session rescheduled' },
        { key: 'schedule.canceled', label: 'Session canceled' },
        { key: 'schedule.no_show', label: 'Tutor running late / no-show alert' },
        { key: 'schedule.makeup', label: 'Make-up session scheduled' },
      ]),
    },
    {
      key: 'homework',
      title: 'Homework & Classwork',
      icon: BookOpen,
      items: defineNotificationItems([
        { key: 'homework.assigned', label: 'New homework assigned' },
        { key: 'homework.due_reminder', label: 'Homework due reminder' },
        { key: 'homework.feedback', label: 'Homework feedback posted' },
        {
          key: 'homework.new_resource',
          label: 'New resource/material added (PDF, link, worksheet)',
        },
      ]),
    },
    {
      key: 'progress',
      title: 'Progress & Reports',
      icon: FileText,
      items: defineNotificationItems([
        { key: 'progress.weekly_report', label: 'Weekly progress report' },
        { key: 'progress.monthly_report', label: 'Monthly progress report' },
        { key: 'progress.attendance_summary', label: 'Attendance summary' },
        { key: 'progress.milestones', label: 'Milestones/achievements (optional)' },
      ]),
    },
    {
      key: 'announcements',
      title: 'Announcements',
      icon: Megaphone,
      items: defineNotificationItems([
        { key: 'announcements.important', label: 'Important announcements from ICONIC' },
        {
          key: 'announcements.class_posts',
          label: 'Class announcements (teacher posts)',
        },
        {
          key: 'announcements.policy_updates',
          label: 'Policy or calendar updates (holidays, closures)',
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
              { key: 'billing.receipt', label: 'Payment receipt' },
              { key: 'billing.failed', label: 'Payment failed' },
              { key: 'billing.invoice_ready', label: 'Invoice ready' },
              { key: 'billing.refund', label: 'Refund processed' },
              { key: 'billing.renewal', label: 'Plan ending / renewal reminder' },
            ]),
          },
        ]
      : []),
    {
      key: 'app',
      title: 'App & Account',
      icon: ShieldCheck,
      items: defineNotificationItems([
        {
          key: 'app.security_alerts',
          label: 'Security alerts (new login, password change) (recommended always on)',
        },
        { key: 'app.new_device', label: 'New device sign-in' },
        { key: 'app.account_changes', label: 'Account changes (role/invite accepted)' },
      ]),
    },
    {
      key: 'digest',
      title: 'Digest & Frequency',
      icon: SlidersHorizontal,
      items: defineNotificationItems([
        { key: 'digest.instant', label: 'Instant notifications' },
        { key: 'digest.daily', label: 'Daily digest' },
        { key: 'digest.weekly', label: 'Weekly digest' },
        {
          key: 'digest.urgent_only',
          label: 'Only urgent (schedule changes + direct messages)',
        },
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
    </div>
  );
}

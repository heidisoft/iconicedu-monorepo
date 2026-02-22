'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type {
  ContactChannelVM,
  ChildProfileSaveInput,
  ChildProfileVM,
  EducatorAvailabilityInput,
  EducatorProfileSaveInput,
  FamilyLinkInviteRole,
  GradeLevel,
  NotificationChannelVM,
  SidebarLeftDataVM,
  StaffProfileSaveInput,
  ThemeKey,
  UserOnboardingStatusVM,
  AdminMenuSectionVM,
} from '@iconicedu/shared-types';
import { SidebarLeft, SidebarInset } from '@iconicedu/ui-web';
import { toast } from '@iconicedu/ui-web';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import {
  revokeFamilyInviteAction,
  sendFamilyInviteAction,
} from '@iconicedu/web/app/actions/family-invite';
import { removeFamilyMemberAction } from '@iconicedu/web/app/actions/remove-family-member';
import { createChildProfileAction } from '@iconicedu/web/app/actions/create-child-profile';
import { saveEducatorAvailabilityAction } from '@iconicedu/web/app/actions/educator-availability';
import { upsertUserOnboardingStatusAction } from '@iconicedu/web/app/actions/onboarding-status';
import { determineOnboardingStep } from '@iconicedu/web/lib/onboarding/determineOnboardingStep';
import {
  applyIncomingDirectMessageUnread,
  markDirectMessageChannelRead,
  touchDirectMessageChannelOrder,
} from '@iconicedu/web/lib/sidebar/direct-message-unread';
import {
  applyIncomingLearningSpaceUnread,
  markLearningSpaceChannelRead,
} from '@iconicedu/web/lib/sidebar/learning-space-unread';
import { upsertDirectMessageChannel } from '@iconicedu/web/lib/sidebar/direct-message-realtime';
import { persistDirectMessageUnreadCount } from '@iconicedu/web/lib/sidebar/direct-message-unread-persistence';
import { mapProfilePresenceRowToVM } from '@iconicedu/web/lib/profile/mappers/presence.mapper';
import {
  applyPresenceToSidebarData,
  applyRealtimeOnlineProfilesToSidebarData,
} from '@iconicedu/web/lib/presence/apply-presence';
import type { ProfilePresenceRow } from '@iconicedu/shared-types';
import { buildChannelById } from '@iconicedu/web/lib/channels/builders/channel.builder';
import { extractOnlineProfileIdsFromPresenceState } from '@iconicedu/web/lib/presence/realtime-presence';
import {
  deriveConnectionStatusFromActivity,
  PRESENCE_AWAY_AFTER_MS,
  type PresenceConnectionStatus,
} from '@iconicedu/web/lib/presence/status';
import { shouldPublishPresence } from '@iconicedu/web/lib/presence/publish-policy';

const AVATAR_BUCKET = 'public-avatars';
const AVATAR_SIGNED_URL_TTL = 60 * 60;
const PRESENCE_HEARTBEAT_MS = 90 * 1000;
const PRESENCE_STATUS_EVALUATION_MS = 30 * 1000;

const getToastMessageFromError = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';

const showSuccessToast = (title: string, description?: string) =>
  toast.success(description ? `${title}: ${description}` : title);

const showErrorToast = (title: string, error: unknown) =>
  toast.error(`${title}: ${getToastMessageFromError(error)}`);

const normalizeContactChannels = (
  channels?: string[] | null,
): ContactChannelVM[] | null | undefined => {
  if (channels === undefined) {
    return undefined;
  }
  if (channels === null) {
    return null;
  }
  const allowed: ContactChannelVM[] = ['email', 'sms', 'whatsapp'];
  return channels.filter((channel): channel is ContactChannelVM =>
    allowed.includes(channel as ContactChannelVM),
  );
};

const normalizeThemeKey = (value?: string | null): ThemeKey | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value.trim() === '') {
    return null;
  }
  return value as ThemeKey;
};

const normalizeNotificationChannels = (
  channels: string[],
): NotificationChannelVM[] => {
  const allowed: NotificationChannelVM[] = ['push', 'email', 'sms', 'whatsapp'];
  return channels.filter((channel): channel is NotificationChannelVM =>
    allowed.includes(channel as NotificationChannelVM),
  );
};

const getPreferenceSuccessMessage = (input: {
  timezone?: string;
  locale?: string | null;
  languagesSpoken?: string[] | null;
  themeKey?: string | null;
}) => {
  if (input.themeKey !== undefined) {
    return 'Accent color saved';
  }
  if (input.timezone !== undefined) {
    return 'Timezone saved';
  }
  if (input.locale !== undefined) {
    return 'Locale saved';
  }
  if (input.languagesSpoken !== undefined) {
    return 'Languages saved';
  }
  return 'Preferences updated';
};

export function SidebarShell({
  children,
  data,
  initialOnboardingStatus,
  adminSections,
}: {
  children: ReactNode;
  data: SidebarLeftDataVM;
  initialOnboardingStatus?: UserOnboardingStatusVM | null;
  adminSections?: AdminMenuSectionVM[] | null;
}) {
  const pathname = usePathname();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [sidebarData, setSidebarData] = React.useState(data);
  const onlineProfileIdsRef = React.useRef<Set<string>>(new Set());
  const directMessageIdsRef = React.useRef(
    new Set(data.collections.directMessages.map((dm) => dm.ids.id)),
  );
  const [onboardingStatus, setOnboardingStatus] = React.useState<UserOnboardingStatusVM | null>(
    initialOnboardingStatus ?? null,
  );

  React.useEffect(() => {
    setSidebarData(data);
  }, [data]);

  React.useEffect(() => {
    directMessageIdsRef.current = new Set(
      sidebarData.collections.directMessages.map((dm) => dm.ids.id),
    );
  }, [sidebarData.collections.directMessages]);

  React.useEffect(() => {
    setOnboardingStatus(initialOnboardingStatus ?? null);
  }, [initialOnboardingStatus]);

  const handleLogout = React.useCallback(async () => {
    await supabase.auth.signOut();
    window.location.assign('/');
  }, [supabase]);

  const dashboardBasePath = React.useMemo(() => {
    const firstSegment = pathname?.split('/').filter(Boolean)[0];
    if (!firstSegment) {
      return '/';
    }
    return `/${firstSegment}`;
  }, [pathname]);

  const handleOnboardingComplete = React.useCallback(() => {
    void router.push(dashboardBasePath);
  }, [dashboardBasePath, router]);

  const handleStatusOverrideSave = React.useCallback(
    async (input: {
      status?: 'online' | 'away' | 'offline';
      stateText?: string | null;
      stateEmoji?: string | null;
      stateExpiresAt?: string | null;
      clearState?: boolean;
    }) => {
      const fallbackStatus =
        sidebarData.user.profile.presence?.displayStatus === 'away'
          ? 'away'
          : sidebarData.user.profile.presence?.displayStatus === 'offline'
            ? 'offline'
            : 'online';
      const response = await window.fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: input.status ?? fallbackStatus,
          stateText: input.stateText,
          stateEmoji: input.stateEmoji,
          stateExpiresAt: input.stateExpiresAt,
          clearState: input.clearState,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(payload?.message || 'Unable to update status');
      }

      setSidebarData((prev) => {
        const currentPresence = prev.user.profile.presence;
        const nextPresence = {
          state: input.clearState
            ? {
                text: null,
                emoji: null,
                expiresAt: null,
              }
            : {
                text: input.stateText ?? null,
                emoji: input.stateEmoji ?? null,
                expiresAt: input.stateExpiresAt ?? null,
              },
          liveStatus:
            currentPresence?.liveStatus ??
            (fallbackStatus === 'offline'
              ? 'offline'
              : fallbackStatus === 'away'
                ? 'away'
                : 'online'),
          displayStatus:
            currentPresence?.displayStatus ??
            (fallbackStatus === 'offline'
              ? 'offline'
              : fallbackStatus === 'away'
                ? 'away'
                : 'online'),
          lastSeenAt: currentPresence?.lastSeenAt ?? new Date().toISOString(),
          presenceLoaded: true,
        } as const;

        return applyPresenceToSidebarData(
          prev,
          prev.user.profile.ids.id,
          nextPresence,
        );
      });
      showSuccessToast('Status updated');
    },
    [sidebarData.user.profile.presence],
  );

  const sidebarProfile = sidebarData.user.profile;
  const sidebarAccount = sidebarData.user.account ?? null;
  const sidebarOrgId = sidebarProfile.ids?.orgId;
  const sidebarAccountId =
    sidebarData.user.account?.ids?.id ?? sidebarProfile.ids?.accountId ?? null;

  const computedOnboardingStep = React.useMemo(
    () => determineOnboardingStep(sidebarProfile, sidebarAccount),
    [sidebarProfile, sidebarAccount],
  );

  const persistUnread = React.useCallback(
    async (
      channelId: string,
      unreadCount: number,
      options?: {
        markRead?: boolean;
        lastReadMessageId?: string;
        lastReadAt?: string;
      },
    ) => {
      if (!sidebarOrgId || !sidebarAccountId) {
        return;
      }
      const { error } = await persistDirectMessageUnreadCount(supabase, {
        orgId: sidebarOrgId,
        accountId: sidebarAccountId,
        channelId,
        unreadCount,
        markRead: options?.markRead,
        lastReadMessageId: options?.lastReadMessageId,
        lastReadAt: options?.lastReadAt,
      });
      if (error) {
        console.error('Failed to persist direct message unread count', error);
      }
    },
    [sidebarOrgId, sidebarAccountId, supabase],
  );

  React.useEffect(() => {
    const handleMarkRead = (event: Event) => {
      const customEvent = event as CustomEvent<{
        channelId?: string;
        lastReadMessageId?: string;
        lastReadAt?: string;
      }>;
      const channelId = customEvent.detail?.channelId;
      if (!channelId) {
        return;
      }
      const lastReadMessageId = customEvent.detail?.lastReadMessageId;
      const lastReadAt = customEvent.detail?.lastReadAt;
      setSidebarData((prev) => {
        const next = markDirectMessageChannelRead(prev, channelId, {
          lastReadMessageId,
          lastReadAt,
        });
        return markLearningSpaceChannelRead(next, channelId, {
          lastReadMessageId,
          lastReadAt,
        });
      });
      void persistUnread(channelId, 0, {
        markRead: true,
        lastReadMessageId,
        lastReadAt,
      });
    };

    window.addEventListener('dm:mark-read', handleMarkRead as EventListener);
    return () => {
      window.removeEventListener('dm:mark-read', handleMarkRead as EventListener);
    };
  }, [persistUnread]);

  React.useEffect(() => {
    const orgId = sidebarProfile.ids?.orgId;
    const profileId = sidebarProfile.ids?.id;
    if (!orgId || !profileId) {
      return;
    }

    const channel = supabase.channel(`sidebar-dm-unread:${orgId}:${profileId}`);
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        const row = payload.new as
          | { channel_id?: string; sender_profile_id?: string | null }
          | null;
        if (!row?.channel_id) {
          return;
        }
        const channelId = row.channel_id;

        setSidebarData((prev) => {
          const ordered = touchDirectMessageChannelOrder(prev, channelId);
          const directNext = applyIncomingDirectMessageUnread(ordered, {
            channelId,
            senderProfileId: row.sender_profile_id ?? null,
            currentProfileId: profileId,
          });
          const next = applyIncomingLearningSpaceUnread(directNext, {
            channelId,
            senderProfileId: row.sender_profile_id ?? null,
            currentProfileId: profileId,
          });

          const nextDirectChannel = next.collections.directMessages.find(
            (channel) => channel.ids.id === channelId,
          );
          if (nextDirectChannel) {
            const nextUnread = Math.max(
              0,
              nextDirectChannel.collections.readState?.unreadCount ?? 0,
            );
            void persistUnread(channelId, nextUnread, {
              markRead: nextUnread === 0,
            });
            return next;
          }

          const nextLearningSpaceChannel = next.collections.learningSpaces.find(
            (space) =>
              space.channels.primaryChannel.ids.id === channelId ||
              (space.channels.relatedChannels ?? []).some(
                (channel) => channel.ids.id === channelId,
              ),
          );
          const matchedLearningSpaceChannel =
            nextLearningSpaceChannel?.channels.primaryChannel.ids.id === channelId
              ? nextLearningSpaceChannel.channels.primaryChannel
              : (nextLearningSpaceChannel?.channels.relatedChannels ?? []).find(
                  (channel) => channel.ids.id === channelId,
                );
          if (matchedLearningSpaceChannel) {
            const nextUnread = Math.max(
              0,
              matchedLearningSpaceChannel.collections.readState?.unreadCount ?? 0,
            );
            void persistUnread(channelId, nextUnread, {
              markRead: nextUnread === 0,
            });
          }
          return next;
        });
      },
    );
    channel.subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [
    supabase,
    sidebarProfile.ids?.orgId,
    sidebarProfile.ids?.id,
    persistUnread,
  ]);

  React.useEffect(() => {
    const orgId = sidebarProfile.ids?.orgId;
    const profileId = sidebarProfile.ids?.id;
    const accountId = sidebarProfile.ids?.accountId;
    if (!orgId || !profileId || !accountId) {
      return;
    }

    const channel = supabase.channel(`sidebar-dm-updates:${orgId}:${profileId}`);
    const pendingChannelFetches = new Set<string>();
    const retryTimers = new Set<number>();
    const exhaustedChannelIds = new Set<string>();
    const maxRetryAttempts = 10;
    const scheduleRetry = (
      channelId: string,
      senderProfileId: string | null | undefined,
      attempt: number,
    ) => {
      if (attempt > maxRetryAttempts) {
        if (!exhaustedChannelIds.has(channelId)) {
          exhaustedChannelIds.add(channelId);
          router.refresh();
        }
        return;
      }
      const retryDelayMs = Math.min(250 * attempt, 2500);
      const timer = window.setTimeout(() => {
        retryTimers.delete(timer);
        void addOrRefreshDmChannel(channelId, senderProfileId, attempt);
      }, retryDelayMs);
      retryTimers.add(timer);
    };

    const addOrRefreshDmChannel = async (
      channelId: string,
      senderProfileId?: string | null,
      attempt = 0,
    ) => {
      if (pendingChannelFetches.has(channelId)) {
        return;
      }
      pendingChannelFetches.add(channelId);

      try {
        const nextChannel = await buildChannelById(supabase, orgId, channelId, {
          accountId,
          messagesLimit: 50,
        });
        if (!nextChannel) {
          scheduleRetry(channelId, senderProfileId, attempt + 1);
          return;
        }

        if (nextChannel.basics.kind !== 'dm' && nextChannel.basics.kind !== 'group_dm') {
          return;
        }

        const hasMessages = (nextChannel.collections.messages?.items?.length ?? 0) > 0;
        const existsInSidebar = directMessageIdsRef.current.has(channelId);
        if (!hasMessages && !existsInSidebar) {
          if (senderProfileId) {
            scheduleRetry(channelId, senderProfileId, attempt + 1);
          }
          return;
        }

        const minimumUnreadCount =
          senderProfileId && senderProfileId !== profileId ? 1 : 0;
        const persistedUnread = Math.max(
          0,
          nextChannel.collections.readState?.unreadCount ?? 0,
        );
        const nextUnreadCount = Math.max(minimumUnreadCount, persistedUnread);

        setSidebarData((prev) =>
          upsertDirectMessageChannel(prev, nextChannel, {
            minimumUnreadCount,
            moveToTop: true,
          }),
        );

        if (nextUnreadCount > 0) {
          void persistUnread(channelId, nextUnreadCount);
        }
      } finally {
        pendingChannelFetches.delete(channelId);
      }
    };

    const syncDirectMessageMemberships = async () => {
      const { data, error } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('org_id', orgId)
        .eq('profile_id', profileId);

      if (error || !data?.length) {
        return;
      }

      const candidateChannelIds = Array.from(
        new Set(
          data
            .map((row: { channel_id?: string | null }) => row.channel_id ?? null)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      await Promise.all(
        candidateChannelIds
          .filter((channelId) => !directMessageIdsRef.current.has(channelId))
          .map((channelId) => addOrRefreshDmChannel(channelId, null)),
      );
    };

    void syncDirectMessageMemberships();
    const membershipSyncInterval = window.setInterval(() => {
      void syncDirectMessageMemberships();
    }, 4000);

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'channels',
        filter: `org_id=eq.${orgId}`,
      },
      async (payload) => {
        const row = payload.new as {
          id?: string;
          kind?: string | null;
        } | null;

        if (!row?.id) {
          return;
        }

        const kind = row.kind?.toLowerCase();
        if (kind !== 'dm' && kind !== 'group_dm') {
          return;
        }

        await addOrRefreshDmChannel(row.id, null);
      },
    );

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'channel_members',
        filter: `profile_id=eq.${profileId}`,
      },
      async (payload) => {
        const row = payload.new as {
          channel_id?: string;
        } | null;

        if (!row?.channel_id) {
          return;
        }

        await addOrRefreshDmChannel(row.channel_id, null);
      },
    );

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `org_id=eq.${orgId}`,
      },
      async (payload) => {
        const row = payload.new as {
          channel_id?: string;
          sender_profile_id?: string | null;
        } | null;

        if (!row?.channel_id) {
          return;
        }
        await addOrRefreshDmChannel(row.channel_id, row.sender_profile_id ?? null);
      },
    );
    channel.subscribe();

    return () => {
      window.clearInterval(membershipSyncInterval);
      retryTimers.forEach((timer) => {
        window.clearTimeout(timer);
      });
      retryTimers.clear();
      exhaustedChannelIds.clear();
      void channel.unsubscribe();
    };
  }, [
    supabase,
    sidebarProfile.ids?.orgId,
    sidebarProfile.ids?.id,
    sidebarProfile.ids?.accountId,
    persistUnread,
    router,
  ]);

  React.useEffect(() => {
    const orgId = sidebarProfile.ids?.orgId;
    if (!orgId) {
      return;
    }

    const channel = supabase.channel(`sidebar-presence:${orgId}`);
    const syncOnlineProfiles = () => {
      const onlineProfileIds = extractOnlineProfileIdsFromPresenceState(
        channel.presenceState?.() ?? {},
      );
      onlineProfileIdsRef.current = onlineProfileIds;
      setSidebarData((prev) =>
        applyRealtimeOnlineProfilesToSidebarData(prev, onlineProfileIds),
      );
    };

    channel.on('presence', { event: 'sync' }, syncOnlineProfiles);
    channel.on('presence', { event: 'join' }, syncOnlineProfiles);
    channel.on('presence', { event: 'leave' }, syncOnlineProfiles);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profile_presence',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        const row =
          payload.eventType === 'DELETE'
            ? ((payload.old as ProfilePresenceRow | null) ?? null)
            : ((payload.new as ProfilePresenceRow | null) ?? null);
        const profileId = row?.profile_id;
        if (!profileId) {
          return;
        }
        const presence =
          payload.eventType === 'DELETE' ? null : mapProfilePresenceRowToVM(row);
        setSidebarData((prev) =>
          applyRealtimeOnlineProfilesToSidebarData(
            applyPresenceToSidebarData(prev, profileId, presence),
            onlineProfileIdsRef.current,
          ),
        );
      },
    );

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && sidebarProfile.ids?.id) {
        void channel.track({
          profile_id: sidebarProfile.ids.id,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      if (channel.untrack) {
        void channel.untrack();
      }
      void channel.unsubscribe();
    };
  }, [supabase, sidebarProfile.ids?.orgId, sidebarProfile.ids?.id]);

  React.useEffect(() => {
    if (!sidebarProfile.ids?.id || !sidebarProfile.ids?.orgId) {
      return;
    }

    const lastActivityAtRef = { current: Date.now() };
    const lastPublishedStatusRef: { current: PresenceConnectionStatus | null } = {
      current: null,
    };
    const lastOnlineHeartbeatAtRef = { current: 0 };
    const publishPresence = async (
      status: PresenceConnectionStatus,
      options?: { force?: boolean; keepalive?: boolean },
    ) => {
      const now = Date.now();
      const shouldPublish = shouldPublishPresence({
        nextStatus: status,
        lastPublishedStatus: lastPublishedStatusRef.current,
        force: options?.force,
        heartbeatMs: PRESENCE_HEARTBEAT_MS,
        lastOnlineHeartbeatAt: lastOnlineHeartbeatAtRef.current,
        now,
      });
      if (!shouldPublish) {
        return;
      }

      lastPublishedStatusRef.current = status;
      if (status === 'online') {
        lastOnlineHeartbeatAtRef.current = now;
      }

      try {
        await window.fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
          keepalive: options?.keepalive ?? false,
        });
      } catch {
        // best effort presence sync
      }
    };

    const computeStatus = (): PresenceConnectionStatus => {
      const hasActiveWindow =
        document.visibilityState === 'visible' &&
        (typeof document.hasFocus !== 'function' || document.hasFocus());
      return deriveConnectionStatusFromActivity({
        lastActivityAt: lastActivityAtRef.current,
        hasActiveWindow,
      });
    };

    const handleActivity = () => {
      lastActivityAtRef.current = Date.now();
    };

    const publishComputedStatus = () => {
      const currentStatus = computeStatus();
      const shouldSetOffline =
        currentStatus === 'away' &&
        Date.now() - lastActivityAtRef.current >= PRESENCE_AWAY_AFTER_MS * 2;
      void publishPresence(shouldSetOffline ? 'offline' : currentStatus);
    };

    const handlePageHide = () => {
      const payload = JSON.stringify({ status: 'offline' });
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/presence', blob);
      } else {
        void publishPresence('offline', { force: true, keepalive: true });
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
    ];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    window.addEventListener('focus', publishComputedStatus);
    window.addEventListener('blur', publishComputedStatus);
    document.addEventListener('visibilitychange', publishComputedStatus);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    void publishPresence(computeStatus(), { force: true });
    const heartbeatTimer = window.setInterval(() => {
      publishComputedStatus();
    }, PRESENCE_STATUS_EVALUATION_MS);

    return () => {
      window.clearInterval(heartbeatTimer);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      window.removeEventListener('focus', publishComputedStatus);
      window.removeEventListener('blur', publishComputedStatus);
      document.removeEventListener('visibilitychange', publishComputedStatus);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      void publishPresence('offline', { force: true, keepalive: true });
    };
  }, [sidebarProfile.ids?.id, sidebarProfile.ids?.orgId]);

  React.useEffect(() => {
    if (!sidebarProfile.ids?.id || !sidebarProfile.ids?.orgId) {
      return;
    }

    const nextStep = computedOnboardingStep;
    const shouldUpdate =
      (nextStep &&
        (!onboardingStatus ||
          onboardingStatus.currentStep !== nextStep ||
          onboardingStatus.completed)) ||
      (!nextStep && onboardingStatus && !onboardingStatus.completed);

    if (!shouldUpdate) {
      return;
    }

    let isMounted = true;
    (async () => {
      const updatedStatus = await upsertUserOnboardingStatusAction({
        profileId: sidebarProfile.ids.id,
        orgId: sidebarProfile.ids.orgId,
        currentStep: nextStep,
        completed: !nextStep,
        lastCompletedStep: onboardingStatus?.currentStep ?? null,
      });
      if (isMounted) {
        setOnboardingStatus(updatedStatus);
      }
    })().catch(() => {
      // intentionally ignore errors in client-side sync
    });

    return () => {
      isMounted = false;
    };
  }, [computedOnboardingStep, onboardingStatus, sidebarProfile]);

  const primaryProfileId = data.user.profile.ids.id;

  const handleProfileSave = React.useCallback(
    async (input: {
      profileId: string;
      orgId: string;
      displayName: string | null;
      firstName: string;
      lastName: string;
      bio?: string | null;
    }) => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            display_name: input.displayName,
            first_name: input.firstName,
            last_name: input.lastName,
            bio: input.bio ?? null,
          })
          .eq('id', input.profileId)
          .eq('org_id', input.orgId);

        if (error) {
          throw error;
        }

        setSidebarData((prev) => {
          const profile = prev.user.profile;
          if (profile.ids.id === input.profileId) {
            return {
              ...prev,
              user: {
                ...prev.user,
                profile: {
                  ...profile,
                  profile: {
                    ...profile.profile,
                    displayName: input.displayName ?? '',
                    firstName: input.firstName,
                    lastName: input.lastName,
                    bio: input.bio ?? null,
                  },
                },
              },
            };
          }

          if (profile.kind === 'guardian' && profile.children?.items) {
            const updatedChildren = profile.children.items.map((child) =>
              child.ids.id === input.profileId
                ? {
                    ...child,
                    profile: {
                      ...child.profile,
                      displayName: input.displayName ?? '',
                      firstName: input.firstName,
                      lastName: input.lastName,
                    },
                  }
                : child,
            );

            return {
              ...prev,
              user: {
                ...prev.user,
                profile: {
                  ...profile,
                  children: {
                    ...profile.children,
                    items: updatedChildren,
                  },
                },
              },
            };
          }

          return prev;
        });

        if (input.profileId === primaryProfileId) {
          showSuccessToast('Profile saved');
        }
      } catch (error) {
        showErrorToast('Unable to save profile', error);
        throw error;
      }
    },
    [primaryProfileId, supabase],
  );

  const handleChildThemeSave = React.useCallback(
    async (input: { profileId: string; orgId: string; themeKey: ThemeKey }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          ui_theme_key: input.themeKey,
        })
        .eq('id', input.profileId)
        .eq('org_id', input.orgId);

      if (error) {
        throw error;
      }

      setSidebarData((prev) => {
        const profile = prev.user.profile;
        if (profile.kind !== 'guardian' || !profile.children?.items) {
          return prev;
        }

        return {
          ...prev,
          user: {
            ...prev.user,
            profile: {
              ...profile,
              children: {
                ...profile.children,
                items: profile.children.items.map((child) =>
                  child.ids.id === input.profileId
                    ? {
                        ...child,
                        ui: {
                          ...child.ui,
                          themeKey: input.themeKey,
                        },
                      }
                    : child,
                ),
              },
            },
          },
        };
      });
    },
    [supabase],
  );

  const normalizeList = (values?: string[] | null) => {
    const cleaned =
      values?.map((value) => value.trim()).filter((value) => value) ?? [];
    return Array.from(new Set(cleaned));
  };

  const handleStaffProfileSave = React.useCallback(
    async (input: StaffProfileSaveInput) => {
      try {
        const specialties = normalizeList(input.specialties);
        const normalizedAvailability = input.weeklyAvailability ?? null;

        const { error } = await supabase
          .from('staff_profiles')
          .upsert(
            {
              profile_id: input.profileId,
              org_id: input.orgId,
              department: input.department ?? null,
              job_title: input.jobTitle ?? null,
              weekly_availability: normalizedAvailability,
            },
            { onConflict: 'profile_id' },
          );
        if (error) {
          throw error;
        }

        const { error: deleteSpecialtiesError } = await supabase
          .from('staff_profile_specialties')
          .delete()
          .eq('profile_id', input.profileId)
          .eq('org_id', input.orgId);
        if (deleteSpecialtiesError) {
          throw deleteSpecialtiesError;
        }

        if (specialties.length > 0) {
          const { error: insertSpecialtiesError } = await supabase
            .from('staff_profile_specialties')
            .insert(
              specialties.map((specialty) => ({
                org_id: input.orgId,
                profile_id: input.profileId,
                specialty,
              })),
            );
          if (insertSpecialtiesError) {
            throw insertSpecialtiesError;
          }
        }

        setSidebarData((prev) => {
          const profile = prev.user.profile;
          if (profile.ids.id !== input.profileId || profile.kind !== 'staff') {
            return prev;
          }
          return {
            ...prev,
            user: {
              ...prev.user,
              profile: {
                ...profile,
                department: input.department ?? null,
                jobTitle: input.jobTitle ?? null,
                weeklyAvailability: normalizedAvailability,
                specialties: specialties.length ? specialties : null,
              },
            },
          };
        });

        showSuccessToast('Staff profile saved');
      } catch (error) {
        showErrorToast('Unable to save staff profile', error);
        throw error;
      }
    },
    [supabase],
  );

  const handleChildProfileSave = React.useCallback(
    async (input: ChildProfileSaveInput) => {
      try {
        const childPayload = {
          profile_id: input.profileId,
          org_id: input.orgId,
          birth_year: input.birthYear ?? null,
          school_name: input.schoolName ?? null,
          school_year: input.schoolYear ?? null,
          confidence_level: input.confidenceLevel ?? null,
          communication_style:
            input.communicationStyles && input.communicationStyles.length
              ? input.communicationStyles[0]
              : null,
          interests: input.interests ?? [],
          strengths: input.strengths ?? [],
          learning_preferences: input.learningPreferences ?? [],
          motivation_styles: input.motivationStyles ?? [],
          communication_styles: input.communicationStyles ?? [],
        };

        const { error: childError } = await supabase
          .from('child_profiles')
          .upsert(childPayload, { onConflict: 'profile_id' });

        if (childError) {
          throw childError;
        }

        const gradeId = input.gradeId ?? input.gradeLabel;
        if (!gradeId) {
          throw new Error('Grade level is required.');
        }

        const gradePayload = {
          profile_id: input.profileId,
          org_id: input.orgId,
          grade_id: gradeId,
          grade_label: input.gradeLabel ?? gradeId,
        };

        const { error: gradeError } = await supabase
          .from('child_profile_grade_level')
          .upsert(gradePayload, { onConflict: 'org_id,profile_id' });

        if (gradeError) {
          throw gradeError;
        }

        setSidebarData((prev) => {
          const profile = prev.user.profile;
          if (profile.kind !== 'child') {
            return prev;
          }

          return {
            ...prev,
            user: {
              ...prev.user,
              profile: {
              ...profile,
                gradeLevel: input.gradeId ?? null,
                gradeLabel: input.gradeLabel ?? gradeId,
                birthYear: input.birthYear ?? null,
                schoolName: input.schoolName ?? null,
                schoolYear: input.schoolYear ?? null,
                interests: input.interests ?? [],
                strengths: input.strengths ?? [],
                learningPreferences: input.learningPreferences ?? [],
                motivationStyles: input.motivationStyles ?? [],
                confidenceLevel: input.confidenceLevel ?? null,
                communicationStyles: input.communicationStyles ?? [],
              },
            },
          };
        });

      showSuccessToast('Student profile saved');
    } catch (error) {
      showErrorToast('Unable to save student profile', error);
      throw error;
    }
  },
  [supabase],
);

  const handleEducatorProfileSave = React.useCallback(
    async (input: EducatorProfileSaveInput) => {
      try {
        const subjects = normalizeList(input.subjects);
        const curriculumTags = normalizeList(input.curriculumTags);
        const badges = normalizeList(input.badges);
        const ageGroups = normalizeList(input.ageGroups);
        const certifications = normalizeList(input.certifications);

        const gradeEntries =
          input.gradeLevels
            ?.map((grade) => {
              const gradeId = grade.gradeId?.trim() ?? '';
              if (!gradeId) {
                return null;
              }
              return {
                gradeId,
                gradeLabel: grade.gradeLabel?.trim() ?? gradeId,
              };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)) ??
          [];

        const uniqueGradeMap = new Map(
          gradeEntries.map((grade) => [grade.gradeId, grade]),
        );
        const uniqueGrades = Array.from(uniqueGradeMap.values());

        const educatorPayload = {
          profile_id: input.profileId,
          org_id: input.orgId,
          headline: input.headline ?? null,
          education: input.education ?? null,
          experience_years: input.experienceYears ?? null,
          certifications: certifications.length
            ? certifications.map((name) => ({ name }))
            : null,
          age_groups_comfortable_with: ageGroups.length ? ageGroups : null,
          featured_video_intro_url: input.featuredVideoIntroUrl ?? null,
        };

        const { error: educatorError } = await supabase
          .from('educator_profiles')
          .upsert(educatorPayload, { onConflict: 'profile_id' });
        if (educatorError) {
          throw educatorError;
        }

        const deleteSubjects = await supabase
          .from('educator_profile_subjects')
          .delete()
          .eq('org_id', input.orgId)
          .eq('profile_id', input.profileId);
        if (deleteSubjects.error) {
          throw deleteSubjects.error;
        }

        if (subjects.length) {
          const { error: insertSubjectsError } = await supabase
            .from('educator_profile_subjects')
            .insert(
              subjects.map((subject) => ({
                org_id: input.orgId,
                profile_id: input.profileId,
                subject,
              })),
            );
          if (insertSubjectsError) {
            throw insertSubjectsError;
          }
        }

        const deleteGrades = await supabase
          .from('educator_profile_grade_levels')
          .delete()
          .eq('org_id', input.orgId)
          .eq('profile_id', input.profileId);
        if (deleteGrades.error) {
          throw deleteGrades.error;
        }

        if (uniqueGrades.length) {
          const { error: gradeError } = await supabase
            .from('educator_profile_grade_levels')
            .insert(
              uniqueGrades.map((grade) => ({
                org_id: input.orgId,
                profile_id: input.profileId,
                grade_id: grade.gradeId,
                grade_label: grade.gradeLabel,
              })),
            );
          if (gradeError) {
            throw gradeError;
          }
        }

        const deleteCurriculum = await supabase
          .from('educator_profile_curriculum_tags')
          .delete()
          .eq('org_id', input.orgId)
          .eq('profile_id', input.profileId);
        if (deleteCurriculum.error) {
          throw deleteCurriculum.error;
        }

        if (curriculumTags.length) {
          const { error: curriculumError } = await supabase
            .from('educator_profile_curriculum_tags')
            .insert(
              curriculumTags.map((tag) => ({
                org_id: input.orgId,
                profile_id: input.profileId,
                tag,
              })),
            );
          if (curriculumError) {
            throw curriculumError;
          }
        }

        const deleteBadges = await supabase
          .from('educator_profile_badges')
          .delete()
          .eq('org_id', input.orgId)
          .eq('profile_id', input.profileId);
        if (deleteBadges.error) {
          throw deleteBadges.error;
        }

        if (badges.length) {
          const { error: badgesError } = await supabase
            .from('educator_profile_badges')
            .insert(
              badges.map((badge) => ({
                org_id: input.orgId,
                profile_id: input.profileId,
                badge,
              })),
            );
          if (badgesError) {
            throw badgesError;
          }
        }

        const gradeOptions = uniqueGrades.length
          ? uniqueGrades.map((grade) => grade.gradeId as GradeLevel)
          : null;

        setSidebarData((prev) => {
          const profile = prev.user.profile;
          if (profile.kind !== 'educator') {
            return prev;
          }

          return {
            ...prev,
            user: {
              ...prev.user,
              profile: {
                ...profile,
                headline: educatorPayload.headline,
                education: educatorPayload.education,
                experienceYears: educatorPayload.experience_years,
                certifications: certifications.length
                  ? certifications.map((name) => ({ name }))
                  : null,
                ageGroupsComfortableWith: ageGroups.length ? ageGroups : null,
                featuredVideoIntroUrl: educatorPayload.featured_video_intro_url,
                subjects: subjects.length ? subjects : null,
                gradesSupported: gradeOptions,
                curriculumTags: curriculumTags.length ? curriculumTags : null,
                badges: badges.length ? badges : null,
              },
            },
          };
        });

        showSuccessToast('Educator profile saved');
      } catch (error) {
        showErrorToast('Unable to save educator profile', error);
        throw error;
      }
    },
    [supabase],
  );

  const handleChildProfileCreate = React.useCallback(
    async (input: {
      orgId: string;
      displayName: string;
      firstName: string;
      lastName: string;
      gradeLevel: string;
      birthYear: number;
      timezone?: string | null;
      city?: string | null;
      region?: string | null;
      countryCode?: string | null;
      countryName?: string | null;
      postalCode?: string | null;
      themeKey?: ThemeKey | null;
    }): Promise<ChildProfileVM> => {
      try {
        const child = await createChildProfileAction(input);
        setSidebarData((prev) => {
          const profile = prev.user.profile;
          if (profile.kind !== 'guardian') {
            return prev;
          }

          const existingChildren = profile.children?.items ?? [];

          return {
            ...prev,
            user: {
              ...prev.user,
              profile: {
                ...profile,
                children: {
                  items: [...existingChildren, child],
                  total: (profile.children?.total ?? 0) + 1,
                  nextCursor: profile.children?.nextCursor ?? null,
                },
              },
            },
          };
        });
        showSuccessToast('Child profile created');
        return child;
      } catch (error) {
        showErrorToast('Unable to create child', error);
        throw error;
      }
    },
    [setSidebarData],
  );

  const handleFamilyMemberRemove = React.useCallback(
    async (input: { childAccountId: string }) => {
      try {
        await removeFamilyMemberAction(input);
        setSidebarData((prev) => {
          const profile = prev.user.profile;
          if (profile.kind !== 'guardian' || !profile.children?.items) {
            return prev;
          }

          const filtered = profile.children.items.filter(
            (child) => child.ids.accountId !== input.childAccountId,
          );

          return {
            ...prev,
            user: {
              ...prev.user,
              profile: {
                ...profile,
                children: {
                  ...profile.children,
                  items: filtered,
                  total: filtered.length,
                },
              },
            },
          };
        });
        showSuccessToast('Family member removed');
      } catch (error) {
        showErrorToast('Unable to remove family member', error);
        throw error;
      }
    },
    [setSidebarData],
  );

  const handleEducatorAvailabilitySave = React.useCallback(
    async (input: EducatorAvailabilityInput) => {
      if (sidebarProfile.kind !== 'educator') {
        throw new Error('Educator profile not available');
      }
      try {
        const savedAvailability = await saveEducatorAvailabilityAction({
          profileId: sidebarProfile.ids.id,
          orgId: sidebarProfile.ids.orgId,
          classTypes: input.classTypes ?? null,
          weeklyCommitment: input.weeklyCommitment ?? null,
          availability: input.availability ?? null,
        });

        setSidebarData((prev) => {
          const profile = prev.user.profile;
          if (profile.kind !== 'educator') {
            return prev;
          }
          return {
            ...prev,
            user: {
              ...prev.user,
              profile: {
                ...profile,
                availability: savedAvailability,
              },
            },
          };
        });

        showSuccessToast('Availability saved');
      } catch (error) {
        showErrorToast('Unable to save availability', error);
        throw error;
      }
    },
    [
      setSidebarData,
      sidebarProfile.ids.id,
      sidebarProfile.ids.orgId,
      sidebarProfile.kind,
    ],
  );

  const handleAccountUpdate = React.useCallback(
    async (input: {
      accountId: string;
      orgId: string;
      phoneE164?: string | null;
      whatsappE164?: string | null;
      phoneVerified?: boolean;
      whatsappVerified?: boolean;
      preferredContactChannels?: string[] | null;
    }) => {
      try {
        const updates: Record<string, string | boolean | string[] | null | undefined> =
          {};
        const now = new Date().toISOString();

        if (input.phoneE164 !== undefined) {
          updates.phone_e164 = input.phoneE164;
        }
        if (input.whatsappE164 !== undefined) {
          updates.whatsapp_e164 = input.whatsappE164;
        }
        if (input.phoneVerified !== undefined) {
          updates.phone_verified = input.phoneVerified;
          updates.phone_verified_at = input.phoneVerified ? now : null;
        }
        if (input.whatsappVerified !== undefined) {
          updates.whatsapp_verified = input.whatsappVerified;
          updates.whatsapp_verified_at = input.whatsappVerified ? now : null;
        }
        if (input.preferredContactChannels !== undefined) {
          updates.preferred_contact_channels = normalizeContactChannels(
            input.preferredContactChannels,
          );
        }

        const { error } = await supabase
          .from('accounts')
          .update(updates)
          .eq('id', input.accountId)
          .eq('org_id', input.orgId);

        if (error) {
          throw error;
        }

        setSidebarData((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            account: prev.user.account
              ? {
                  ...prev.user.account,
                  contacts: {
                    ...prev.user.account.contacts,
                    phoneE164:
                      input.phoneE164 !== undefined
                        ? input.phoneE164
                        : prev.user.account.contacts.phoneE164,
                    whatsappE164:
                      input.whatsappE164 !== undefined
                        ? input.whatsappE164
                        : prev.user.account.contacts.whatsappE164,
                    phoneVerified:
                      input.phoneVerified !== undefined
                        ? input.phoneVerified
                        : prev.user.account.contacts.phoneVerified,
                    phoneVerifiedAt:
                      input.phoneVerified !== undefined
                        ? input.phoneVerified
                          ? now
                          : null
                        : prev.user.account.contacts.phoneVerifiedAt,
                    whatsappVerified:
                      input.whatsappVerified !== undefined
                        ? input.whatsappVerified
                        : prev.user.account.contacts.whatsappVerified,
                    whatsappVerifiedAt:
                      input.whatsappVerified !== undefined
                        ? input.whatsappVerified
                          ? now
                          : null
                        : prev.user.account.contacts.whatsappVerifiedAt,
                    preferredContactChannels:
                      input.preferredContactChannels !== undefined
                        ? normalizeContactChannels(input.preferredContactChannels)
                        : prev.user.account.contacts.preferredContactChannels,
                  },
                }
              : prev.user.account,
          },
        }));

        if (
          input.phoneE164 !== undefined ||
          input.whatsappE164 !== undefined ||
          input.preferredContactChannels !== undefined
        ) {
          const title =
            input.phoneE164 && input.whatsappE164
              ? 'Contact numbers updated'
              : input.phoneE164
              ? 'Phone number saved'
              : input.whatsappE164
              ? 'WhatsApp number saved'
              : 'Notification preferences saved';
          showSuccessToast(title);
        }
      } catch (error) {
        showErrorToast('Unable to update contacts', error);
        throw error;
      }
    },
    [supabase],
  );

  const handlePrefsUpdate = React.useCallback(
    async (input: {
      profileId: string;
      orgId: string;
      timezone?: string;
      locale?: string | null;
      languagesSpoken?: string[] | null;
      themeKey?: string | null;
    }) => {
      try {
        const updates: Record<string, string | string[] | null | undefined> = {};

        if (input.timezone !== undefined) {
          updates.timezone = input.timezone;
        }
        if (input.locale !== undefined) {
          updates.locale = input.locale;
        }
        if (input.languagesSpoken !== undefined) {
          updates.languages_spoken = input.languagesSpoken;
        }
        if (input.themeKey !== undefined) {
          updates.ui_theme_key = input.themeKey;
        }

        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', input.profileId)
          .eq('org_id', input.orgId);

        if (error) {
          throw error;
        }

        setSidebarData((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            profile: {
              ...prev.user.profile,
              prefs: {
                ...prev.user.profile.prefs,
                timezone:
                  input.timezone !== undefined
                    ? input.timezone
                    : prev.user.profile.prefs.timezone,
                locale:
                  input.locale !== undefined
                    ? input.locale
                    : prev.user.profile.prefs.locale,
                languagesSpoken:
                  input.languagesSpoken !== undefined
                    ? input.languagesSpoken
                    : prev.user.profile.prefs.languagesSpoken,
              },
              ui: {
                ...prev.user.profile.ui,
                themeKey:
                  input.themeKey !== undefined
                    ? normalizeThemeKey(input.themeKey)
                    : prev.user.profile.ui?.themeKey,
              },
            },
          },
        }));

        showSuccessToast(getPreferenceSuccessMessage(input));
      } catch (error) {
        showErrorToast('Unable to save preferences', error);
        throw error;
      }
    },
    [supabase],
  );

  const handleNotificationPreferenceSave = React.useCallback(
    async (input: {
      profileId: string;
      orgId: string;
      prefKey: string;
      channels: string[];
    }) => {
      try {
        const channels = normalizeNotificationChannels(input.channels);
        const { error } = await supabase
          .from('notification_preferences')
          .upsert(
            {
              org_id: input.orgId,
              profile_id: input.profileId,
              pref_key: input.prefKey,
              channels,
              muted: null,
            },
            { onConflict: 'org_id,profile_id,pref_key' },
          );

        if (error) {
          throw error;
        }

        setSidebarData((prev) => {
          const currentDefaults = prev.user.profile.prefs.notificationDefaults ?? {};
          const existing = currentDefaults[input.prefKey];
          return {
            ...prev,
            user: {
              ...prev.user,
              profile: {
                ...prev.user.profile,
                prefs: {
                  ...prev.user.profile.prefs,
                  notificationDefaults: {
                    ...currentDefaults,
                    [input.prefKey]: {
                      channels,
                      muted: existing?.muted ?? null,
                    },
                  },
                },
              },
            },
          };
        });
      } catch (error) {
        showErrorToast('Unable to update notification preferences', error);
        throw error;
      }
    },
    [supabase],
  );

  const handleLocationUpdate = React.useCallback(
    async (input: {
      profileId: string;
      orgId: string;
      city: string;
      region: string;
      postalCode: string;
      countryCode?: string | null;
      countryName?: string | null;
    }) => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            city: input.city,
            region: input.region,
            postal_code: input.postalCode,
            country_code: input.countryCode ?? null,
            country_name: input.countryName ?? null,
          })
          .eq('id', input.profileId)
          .eq('org_id', input.orgId);

        if (error) {
          throw error;
        }

        setSidebarData((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            profile: {
              ...prev.user.profile,
              location: {
                ...prev.user.profile.location,
                city: input.city,
                region: input.region,
                postalCode: input.postalCode,
                countryCode: input.countryCode ?? null,
                countryName: input.countryName ?? null,
              },
            },
          },
        }));

        showSuccessToast('Location saved');
      } catch (error) {
        showErrorToast('Unable to save location', error);
        throw error;
      }
   },
   [supabase],
 );

  const handleFamilyInviteCreate = React.useCallback(
    async (input: {
      invitedEmail: string;
      invitedRole: FamilyLinkInviteRole;
      targetAccountId?: string;
    }) => {
      const invite = await sendFamilyInviteAction({
        invitedEmail: input.invitedEmail,
        invitedRole: input.invitedRole,
        targetAccountId: input.targetAccountId,
      });
      setSidebarData((prev) => {
        if (prev.user.profile.kind !== 'guardian') {
          return prev;
        }
        return {
          ...prev,
          user: {
            ...prev.user,
            profile: {
              ...prev.user.profile,
              familyInvites: [...(prev.user.profile.familyInvites ?? []), invite],
            },
          },
        };
      });
      return invite;
    },
    [],
  );

  const handleFamilyInviteRemove = React.useCallback(
    async (input: { inviteId: string }) => {
      await revokeFamilyInviteAction({ inviteId: input.inviteId });
      setSidebarData((prev) => {
        if (prev.user.profile.kind !== 'guardian') {
          return prev;
        }
        return {
          ...prev,
          user: {
            ...prev.user,
            profile: {
              ...prev.user.profile,
              familyInvites: (prev.user.profile.familyInvites ?? []).filter(
                (invite) => invite.id !== input.inviteId,
              ),
            },
          },
        };
      });
    },
    [],
  );

  const handleAvatarUpload = React.useCallback(
    async (input: { profileId: string; orgId: string; file: File }) => {
      try {
        const { file, profileId, orgId } = input;

        if (!file.type.startsWith('image/')) {
          throw new Error('Please upload an image file.');
        }

        if (file.size > 5 * 1024 * 1024) {
          throw new Error('Image must be 5MB or less.');
        }

        const rawExt = file.name.split('.').pop()?.toLowerCase();
        const extension = rawExt && rawExt !== file.name ? rawExt : 'jpg';
        const baseName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-z0-9-_]/gi, '-')
          .toLowerCase();
        const fileName = `${baseName || 'avatar'}-${Date.now()}.${extension}`;
        const path = `${orgId}/${profileId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, file, {
            upsert: true,
            contentType: file.type,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(path, AVATAR_SIGNED_URL_TTL);

        if (signedError || !signedData?.signedUrl) {
          throw new Error('Unable to create a signed photo URL.');
        }

        const updatedAt = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            avatar_source: 'upload',
            avatar_url: path,
            avatar_updated_at: updatedAt,
          })
          .eq('id', profileId)
          .eq('org_id', orgId);

        if (updateError) {
          throw updateError;
        }

        setSidebarData((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            profile: {
              ...prev.user.profile,
              profile: {
                ...prev.user.profile.profile,
                avatar: {
                  ...prev.user.profile.profile.avatar,
                  source: 'upload',
                  url: signedData.signedUrl,
                  updatedAt,
                },
              },
            },
          },
        }));

        showSuccessToast('Profile photo updated');
      } catch (error) {
        showErrorToast('Unable to update profile photo', error);
        throw error;
      }
    },
    [supabase],
  );

  const handleAvatarRemove = React.useCallback(
    async (input: { profileId: string; orgId: string }) => {
      try {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('profiles')
          .update({
            avatar_source: 'seed',
            avatar_url: null,
            avatar_updated_at: now,
          })
          .eq('id', input.profileId)
          .eq('org_id', input.orgId);

        if (error) {
          throw error;
        }

        setSidebarData((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            profile: {
              ...prev.user.profile,
              profile: {
                ...prev.user.profile.profile,
                avatar: {
                  ...prev.user.profile.profile.avatar,
                  source: 'seed',
                  url: null,
                  updatedAt: now,
                },
              },
            },
          },
        }));

        showSuccessToast('Profile photo removed');
      } catch (error) {
        showErrorToast('Unable to remove profile photo', error);
        throw error;
      }
    },
    [supabase],
  );

  return (
    <>
      <SidebarLeft
        data={sidebarData}
        activePath={pathname}
        onLogout={handleLogout}
        onboardingStatus={onboardingStatus}
        onOnboardingComplete={handleOnboardingComplete}
        onProfileSave={handleProfileSave}
        onChildProfileSave={handleChildProfileSave}
        onAccountUpdate={handleAccountUpdate}
        onPrefsSave={handlePrefsUpdate}
        onLocationSave={handleLocationUpdate}
        onAvatarUpload={handleAvatarUpload}
        onAvatarRemove={handleAvatarRemove}
        onNotificationPreferenceSave={handleNotificationPreferenceSave}
        onFamilyInviteCreate={handleFamilyInviteCreate}
      onFamilyInviteRemove={handleFamilyInviteRemove}
      onChildThemeSave={handleChildThemeSave}
      onChildProfileCreate={handleChildProfileCreate}
      onFamilyMemberRemove={handleFamilyMemberRemove}
      onEducatorProfileSave={handleEducatorProfileSave}
      onEducatorAvailabilitySave={handleEducatorAvailabilitySave}
      onStaffProfileSave={handleStaffProfileSave}
      onStatusOverrideSave={handleStatusOverrideSave}
      adminSections={adminSections ?? undefined}
      />
      <SidebarInset>{children}</SidebarInset>
    </>
  );
}

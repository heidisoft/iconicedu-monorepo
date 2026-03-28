'use client';

import * as React from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@iconicedu/ui-web/ui/sidebar';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import {
  AvatarWithStatus,
  getAvatarLocationLabel,
  getAvatarRoleLabel,
} from '@iconicedu/ui-web/components/shared/avatar-with-status';
import type { ChannelVM } from '@iconicedu/shared-types';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import {
  getDirectMessageItemUnreadCount,
  getDirectMessageUnreadCount,
} from './sidebar-unread';
import { cn } from '@iconicedu/ui-web/lib/utils';

export function NavDirectMessages({
  dms,
  currentUserId,
  activeChannelId,
  dashboardBasePath = '/',
}: {
  dms: ChannelVM[];
  currentUserId: string;
  activeChannelId?: string | null;
  dashboardBasePath?: string;
}) {
  const { isMobile } = useSidebar();
  const totalUnreadCount = React.useMemo(
    () => getDirectMessageUnreadCount(dms, currentUserId),
    [dms, currentUserId],
  );
  const sortedDirectMessages = React.useMemo(() => {
    const getTimestamp = (value?: string | null) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };
    const getLatestMessageTimestamp = (channel: ChannelVM) => {
      const items = channel.collections.messages?.items ?? [];
      let latest = 0;
      items.forEach((message: ChannelVM['collections']['messages']['items'][number]) => {
        const time = getTimestamp(message.core.createdAt);
        if (time > latest) latest = time;
      });
      return latest;
    };

    return dms
      .map((channel, index) => ({ channel, index }))
      .sort((a, b) => {
        const aUnread = (a.channel.collections.readState?.unreadCount ?? 0) > 0;
        const bUnread = (b.channel.collections.readState?.unreadCount ?? 0) > 0;
        if (aUnread !== bUnread) {
          return aUnread ? -1 : 1;
        }

        const aActivity = Math.max(
          getLatestMessageTimestamp(a.channel),
          getTimestamp(a.channel.collections.readState?.lastReadAt),
        );
        const bActivity = Math.max(
          getLatestMessageTimestamp(b.channel),
          getTimestamp(b.channel.collections.readState?.lastReadAt),
        );
        if (aActivity === bActivity) {
          return a.index - b.index;
        }
        return bActivity - aActivity;
      })
      .map(({ channel }) => channel);
  }, [dms]);
  const [shouldAnimateUnread, setShouldAnimateUnread] = React.useState(false);
  const previousUnreadCountRef = React.useRef(totalUnreadCount);
  const hasInitializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!hasInitializedRef.current) {
      previousUnreadCountRef.current = totalUnreadCount;
      hasInitializedRef.current = true;
      return;
    }

    if (totalUnreadCount <= previousUnreadCountRef.current) {
      previousUnreadCountRef.current = totalUnreadCount;
      return;
    }

    previousUnreadCountRef.current = totalUnreadCount;
    setShouldAnimateUnread(true);

    const timeout = window.setTimeout(() => {
      setShouldAnimateUnread(false);
    }, 1200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [totalUnreadCount]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="uppercase">
        <span className="inline-flex items-center gap-2">
          <span>Direct Messages</span>
          {totalUnreadCount > 0 ? (
            <Badge
              data-unread-animated={shouldAnimateUnread ? 'true' : 'false'}
              className={cn(
                'h-4 px-1.5 text-[10px] bg-rose-500 text-white',
                shouldAnimateUnread ? 'animate-pulse' : '',
              )}
            >
              {totalUnreadCount}
            </Badge>
          ) : null}
        </span>
      </SidebarGroupLabel>
      {/* <SidebarGroupAction title="Add Project">
        <Plus /> <span className="sr-only">Add Project</span>
      </SidebarGroupAction> */}
      <SidebarMenu>
        {sortedDirectMessages.map((item) => {
          const isActive = item.ids.id === activeChannelId;
          const otherParticipant =
            item.collections.participants.find(
              (participant) => participant.ids.accountId !== currentUserId,
            ) ?? item.collections.participants[0];
          const messageItems = item.collections.messages?.items ?? [];
          const latestMessage = messageItems[messageItems.length - 1];
          const senderFallbackProfile = latestMessage?.core.sender?.profile;
          const fallback = item.basics.topic ?? 'User';
          const name = getProfileDisplayName(
            otherParticipant?.profile ?? senderFallbackProfile,
            fallback,
          );
          const unreadCount = getDirectMessageItemUnreadCount(item, currentUserId);
          return (
            <SidebarMenuItem key={item.ids.id} className="py-1">
              <SidebarMenuButton
                asChild
                isActive={isActive}
                className="px-2.5 group-data-[collapsible=icon]:justify-center"
              >
                <a href={`${dashboardBasePath}/dm/${item.ids.id}`}>
                  <AvatarWithStatus
                    name={name}
                    avatar={otherParticipant?.profile.avatar}
                    presence={otherParticipant?.presence}
                    themeKey={otherParticipant?.ui?.themeKey}
                    roleLabel={getAvatarRoleLabel(otherParticipant?.kind)}
                    timezone={otherParticipant?.prefs.timezone ?? null}
                    locationLabel={getAvatarLocationLabel(otherParticipant?.location)}
                    about={otherParticipant?.profile.bio ?? null}
                    sizeClassName="size-7"
                    statusClassName="bottom-0 right-0 h-2 w-2 border border-background"
                    fallbackClassName="text-xs font-medium"
                    initialsLength={1}
                  />
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <div className="truncate text-sm font-medium">{name}</div>
                    {(otherParticipant?.presence?.state?.emoji ||
                      otherParticipant?.presence?.state?.text) && (
                      <div className="truncate text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          {otherParticipant?.presence?.state?.emoji ? (
                            <span>{otherParticipant.presence.state.emoji}</span>
                          ) : null}
                          {otherParticipant?.presence?.state?.text ? (
                            <span className="truncate">
                              {otherParticipant.presence.state.text}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <Badge className="ml-auto h-5 px-1.5 text-[10px] group-data-[collapsible=icon]:hidden">
                      {unreadCount}
                    </Badge>
                  )}
                </a>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-56"
                  side={isMobile ? 'bottom' : 'right'}
                  align={isMobile ? 'end' : 'start'}
                >
                  <DropdownMenuItem>
                    <Trash2 className="text-muted-foreground" />
                    <span>Remove</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

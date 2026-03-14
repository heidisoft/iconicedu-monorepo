'use client';
import {
  ChevronDown,
  ChevronUp,
  Languages,
  ListXIcon,
  MessageSquarePlus,
  MoreHorizontal,
  StarOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LearningSpaceVM, UserProfileVM } from '@iconicedu/shared-types';

// eslint-disable-next-line no-restricted-imports
import { ClassRequestAction } from '../class-request/class-request-action';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@iconicedu/ui-web/ui/collapsible';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@iconicedu/ui-web/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { Empty, EmptyContent } from '@iconicedu/ui-web/ui/empty';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { ThemedIconBadge } from '@iconicedu/ui-web/components/shared/themed-icon';
import { getLearningSpaceIcon } from '@iconicedu/ui-web/lib/icons';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { getLearningSpaceItemUnreadCountForUser } from './sidebar-unread';

export function NavLearningSpaces({
  learningSpaces,
  title,
  participant,
  isOpen,
  onOpenChange,
  activeChannelId,
  isMobile,
  currentUser,
  dashboardBasePath = '/',
  classRequestAction,
}: {
  learningSpaces: LearningSpaceVM[];
  title: string;
  participant: Pick<UserProfileVM, 'ids' | 'profile' | 'ui'>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeChannelId?: string | null;
  isMobile: boolean;
  currentUser?: { accountId?: string; profileId?: string };
  dashboardBasePath?: string;
  classRequestAction?: {
    orgSlug: string;
    fallbackHref: string;
    canRequestClasses: boolean;
    requestRole: 'parents' | 'students' | 'other';
    requestableStudents: Array<{ profileId: string; displayName: string }>;
    subjectOptions?: string[];
  };
}) {
  return (
    <SidebarGroup className="py-0 group-data-[collapsible=icon]:hidden">
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="flex cursor-pointer items-center gap-2 rounded-md rounded-b-none px-2 py-1 uppercase">
            <AvatarWithStatus
              name={getProfileDisplayName(participant.profile)}
              showStatus={false}
              themeKey={participant.ui?.themeKey ?? null}
              sizeClassName="size-5"
              fallbackClassName={cn('text-[10px] font-semibold leading-none uppercase')}
              initialsLength={1}
            />
            <span className="flex-1">{title.split(' ')[0]}</span>
            {isOpen ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-md rounded-t-none">
          {learningSpaces.length === 0 ? (
            <Empty>
              <EmptyContent>
                <div className="flex">
                  {classRequestAction ? (
                    <ClassRequestAction
                      orgSlug={classRequestAction.orgSlug}
                      fallbackHref={classRequestAction.fallbackHref}
                      canRequestClasses={classRequestAction.canRequestClasses}
                      requestRole={classRequestAction.requestRole}
                      requestableStudents={classRequestAction.requestableStudents}
                      subjectOptions={classRequestAction.subjectOptions}
                      renderTrigger={({ canRequestClasses, fallbackHref, openDialog }) =>
                        canRequestClasses ? (
                          <Button size="lg" type="button" onClick={openDialog}>
                            <MessageSquarePlus /> Explore Classes
                          </Button>
                        ) : (
                          <Button size="lg" asChild>
                            <a href={fallbackHref}>
                              <MessageSquarePlus /> Explore Classes
                            </a>
                          </Button>
                        )
                      }
                    />
                  ) : (
                    <Button size="lg" asChild>
                      <a href={`${dashboardBasePath}/spaces`}>
                        <MessageSquarePlus /> Explore Classes
                      </a>
                    </Button>
                  )}
                </div>
              </EmptyContent>
            </Empty>
          ) : (
            <SidebarMenu>
              {learningSpaces.map((space) => {
                const channel = space.channels.primaryChannel;
                const iconKey = space.basics.iconKey ?? channel.basics.iconKey ?? null;
                const Icon: LucideIcon = getLearningSpaceIcon(iconKey, Languages);
                const isActive = activeChannelId === channel.ids.id;
                const unreadCount = getLearningSpaceItemUnreadCountForUser(
                  space,
                  currentUser,
                );

                return (
                  <SidebarMenuItem key={space.ids.id} className="py-0.5">
                    <SidebarMenuButton
                      asChild
                      tooltip={space.basics.title}
                      isActive={isActive}
                      className="px-2.5"
                    >
                      <a href={`${dashboardBasePath}/spaces/${channel.ids.id}`}>
                        <ThemedIconBadge
                          icon={Icon}
                          themeKey={channel.ui?.themeKey ?? null}
                          size="md"
                          className="shrink-0 rounded-full"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {space.basics.title}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {space.basics.subject ?? 'General'}
                          </div>
                        </div>
                        {unreadCount > 0 ? (
                          <Badge className="ml-auto h-5 px-1.5 text-[10px]">
                            {unreadCount}
                          </Badge>
                        ) : null}
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
                          <StarOff className="text-muted-foreground" />
                          <span>Add to Favorites</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-400">
                          <ListXIcon className="text-red-500" />
                          <span>Hide</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          )}
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

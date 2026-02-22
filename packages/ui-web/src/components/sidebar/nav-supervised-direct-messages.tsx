'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import type { ChannelVM, ChildProfileVM } from '@iconicedu/shared-types';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@iconicedu/ui-web/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@iconicedu/ui-web/ui/sidebar';

export function NavSupervisedDirectMessages({
  child,
  dms,
  isOpen,
  onOpenChange,
  activeChannelId,
  dashboardBasePath = '/d',
}: {
  child: ChildProfileVM;
  dms: ChannelVM[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeChannelId?: string | null;
  dashboardBasePath?: string;
}) {
  return (
    <SidebarGroup className="py-0 group-data-[collapsible=icon]:hidden">
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="flex cursor-pointer items-center gap-2 rounded-md rounded-b-none px-2 py-1 uppercase">
            <AvatarWithStatus
              name={getProfileDisplayName(child.profile)}
              showStatus={false}
              themeKey={child.ui?.themeKey ?? null}
              sizeClassName="size-5"
              fallbackClassName="text-[10px] font-semibold leading-none uppercase"
              initialsLength={1}
            />
            <span className="flex-1">{getProfileDisplayName(child.profile).split(' ')[0]}</span>
            {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-md rounded-t-none">
          <SidebarMenu>
            {dms.map((item) => {
              const isActive = item.ids.id === activeChannelId;
              const otherParticipant =
                item.collections.participants.find(
                  (participant) => participant.ids.accountId !== child.ids.accountId,
                ) ?? item.collections.participants[0];
              const fallback = item.basics.topic ?? 'User';
              const name = getProfileDisplayName(otherParticipant?.profile, fallback);

              return (
                <SidebarMenuItem key={item.ids.id} className="py-1">
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="px-2.5 group-data-[collapsible=icon]:px-0"
                  >
                    <a href={`${dashboardBasePath}/dm/${item.ids.id}`}>
                      <AvatarWithStatus
                        name={name}
                        avatar={otherParticipant?.profile.avatar}
                        presence={otherParticipant?.presence}
                        themeKey={otherParticipant?.ui?.themeKey}
                        sizeClassName="size-7"
                        statusClassName="bottom-0 right-0 h-2 w-2 border border-background"
                        fallbackClassName="text-xs font-medium"
                        initialsLength={1}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{name}</div>
                      </div>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

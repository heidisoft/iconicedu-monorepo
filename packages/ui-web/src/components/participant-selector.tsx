'use client';

import * as React from 'react';
import { UserPlus, X } from 'lucide-react';

import { cn } from '@iconicedu/ui-web/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@iconicedu/ui-web/ui/avatar';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@iconicedu/ui-web/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@iconicedu/ui-web/ui/popover';
import type { UserProfileVM } from '@iconicedu/shared-types';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';

const ROLE_LABELS: Record<UserProfileVM['kind'], string> = {
  guardian: 'Parent',
  child: 'Child',
  educator: 'Educator',
  staff: 'Staff',
  system: 'System',
};

const ROLE_STYLES: Record<UserProfileVM['kind'], string> = {
  guardian: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  child: 'bg-sky-100 text-sky-700 border-sky-200',
  educator: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  staff: 'bg-amber-100 text-amber-700 border-amber-200',
  system: 'bg-gray-100 text-gray-700 border-gray-200',
};

function getEmail(user: UserProfileVM) {
  const email = user.accountEmail?.trim() || user.profile.email?.trim();
  if (email) return email;
  return '';
}

function getSecondaryText(user: UserProfileVM) {
  const email = getEmail(user);
  if (user.kind === 'child' && user.guardianNames?.length) {
    const parentText = `Parent: ${user.guardianNames.join(', ')}`;
    if (email) return `${email} • ${parentText}`;
    return `${parentText} • ${ROLE_LABELS[user.kind]}`;
  }
  return email || ROLE_LABELS[user.kind];
}

function getGuardianNamesSearchText(user: UserProfileVM) {
  return user.kind === 'child' && user.guardianNames?.length
    ? user.guardianNames.join(' ')
    : '';
}

interface ParticipantSelectorProps {
  users: UserProfileVM[];
  selectedUsers: UserProfileVM[];
  onUserAdd: (user: UserProfileVM) => void;
  onUserRemove: (user: UserProfileVM) => void;
  placeholder?: string;
}

const ROLE_ORDER: UserProfileVM['kind'][] = [
  'guardian',
  'child',
  'educator',
  'staff',
  'system',
];

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getDisplayName(user: UserProfileVM) {
  return getProfileDisplayName(user.profile, 'Unknown');
}

export function ParticipantSelector({
  users,
  selectedUsers,
  onUserAdd,
  onUserRemove,
  placeholder = 'Add participant',
}: ParticipantSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const availableUsers = users.filter(
    (user) => !selectedUsers.some((selected) => selected.ids.id === user.ids.id),
  );

  const groupedUsers = ROLE_ORDER.map((kind) => ({
    kind,
    users: availableUsers.filter((user) => user.kind === kind),
  })).filter((group) => group.users.length > 0);

  return (
    <div className="w-full space-y-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-12 w-full justify-start gap-2 border-2 border-blue-500 bg-background px-4 hover:bg-background focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <UserPlus className="size-5 text-muted-foreground" />
            <span className="text-muted-foreground">{placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search by name or email" />
            <CommandList
              onWheel={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
            >
              <CommandEmpty>No users found.</CommandEmpty>
              {groupedUsers.map((group) => (
                <CommandGroup key={group.kind} heading={ROLE_LABELS[group.kind]}>
                  {group.users.map((user) => {
                    const displayName = getDisplayName(user);
                    const avatarUrl = user.profile.avatar?.url ?? undefined;
                    const emailText = getEmail(user);
                    const secondaryText = getSecondaryText(user);
                    return (
                      <CommandItem
                        key={user.ids.id}
                        value={`${displayName} ${secondaryText} ${emailText} ${getGuardianNamesSearchText(user)}`}
                        onSelect={() => {
                          onUserAdd(user);
                          setOpen(false);
                        }}
                        className="flex items-center gap-3 my-2 rounded-full hover:bg-muted"
                      >
                        <Avatar className="size-10">
                          <AvatarImage src={avatarUrl} alt={displayName} />
                          <AvatarFallback className="text-sm">
                            {getInitials(displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {displayName}
                          </span>
                          <span className="truncate text-sm text-muted-foreground">
                            {secondaryText}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('ml-auto text-xs', ROLE_STYLES[user.kind])}
                        >
                          {ROLE_LABELS[user.kind]}
                        </Badge>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedUsers.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Selected Participants ({selectedUsers.length})
          </p>
          <div className="rounded-lg border bg-card">
            {selectedUsers.map((user, index) => {
              const displayName = getDisplayName(user);
              const avatarUrl = user.profile.avatar?.url ?? undefined;
              const secondaryText = getSecondaryText(user);
              return (
                <div
                  key={user.ids.id}
                  className={cn(
                    'flex items-center gap-3 p-3',
                    index !== selectedUsers.length - 1 && 'border-b',
                  )}
                >
                  <Avatar className="size-10">
                    <AvatarImage src={avatarUrl} alt={displayName} />
                    <AvatarFallback className="text-sm">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-foreground">
                      {displayName}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {secondaryText}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('text-xs', ROLE_STYLES[user.kind])}
                  >
                    {ROLE_LABELS[user.kind]}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onUserRemove(user)}
                  >
                    <X className="size-4" />
                    <span className="sr-only">Remove {displayName}</span>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

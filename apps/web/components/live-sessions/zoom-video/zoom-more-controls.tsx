'use client';

import type { ReactNode } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@iconicedu/ui-web/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@iconicedu/ui-web/ui/dropdown-menu';
import { useIsMobile } from '@iconicedu/ui-web/hooks/use-mobile';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { MeetingControlButton } from './zoom-meeting-controls';

export type ZoomMoreAction = {
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  mobileOnly?: boolean;
  onSelect: () => void;
};

function ActionRow({ action, close }: { action: ZoomMoreAction; close: () => void }) {
  return (
    <button
      type="button"
      disabled={action.disabled}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors',
        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
        action.active && 'bg-primary/10 text-primary',
      )}
      onClick={() => {
        action.onSelect();
        close();
      }}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted [&_svg]:size-4">
        {action.icon}
      </span>
      {action.label}
    </button>
  );
}

export function ZoomMoreControls({
  open,
  actions,
  onOpenChange,
}: {
  open: boolean;
  actions: ZoomMoreAction[];
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const trigger = (
    <MeetingControlButton
      label={open ? 'Close more controls' : 'More controls'}
      tone={open ? 'active' : 'neutral'}
      className="zoom-toolbar-more"
      aria-expanded={open}
    >
      <MoreHorizontal className="size-4" />
    </MeetingControlButton>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="relative pr-14 text-left">
            <DrawerTitle>More controls</DrawerTitle>
            <DrawerDescription>Additional tools for this class</DrawerDescription>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-4 top-3 rounded-full"
                aria-label="Close more controls"
              >
                <X />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="grid grid-cols-2 gap-1 px-4 pb-2">
            {actions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                close={() => onOpenChange(false)}
              />
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" sideOffset={12} className="w-64">
        {actions
          .filter((action) => !action.mobileOnly)
          .map((action) => (
            <DropdownMenuItem
              key={action.id}
              disabled={action.disabled}
              className={cn('min-h-11', action.active && 'bg-primary/10 text-primary')}
              onSelect={action.onSelect}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

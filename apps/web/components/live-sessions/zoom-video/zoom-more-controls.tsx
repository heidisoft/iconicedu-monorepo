'use client';
import { NotificationCard } from '@iconicedu/ui-web/ui/notification-card';

import type { MeetingFeatureAction } from './meeting-feature-action';
import { Ellipsis, X } from 'lucide-react';
import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';
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
import { usePortalContainer } from '@iconicedu/ui-web/ui/portal-container';
import { useIsMobile } from '@iconicedu/ui-web/hooks/use-mobile';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { MeetingControlButton } from './zoom-meeting-controls';

function ActionRow({
  action,
  close,
}: {
  action: MeetingFeatureAction;
  close: () => void;
}) {
  return (
    <button
      type="button"
      disabled={action.disabled}
      className={cn(
        'flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-xl px-2 py-3 text-center text-xs font-medium transition-colors',
        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
        action.active && 'bg-primary/10 text-primary',
      )}
      onClick={() => {
        action.onSelect();
        close();
      }}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted [&_svg]:size-5">
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
  error,
}: {
  open: boolean;
  error?: string | null;
  actions: MeetingFeatureAction[];
  onOpenChange: (open: boolean) => void;
}) {
  const portalContainer = usePortalContainer();
  const mobileViewport = useIsMobile();
  // A compact floating call uses a menu in its own document instead of a mobile sheet.
  const isMobile = mobileViewport && !portalContainer;
  const menuActions = actions;
  const featureError = error ? (
    <NotificationCard
      role="alert"
      message={error}
      className="absolute bottom-full left-1/2 mb-3 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2"
    />
  ) : null;
  const trigger = (
    <MeetingControlButton
      label={open ? 'Close more controls' : 'More controls'}
      tone={open ? 'active' : 'neutral'}
      className="zoom-toolbar-more"
      aria-expanded={open}
    >
      <Ellipsis className="size-4" />
    </MeetingControlButton>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange} dismissible>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent className="max-h-[75dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="relative pr-14 text-left">
              <DrawerTitle>More controls</DrawerTitle>
              <DrawerDescription className="sr-only">
                Additional tools for this class
              </DrawerDescription>
              <DrawerClose asChild>
                <IconActionButton
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-3 rounded-full"
                  label="Close more controls"
                >
                  <X />
                </IconActionButton>
              </DrawerClose>
            </DrawerHeader>
            <div className="grid grid-cols-3 gap-1 px-4 pb-2">
              {menuActions.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  close={() => onOpenChange(false)}
                />
              ))}
            </div>
          </DrawerContent>
        </Drawer>
        {featureError}
      </>
    );
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" sideOffset={12} className="w-64">
          {menuActions
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
      {featureError}
    </>
  );
}

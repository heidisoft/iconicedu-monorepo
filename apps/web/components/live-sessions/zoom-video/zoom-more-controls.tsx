'use client';

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
    <p
      role="alert"
      className="absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-xl border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg"
    >
      {error}
    </p>
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
          <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="relative pr-14 text-left">
              <DrawerTitle>More controls</DrawerTitle>
              <DrawerDescription>Additional tools for this class</DrawerDescription>
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
            <div className="grid grid-cols-2 gap-1 px-4 pb-2">
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

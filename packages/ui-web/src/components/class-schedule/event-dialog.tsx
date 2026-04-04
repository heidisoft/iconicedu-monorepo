'use client';

import type React from 'react';

import { Separator } from '@iconicedu/ui-web/ui/separator';
import { EventDetailsHeader } from '@iconicedu/ui-web/components/class-schedule/event-details-header';
import { EventDetailsInfo } from '@iconicedu/ui-web/components/class-schedule/event-details-info';
import { EventActions } from '@iconicedu/ui-web/components/class-schedule/event-actions';
import { ResponsiveDialog } from '@iconicedu/ui-web/components/shared/responsive-dialog';
import type { DisplayClassScheduleVM } from '@iconicedu/ui-web/lib/class-schedule-utils';

interface EventDialogProps {
  event: DisplayClassScheduleVM;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  canCancelSession?: boolean;
  onCancelSession?: (
    event: DisplayClassScheduleVM,
    reason?: string | null,
  ) => Promise<void>;
}

export function EventDialog({
  event,
  open,
  onOpenChange,
  children,
  canCancelSession = false,
  onCancelSession,
}: EventDialogProps) {
  const content = (
    // <ScrollArea className="max-h-[85vh]">
    <div className="p-4">
      <div className="space-y-4">
        <EventDetailsHeader event={event} />
        <div className="px-4 space-y-3">
          <EventDetailsInfo event={event} />
          <Separator />
          <EventActions
            event={event}
            onClose={() => onOpenChange(false)}
            canCancelSession={canCancelSession}
            onCancelSession={onCancelSession}
          />
        </div>
      </div>
    </div>
    // </ScrollArea>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={event.title || 'Class schedule details'}
      trigger={children}
      showHeader={false}
      dialogShowCloseButton={false}
      drawerProps={{ 'data-vaul-custom-container': true }}
      drawerContentClassName="flex flex-col overflow-hidden bg-background p-0 rounded-t-xl before:inset-0 before:rounded-t-xl"
      dialogContentClassName="max-w-lg max-h-[85vh] p-0 gap-0 [&>button]:hidden"
    >
      {content}
    </ResponsiveDialog>
  );
}

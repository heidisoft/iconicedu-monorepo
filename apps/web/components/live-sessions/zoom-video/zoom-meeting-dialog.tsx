'use client';

import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@iconicedu/ui-web/ui/dialog';
import { cn } from '@iconicedu/ui-web/lib/utils';

export function ZoomMeetingDialog({
  open,
  title,
  description,
  trigger,
  children,
  className,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description?: string;
  trigger?: ReactNode;
  children: ReactNode;
  className?: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={cn(
          'max-h-[85dvh] overflow-y-auto border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl sm:max-w-md',
          className,
        )}
      >
        <DialogHeader className="pr-10">
          <DialogTitle className="text-xl tracking-tight">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

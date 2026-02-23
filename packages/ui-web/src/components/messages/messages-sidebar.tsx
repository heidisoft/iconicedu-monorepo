'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useIsMobile } from '@iconicedu/ui-web/hooks/use-mobile';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Card, CardContent, CardHeader } from '@iconicedu/ui-web/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@iconicedu/ui-web/ui/drawer';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { cn } from '@iconicedu/ui-web/lib/utils';

interface MessagesSidebarProps {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  mobileScrollable?: boolean;
  layout?: 'fixed' | 'resizable';
  className?: string;
}

function SidebarHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold text-foreground">{title}</div>
        {subtitle ? (
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={onClose}
        aria-label="Close sidebar"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function MessagesSidebar({
  title,
  subtitle,
  open,
  onClose,
  children,
  layout = 'fixed',
  className,
}: MessagesSidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    if (!open) return null;
    return (
      <Drawer open={open} onOpenChange={(value) => !value && onClose()}>
        <DrawerContent
          className={cn(
            'flex flex-col overflow-hidden bg-background p-0 rounded-t-xl',
            className,
          )}
        >
          <DrawerHeader className="border-b border-border px-4 py-3">
            <DrawerTitle className="sr-only">{title}</DrawerTitle>
            <SidebarHeader title={title} subtitle={subtitle} onClose={onClose} />
          </DrawerHeader>
          <ScrollArea className="flex min-h-0 flex-1">
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'hidden md:flex overflow-hidden min-w-0 flex-1 h-full',
        layout === 'resizable'
          ? 'w-full transition-[opacity,transform] duration-200 motion-reduce:transition-none data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:translate-x-4 data-[state=open]:opacity-100 data-[state=open]:translate-x-0'
          : 'transition-[width,opacity,transform] duration-200 motion-reduce:transition-none data-[state=closed]:w-0 data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:translate-x-4 data-[state=open]:w-[360px] data-[state=open]:opacity-100 data-[state=open]:translate-x-0',
      )}
    >
      <Card className="flex h-full w-full min-h-0 flex-col rounded-none border-0 border-l border-border p-0">
        <CardHeader className="min-h-16 border-b border-border px-4 py-3!">
          <SidebarHeader title={title} subtitle={subtitle} onClose={onClose} />
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <ScrollArea className="flex-1 min-h-0">
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

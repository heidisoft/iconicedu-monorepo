'use client';

import * as React from 'react';

import { cn } from '@iconicedu/ui-web/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@iconicedu/ui-web/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@iconicedu/ui-web/ui/drawer';
import { useIsMobile } from '@iconicedu/ui-web/hooks/use-mobile';

type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  trigger?: React.ReactNode;
  children: React.ReactNode;
  showHeader?: boolean;
  dialogContentClassName?: string;
  drawerContentClassName?: string;
  dialogHeaderClassName?: string;
  drawerHeaderClassName?: string;
  dialogTitleClassName?: string;
  drawerTitleClassName?: string;
  dialogDescriptionClassName?: string;
  drawerDescriptionClassName?: string;
  dialogShowCloseButton?: boolean;
  containerClassName?: string;
  bodyClassName?: string;
  dialogProps?: React.ComponentProps<typeof Dialog>;
  drawerProps?:
    | (React.ComponentProps<typeof Drawer> & Record<string, unknown>)
    | undefined;
};

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  showHeader = true,
  dialogContentClassName,
  drawerContentClassName,
  dialogHeaderClassName,
  drawerHeaderClassName,
  dialogTitleClassName,
  drawerTitleClassName,
  dialogDescriptionClassName,
  drawerDescriptionClassName,
  dialogShowCloseButton = true,
  containerClassName,
  bodyClassName,
  dialogProps,
  drawerProps,
}: ResponsiveDialogProps) {
  const isMobileView = useIsMobile();
  const dialogTitleClasses = cn(!showHeader && 'sr-only', dialogTitleClassName);
  const drawerTitleClasses = cn(!showHeader && 'sr-only', drawerTitleClassName);

  const headerContent = showHeader ? (
    <DrawerHeader className={drawerHeaderClassName}>
      <DrawerTitle className={drawerTitleClasses}>{title}</DrawerTitle>
      {description ? (
        <DrawerDescription className={drawerDescriptionClassName}>
          {description}
        </DrawerDescription>
      ) : null}
    </DrawerHeader>
  ) : (
    <DrawerTitle className={drawerTitleClasses}>{title}</DrawerTitle>
  );

  const dialogHeaderContent = showHeader ? (
    <DialogHeader className={dialogHeaderClassName}>
      <DialogTitle className={dialogTitleClasses}>{title}</DialogTitle>
      {description ? (
        <DialogDescription className={dialogDescriptionClassName}>
          {description}
        </DialogDescription>
      ) : null}
    </DialogHeader>
  ) : (
    <DialogTitle className={dialogTitleClasses}>{title}</DialogTitle>
  );

  const renderContent = (headerNode: React.ReactNode, bodyNode: React.ReactNode) =>
    containerClassName ? (
      <div className={cn('flex flex-col min-h-0', containerClassName)}>
        {headerNode}
        {bodyNode}
      </div>
    ) : (
      <>
        {headerNode}
        {bodyNode}
      </>
    );

  if (isMobileView) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} {...drawerProps}>
        {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
        <DrawerContent className={drawerContentClassName}>
          {renderContent(
            headerContent,
            bodyClassName ? (
              <div className={cn('flex-1 min-h-0', bodyClassName)}>{children}</div>
            ) : (
              children
            ),
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...dialogProps}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={dialogContentClassName}
        showCloseButton={dialogShowCloseButton}
      >
        {renderContent(
          dialogHeaderContent,
          bodyClassName ? (
            <div className={cn('flex-1 min-h-0', bodyClassName)}>{children}</div>
          ) : (
            children
          ),
        )}
      </DialogContent>
    </Dialog>
  );
}

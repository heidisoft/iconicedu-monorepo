'use client';

import * as React from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@iconicedu/ui-web/ui/empty';

type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type EmptyMessagesStateProps = {
  title?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  starterAction?: EmptyStateAction;
  primaryAction?: EmptyStateAction;
  secondaryText?: React.ReactNode;
  showClearButton?: boolean;
  clearButtonLabel?: string;
};

export function EmptyMessagesState({
  title = 'Sorry, no results!',
  description = (
    <>
      We could not find any messages yet.
      <br />
      Please try again or browse all apps.
    </>
  ),
  icon,
  className,
  starterAction,
  primaryAction,
  secondaryText,
  showClearButton = false,
  clearButtonLabel = 'Clear search',
}: EmptyMessagesStateProps) {
  return (
    <Empty
      className={cn(
        'max-w-md rounded-2xl border border-dashed border-border bg-background/60 px-6 py-10',
        className,
      )}
    >
      <EmptyHeader className="max-w-none items-center text-center">
        <EmptyMedia variant="icon">
          {icon ?? <MessageSquare className="size-5" />}
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>

      {showClearButton || starterAction || primaryAction || secondaryText ? (
        <EmptyContent className="pt-2">
          {showClearButton ? (
            <Button variant="outline" className="bg-transparent px-6">
              {clearButtonLabel}
            </Button>
          ) : null}

          {starterAction ? (
            <Button
              variant="default"
              className="px-6"
              onClick={starterAction.onClick}
              asChild={Boolean(starterAction.href)}
            >
              {starterAction.href ? (
                <a href={starterAction.href}>{starterAction.label}</a>
              ) : (
                starterAction.label
              )}
            </Button>
          ) : null}

          {primaryAction ? (
            <Button
              variant="outline"
              className="bg-transparent px-6"
              onClick={primaryAction.onClick}
              asChild={Boolean(primaryAction.href)}
            >
              {primaryAction.href ? (
                <a href={primaryAction.href}>{primaryAction.label}</a>
              ) : (
                primaryAction.label
              )}
            </Button>
          ) : null}

          {secondaryText ? (
            <p className="text-sm text-muted-foreground">{secondaryText}</p>
          ) : null}
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

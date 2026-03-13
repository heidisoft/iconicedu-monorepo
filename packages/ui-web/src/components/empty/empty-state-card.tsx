'use client';

import type { ReactNode } from 'react';

import { cn } from '@iconicedu/ui-web/lib/utils';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@iconicedu/ui-web/ui/empty';

interface EmptyStateCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
}

export function EmptyStateCard({
  title,
  description,
  icon,
  className,
}: EmptyStateCardProps) {
  return (
    <Empty
      className={cn(
        'rounded-2xl border border-dashed border-border bg-background/60 px-6 py-10',
        className,
      )}
    >
      <EmptyHeader className="max-w-none items-center text-center">
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

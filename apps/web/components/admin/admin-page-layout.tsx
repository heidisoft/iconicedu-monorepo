import type { ReactNode } from 'react';

import { DashboardHeader } from '@iconicedu/ui-web';
import { cn } from '@iconicedu/ui-web/lib/utils';

type AdminPageShellProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function AdminPageShell({ title, children, className }: AdminPageShellProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <DashboardHeader title={title} />
      <main
        className={cn(
          'flex w-full min-w-0 max-w-[100rem] flex-1 flex-col gap-6 self-center p-4 sm:p-6 lg:p-8',
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}

type AdminPageHeadingProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
};

export function AdminPageHeading({
  title,
  description,
  actions,
  eyebrow,
  className,
}: AdminPageHeadingProps) {
  return (
    <header
      className={cn(
        'flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 text-xs font-medium text-muted-foreground">{eyebrow}</div>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

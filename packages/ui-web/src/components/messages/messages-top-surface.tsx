'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { ChannelVM } from '@iconicedu/shared-types';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { GridPattern } from '@iconicedu/ui-web/ui/grid-pattern';

interface MessagesTopSurfaceProps {
  channel: ChannelVM;
  children: ReactNode;
  className?: string;
  showBottomBorder?: boolean;
  showPattern?: boolean;
  'data-testid'?: string;
}

export function MessagesTopSurface({
  channel,
  children,
  className,
  showBottomBorder = false,
  showPattern = true,
  'data-testid': dataTestId,
}: MessagesTopSurfaceProps) {
  const themeClass = channel.ui?.themeKey ? `theme-${channel.ui.themeKey}` : '';
  const style = buildMessagesTopSurfaceStyle(Boolean(channel.ui?.themeKey));

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        themeClass,
        showBottomBorder && 'border-b',
        className,
      )}
      style={style}
      data-testid={dataTestId}
      data-channel-theme={channel.ui?.themeKey ?? 'fallback'}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--messages-top-surface-bg)]"
      />
      {showPattern ? (
        <GridPattern
          width={36}
          height={36}
          x={-12}
          y={-12}
          squares={[
            [4, 4],
            [5, 1],
            [8, 2],
            [5, 3],
            [5, 5],
            [10, 10],
            [12, 15],
            [15, 10],
            [10, 15],
            [14, 8],
          ]}
          className="absolute inset-x-0 inset-y-[-30%] h-[200%] w-full skew-y-12 opacity-90 [mask-image:radial-gradient(540px_circle_at_center,white,transparent)]"
          style={
            {
              stroke: 'var(--messages-top-pattern-stroke)',
              fill: 'var(--messages-top-pattern-fill)',
            } as CSSProperties
          }
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}

function buildMessagesTopSurfaceStyle(hasTheme: boolean): CSSProperties {
  if (hasTheme) {
    return {
      borderColor: 'var(--messages-top-border)',
      ['--messages-top-surface-bg' as string]:
        'color-mix(in oklab, var(--theme-bg) 6%, var(--background) 94%)',
      ['--messages-top-border' as string]:
        'color-mix(in oklab, var(--theme-bg) 18%, var(--border) 82%)',
      ['--messages-top-pattern-stroke' as string]:
        'color-mix(in oklab, var(--theme-bg) 18%, transparent)',
      ['--messages-top-pattern-fill' as string]:
        'color-mix(in oklab, var(--theme-bg) 8%, transparent)',
      ['--messages-top-indicator' as string]: 'var(--theme-bg)',
      ['--messages-top-tab-hover' as string]:
        'color-mix(in oklab, var(--theme-bg) 10%, transparent)',
      ['--messages-top-tabs-bg' as string]:
        'color-mix(in oklab, var(--theme-bg) 7%, transparent)',
      ['--messages-top-tabs-border' as string]:
        'color-mix(in oklab, var(--theme-bg) 12%, transparent)',
      ['--messages-top-tab-active-bg' as string]:
        'color-mix(in oklab, var(--theme-bg) 10%, var(--background) 72%)',
      ['--messages-top-tab-active-border' as string]:
        'color-mix(in oklab, var(--theme-bg) 14%, transparent)',
    };
  }

  return {
    borderColor: 'var(--messages-top-border)',
    ['--messages-top-surface-bg' as string]:
      'color-mix(in oklab, var(--muted) 58%, var(--background) 42%)',
    ['--messages-top-border' as string]:
      'color-mix(in oklab, var(--border) 82%, var(--muted) 18%)',
    ['--messages-top-pattern-stroke' as string]:
      'color-mix(in oklab, var(--muted-foreground) 10%, transparent)',
    ['--messages-top-pattern-fill' as string]:
      'color-mix(in oklab, var(--muted-foreground) 4%, transparent)',
    ['--messages-top-indicator' as string]: 'var(--foreground)',
    ['--messages-top-tab-hover' as string]:
      'color-mix(in oklab, var(--foreground) 5%, transparent)',
    ['--messages-top-tabs-bg' as string]:
      'color-mix(in oklab, var(--background) 48%, transparent)',
    ['--messages-top-tabs-border' as string]:
      'color-mix(in oklab, var(--muted-foreground) 8%, transparent)',
    ['--messages-top-tab-active-bg' as string]:
      'color-mix(in oklab, var(--background) 70%, transparent)',
    ['--messages-top-tab-active-border' as string]:
      'color-mix(in oklab, var(--muted-foreground) 8%, transparent)',
  };
}

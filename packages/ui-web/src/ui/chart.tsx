'use client';

import * as React from 'react';
import type { TooltipProps, LegendProps } from 'recharts';
import { ResponsiveContainer } from 'recharts';

import { cn } from '@iconicedu/ui-web/lib/utils';

export type ChartConfig = Record<
  string,
  {
    label: string;
    color: string;
  }
>;

function ChartContainer({
  config,
  className,
  children,
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ReactNode;
}) {
  const style = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color]),
      ) as React.CSSProperties,
    [config],
  );

  return (
    <div
      data-slot="chart"
      className={cn('h-[280px] w-full text-xs', className)}
      style={style}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  formatter,
}: TooltipProps<number, string> & {
  className?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        'bg-background/95 ring-border grid min-w-40 gap-2 rounded-lg px-3 py-2 text-xs shadow-md ring-1 backdrop-blur',
        className,
      )}
    >
      {label ? <div className="text-foreground font-medium">{label}</div> : null}
      <div className="grid gap-1.5">
        {payload.map((entry) => {
          const key = entry.dataKey?.toString() ?? entry.name ?? 'value';
          const rawValue =
            typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0);

          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{
                    backgroundColor: entry.color ?? entry.stroke ?? 'currentColor',
                  }}
                />
                <span className="text-muted-foreground">{entry.name ?? key}</span>
              </div>
              <span className="font-medium">
                {formatter ? formatter(rawValue, key) : rawValue.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartLegendContent({
  payload,
  className,
}: LegendProps & {
  className?: string;
}) {
  if (!payload?.length) {
    return null;
  }

  return (
    <div className={cn('mt-3 flex flex-wrap gap-3 text-xs', className)}>
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color ?? 'currentColor' }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export { ChartContainer, ChartLegendContent, ChartTooltipContent };

'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import type { MonthGroup } from './messages-schedule-tab.utils';
import { SessionCard } from './messages-session-card';

interface MonthSectionProps {
  group: MonthGroup;
  isCurrentMonth: boolean;
  defaultOpen?: boolean;
  joinableSessionId?: string | null;
}

export function shouldMonthSectionStartOpen(
  defaultOpen: boolean | undefined,
  isCurrentMonth: boolean,
): boolean {
  return Boolean(defaultOpen || isCurrentMonth);
}

export function getMonthSectionStats(group: MonthGroup): {
  progressPercent: number;
  allComplete: boolean;
} {
  const progressPercent =
    group.totalCount > 0 ? Math.round((group.completedCount / group.totalCount) * 100) : 0;
  const allComplete = group.completedCount === group.totalCount && group.totalCount > 0;
  return { progressPercent, allComplete };
}

export function MonthSection({
  group,
  isCurrentMonth,
  defaultOpen = false,
  joinableSessionId = null,
}: MonthSectionProps) {
  const [isOpen, setIsOpen] = useState(
    shouldMonthSectionStartOpen(defaultOpen, isCurrentMonth),
  );
  const { progressPercent, allComplete } = getMonthSectionStats(group);

  return (
    <section className="space-y-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-all',
          'hover:bg-secondary/80',
          isCurrentMonth && 'bg-primary/5',
        )}
      >
        <div className="flex flex-1 items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">
                {group.month} {group.year}
              </h2>
              {isCurrentMonth ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Current
                </span>
              ) : null}
              {allComplete ? <CheckCircle2 className="size-4 text-primary" /> : null}
            </div>
            <span className="text-xs text-muted-foreground">
              {group.totalCount} {group.totalCount === 1 ? 'session' : 'sessions'}
              {group.completedCount > 0 ? ` · ${group.completedCount} completed` : ''}
            </span>
          </div>
        </div>

        <div className="hidden w-32 items-center gap-2 sm:flex">
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
          </div>
          <span className="tabular-nums text-[10px] font-medium text-muted-foreground">
            {progressPercent}%
          </span>
        </div>

        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen ? (
        <div className="space-y-2 px-1 pt-2">
          {group.sessions.map((session, index) => (
            <SessionCard
              key={session.id}
              session={session}
              index={index}
              canJoin={session.id === joinableSessionId}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

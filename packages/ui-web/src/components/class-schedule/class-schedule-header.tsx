'use client';

import { Button } from '@iconicedu/ui-web/ui/button';
import { ButtonGroup } from '@iconicedu/ui-web/ui/button-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-web/ui/tooltip';
import {
  CalendarCog,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Columns4,
  Columns,
} from 'lucide-react';
import type { ClassScheduleViewVM } from '@iconicedu/shared-types';

interface ClassScheduleHeaderProps {
  currentDate: Date;
  view: ClassScheduleViewVM;
  onViewChange: (view: ClassScheduleViewVM) => void;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
  editFullScheduleHref?: string | null;
}

export function ClassScheduleHeader({
  currentDate,
  view,
  onViewChange,
  onNavigate,
  editFullScheduleHref,
}: ClassScheduleHeaderProps) {
  const monthYear = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const dateRange = (() => {
    if (view === 'week') {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
      });
    }
  })();

  return (
    <div className="flex items-center justify-between border-b bg-background p-4">
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center justify-center rounded-xl border bg-muted px-2.5 py-1.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase leading-tight">
            {currentDate.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-base font-semibold leading-tight">
            {currentDate.getDate()}
          </span>
        </div>

        <div>
          <h1 className="text-base font-semibold">{monthYear}</h1>
          <p className="text-xs text-muted-foreground">{dateRange}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ButtonGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous period"
                onClick={() => onNavigate('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous period</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Today"
                onClick={() => onNavigate('today')}
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Today</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next period"
                onClick={() => onNavigate('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next period</TooltipContent>
          </Tooltip>
        </ButtonGroup>

        {editFullScheduleHref ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="outline"
                size="icon"
                aria-label="Edit full schedule"
              >
                <a href={editFullScheduleHref}>
                  <CalendarCog className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit full schedule</TooltipContent>
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={view === 'week' ? 'Switch to day view' : 'Switch to week view'}
              onClick={() => onViewChange(view === 'week' ? 'day' : 'week')}
            >
              {view === 'week' ? (
                <Columns className="h-4 w-4" />
              ) : (
                <Columns4 className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {view === 'week' ? 'Switch to day view' : 'Switch to week view'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

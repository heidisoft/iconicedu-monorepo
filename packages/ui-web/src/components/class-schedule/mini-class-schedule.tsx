'use client';

import { Button } from '@iconicedu/ui-web/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getDaysInMonth,
  getEventDate,
  isSameDay,
} from '@iconicedu/ui-web/lib/class-schedule-utils';
import { cn } from '@iconicedu/ui-web/lib/utils';
import type { ClassScheduleVM } from '@iconicedu/shared-types';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@iconicedu/ui-web/ui/card';

interface MiniClassScheduleProps {
  currentDate: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  events?: ClassScheduleVM[];
  onMonthChange?: (date: Date) => void;
}

export function MiniClassSchedule({
  currentDate,
  selectedDate,
  onDateSelect,
  events = [],
  onMonthChange,
}: MiniClassScheduleProps) {
  const [displayMonth, setDisplayMonth] = useState(currentDate.getMonth());
  const [displayYear, setDisplayYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    setDisplayMonth(currentDate.getMonth());
    setDisplayYear(currentDate.getFullYear());
    onMonthChange?.(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  }, [currentDate, onMonthChange]);

  const days = getDaysInMonth(displayYear, displayMonth);
  const monthName = new Date(displayYear, displayMonth).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const today = new Date();

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
      onMonthChange?.(new Date(displayYear - 1, 11, 1));
    } else {
      setDisplayMonth(displayMonth - 1);
      onMonthChange?.(new Date(displayYear, displayMonth - 1, 1));
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
      onMonthChange?.(new Date(displayYear + 1, 0, 1));
    } else {
      setDisplayMonth(displayMonth + 1);
      onMonthChange?.(new Date(displayYear, displayMonth + 1, 1));
    }
  };

  const dayHasEvents = (day: Date) => {
    return events.some((event) => isSameDay(getEventDate(event), day));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <h3 className="font-semibold text-sm">{monthName}</h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrevMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((day) => (
            <div key={day} className="text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {days.map((day, index) => {
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = day.getMonth() === displayMonth;
            const isPast =
              day < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const hasEvent = dayHasEvents(day) && isCurrentMonth;

            return (
              <Button
                key={index}
                variant="ghost"
                size="icon"
                onClick={() => onDateSelect(day)}
                disabled={isPast}
                className={cn(
                  'relative h-8 w-8 p-0 font-normal',
                  !isCurrentMonth && 'text-muted-foreground/50 opacity-50',
                  isPast && 'text-muted-foreground/40 opacity-50 pointer-events-none',
                  isToday && 'font-semibold border border-primary/40',
                  isSelected && 'bg-primary/15 text-primary',
                )}
              >
                {day.getDate()}
                {hasEvent && !isToday && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                )}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

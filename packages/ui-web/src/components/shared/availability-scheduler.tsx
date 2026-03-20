'use client';

import * as React from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import {
  DAY_KEYS,
  DayAvailability,
  DayKey,
  EMPTY_DAY_AVAILABILITY,
} from '@iconicedu/shared-types';

const MORNING_HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AFTERNOON_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

const DAY_OPTIONS = DAY_KEYS.map((key) => ({ key, label: key }));

type AvailabilitySchedulerProps = {
  value?: DayAvailability;
  onChange?: (value: DayAvailability) => void;
};

export function AvailabilityScheduler({ value, onChange }: AvailabilitySchedulerProps) {
  const [selectedDay, setSelectedDay] = React.useState<DayKey>('Mon');
  const [availability, setAvailability] = React.useState<DayAvailability>(
    value ?? EMPTY_DAY_AVAILABILITY,
  );

  React.useEffect(() => {
    setAvailability(value ?? EMPTY_DAY_AVAILABILITY);
  }, [value]);

  const updateAvailability = React.useCallback(
    (next: DayAvailability) => {
      setAvailability(next);
      onChange?.(next);
    },
    [onChange],
  );

  const toggleHour = React.useCallback(
    (hour: number) => {
      const dayHours = availability[selectedDay] ?? [];
      const nextHours = dayHours.includes(hour)
        ? dayHours.filter((item) => item !== hour)
        : [...dayHours, hour].sort((a, b) => a - b);
      updateAvailability({
        ...availability,
        [selectedDay]: nextHours,
      });
    },
    [availability, selectedDay, updateAvailability],
  );

  const isHourSelected = React.useCallback(
    (hour: number) => availability[selectedDay]?.includes(hour) ?? false,
    [availability, selectedDay],
  );

  const getDayIndicator = React.useCallback(
    (day: DayKey) => {
      const hours = availability[day] ?? [];
      const morningCount = hours.filter((hour) => hour < 12).length;
      const afternoonCount = hours.filter((hour) => hour >= 12).length;
      return { morning: morningCount, afternoon: afternoonCount };
    },
    [availability],
  );

  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

  return (
    <div className="space-y-6 border border-border/50 rounded-lg p-4">
      <div className="flex justify-between gap-1 sm:gap-2">
        {DAY_OPTIONS.map(({ key, label }) => {
          const indicator = getDayIndicator(key);
          const isSelected = selectedDay === key;
          const hasAvailability = indicator.morning > 0 || indicator.afternoon > 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDay(key)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg transition-colors',
                isSelected ? 'bg-muted' : 'hover:bg-muted/50',
              )}
            >
              <span
                className={cn(
                  'text-xs sm:text-sm font-medium',
                  isSelected ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
              <div className="flex gap-0.5 h-4 items-end">
                <div
                  className={cn(
                    'w-1.5 sm:w-2 rounded-sm transition-all',
                    hasAvailability ? 'bg-primary/60' : 'bg-muted-foreground/20',
                  )}
                  style={{
                    height:
                      indicator.morning > 0
                        ? `${Math.min(4 + indicator.morning * 1.5, 16)}px`
                        : '4px',
                  }}
                />

                <div
                  className={cn(
                    'w-1.5 sm:w-2 rounded-sm transition-all',
                    hasAvailability ? 'bg-primary/40' : 'bg-muted-foreground/20',
                  )}
                  style={{
                    height:
                      indicator.afternoon > 0
                        ? `${Math.min(4 + indicator.afternoon * 1.5, 16)}px`
                        : '4px',
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Sun className="size-4" />
          <span className="text-sm font-medium">Morning</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {MORNING_HOURS.map((hour) => {
            const selected = isHourSelected(hour);
            return (
              <Button
                key={`morning-${hour}`}
                size="sm"
                variant={selected ? 'default' : 'ghost'}
                className={cn(
                  'h-9 text-sm font-normal rounded-full transition-all',
                  selected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                onClick={() => toggleHour(hour)}
              >
                {formatHour(hour)}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Moon className="size-4" />
          <span className="text-sm font-medium">Afternoon/Evening</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {AFTERNOON_HOURS.map((hour) => {
            const selected = isHourSelected(hour);
            return (
              <Button
                key={`afternoon-${hour}`}
                size="sm"
                variant={selected ? 'default' : 'ghost'}
                className={cn(
                  'h-9 text-sm font-normal rounded-full transition-all',
                  selected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                onClick={() => toggleHour(hour)}
              >
                {formatHour(hour)}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

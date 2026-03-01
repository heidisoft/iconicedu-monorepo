'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, Plus, Trash2, Pencil, X, Check } from 'lucide-react';

import { cn } from '@iconicedu/ui-web/lib/utils';
import {
  RecurrenceFormData,
  RecurrenceFrequencyVM,
  WeekdayVM,
  WeekdayTime,
  RecurrenceException,
  RecurrenceOverride,
  WEEKDAYS,
  FREQUENCIES,
  COMMON_TIMEZONES,
} from '@iconicedu/ui-web/lib/recurrence-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Calendar } from '@iconicedu/ui-web/ui/calendar';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@iconicedu/ui-web/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@iconicedu/ui-web/ui/toggle-group';
import { RadioGroup, RadioGroupItem } from '@iconicedu/ui-web/ui/radio-group';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@iconicedu/ui-web/ui/accordion';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Separator } from '@iconicedu/ui-web/ui/separator';

import {
  getUpcomingRecurrenceDates,
  upsertPendingException,
  upsertPendingOverride,
} from './recurrence-form.utils';

interface RecurrenceFormProps {
  defaultValues?: Partial<RecurrenceFormData>;
  onSubmit?: (data: RecurrenceFormData) => void;
  onCancel?: () => void;
  className?: string;
  isEditing?: boolean;
}

type EndType = 'never' | 'count' | 'until';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

const DEFAULT_WEEKDAY_TIME = '09:00';

function buildWeekdayTimes(values?: WeekdayTime[]) {
  const base = WEEKDAYS.map((day) => ({ day: day.value, time: DEFAULT_WEEKDAY_TIME }));
  if (!values?.length) return base;
  const overrides = new Map(values.map((item) => [item.day, item.time]));
  return base.map((entry) => ({
    day: entry.day,
    time: overrides.get(entry.day) ?? entry.time,
  }));
}

export function RecurrenceForm({
  defaultValues,
  onSubmit,
  onCancel,
  className,
  isEditing = false,
}: RecurrenceFormProps) {
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [startDate, setStartDate] = React.useState<Date | undefined>(
    defaultValues?.startDate ?? new Date(),
  );
  const [timezone, setTimezone] = React.useState<string>(
    defaultValues?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [frequency, setFrequency] = React.useState<RecurrenceFrequencyVM>(
    defaultValues?.rule?.frequency || 'weekly',
  );
  const [interval, setInterval] = React.useState<number>(
    defaultValues?.rule?.interval || 1,
  );
  const [byWeekday, setByWeekday] = React.useState<WeekdayVM[]>(
    defaultValues?.rule?.byWeekday || [],
  );
  const [weekdayTimes, setWeekdayTimes] = React.useState<WeekdayTime[]>(
    buildWeekdayTimes(defaultValues?.rule?.weekdayTimes),
  );
  const [endType, setEndType] = React.useState<EndType>(() => {
    if (defaultValues?.rule?.count) return 'count';
    if (defaultValues?.rule?.until) return 'until';
    return 'never';
  });
  const [count, setCount] = React.useState<number>(defaultValues?.rule?.count || 10);
  const [untilDate, setUntilDate] = React.useState<Date | undefined>(
    defaultValues?.rule?.until ? new Date(defaultValues.rule.until) : undefined,
  );

  const [exceptions, setExceptions] = React.useState<RecurrenceException[]>(
    defaultValues?.exceptions || [],
  );
  const [overrides, setOverrides] = React.useState<RecurrenceOverride[]>(
    defaultValues?.overrides || [],
  );

  const [newExceptionDate, setNewExceptionDate] = React.useState<Date | undefined>();
  const [newExceptionReason, setNewExceptionReason] = React.useState('');
  const [editingExceptionId, setEditingExceptionId] = React.useState<string | null>(null);

  const [newOverrideOriginalDate, setNewOverrideOriginalDate] = React.useState<
    Date | undefined
  >();
  const [newOverrideNewDate, setNewOverrideNewDate] = React.useState<Date | undefined>();
  const [newOverrideTime, setNewOverrideTime] = React.useState('');
  const [newOverrideReason, setNewOverrideReason] = React.useState('');
  const [editingOverrideId, setEditingOverrideId] = React.useState<string | null>(null);

  const startDateInvalid = isSubmitted && !startDate;
  const timezoneInvalid = isSubmitted && !timezone;
  const weekdayInvalid = isSubmitted && frequency === 'weekly' && byWeekday.length === 0;

  const updateWeekdayTime = (day: WeekdayVM, time: string) => {
    setWeekdayTimes((prev) => {
      if (prev.some((wt) => wt.day === day)) {
        return prev.map((wt) => (wt.day === day ? { ...wt, time } : wt));
      }
      return [...prev, { day, time }];
    });
  };

  const addException = () => {
    if (!newExceptionDate) return;
    if (!availableExceptionDateSet.has(format(newExceptionDate, 'yyyy-MM-dd'))) return;

    if (editingExceptionId) {
      setExceptions((prev) =>
        prev.map((exception) =>
          exception.id === editingExceptionId
            ? {
                ...exception,
                date: format(newExceptionDate, 'yyyy-MM-dd'),
                reason: newExceptionReason || undefined,
              }
            : exception,
        ),
      );
      setEditingExceptionId(null);
    } else {
      const newException: RecurrenceException = {
        id: generateId(),
        date: format(newExceptionDate, 'yyyy-MM-dd'),
        reason: newExceptionReason || undefined,
      };
      setExceptions((prev) => [...prev, newException]);
    }
    setNewExceptionDate(undefined);
    setNewExceptionReason('');
  };

  const editException = (exception: RecurrenceException) => {
    setEditingExceptionId(exception.id);
    setNewExceptionDate(parseISO(exception.date));
    setNewExceptionReason(exception.reason || '');
  };

  const cancelEditException = () => {
    setEditingExceptionId(null);
    setNewExceptionDate(undefined);
    setNewExceptionReason('');
  };

  const removeException = (id: string) => {
    setExceptions((prev) => prev.filter((exception) => exception.id !== id));
  };

  const addOverride = () => {
    if (!newOverrideOriginalDate || !newOverrideNewDate) return;

    if (editingOverrideId) {
      setOverrides((prev) =>
        prev.map((override) =>
          override.id === editingOverrideId
            ? {
                ...override,
                originalDate: format(newOverrideOriginalDate, 'yyyy-MM-dd'),
                newDate: format(newOverrideNewDate, 'yyyy-MM-dd'),
                newTime: newOverrideTime || undefined,
                reason: newOverrideReason || undefined,
              }
            : override,
        ),
      );
      setEditingOverrideId(null);
    } else {
      const newOverride: RecurrenceOverride = {
        id: generateId(),
        originalDate: format(newOverrideOriginalDate, 'yyyy-MM-dd'),
        newDate: format(newOverrideNewDate, 'yyyy-MM-dd'),
        newTime: newOverrideTime || undefined,
        reason: newOverrideReason || undefined,
      };
      setOverrides((prev) => [...prev, newOverride]);
    }
    setNewOverrideOriginalDate(undefined);
    setNewOverrideNewDate(undefined);
    setNewOverrideTime('');
    setNewOverrideReason('');
  };

  const editOverride = (override: RecurrenceOverride) => {
    setEditingOverrideId(override.id);
    setNewOverrideOriginalDate(parseISO(override.originalDate));
    setNewOverrideNewDate(parseISO(override.newDate));
    setNewOverrideTime(override.newTime || '');
    setNewOverrideReason(override.reason || '');
  };

  const cancelEditOverride = () => {
    setEditingOverrideId(null);
    setNewOverrideOriginalDate(undefined);
    setNewOverrideNewDate(undefined);
    setNewOverrideTime('');
    setNewOverrideReason('');
  };

  const removeOverride = (id: string) => {
    setOverrides((prev) => prev.filter((override) => override.id !== id));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsSubmitted(true);
    if (!startDate || !timezone || (frequency === 'weekly' && byWeekday.length === 0)) {
      return;
    }

    const selectedWeekdayTimes =
      frequency === 'weekly' && byWeekday.length > 0
        ? byWeekday.map((day) => ({
            day,
            time:
              weekdayTimes.find((weekdayTime) => weekdayTime.day === day)?.time ||
              DEFAULT_WEEKDAY_TIME,
          }))
        : undefined;

    const submittedExceptions = upsertPendingException({
      exceptions,
      editingExceptionId,
      pendingDate: newExceptionDate,
      pendingReason: newExceptionReason,
      allowedDates: availableExceptionDateSet,
    });
    const submittedOverrides = upsertPendingOverride({
      overrides,
      editingOverrideId,
      pendingOriginalDate: newOverrideOriginalDate,
      pendingNewDate: newOverrideNewDate,
      pendingNewTime: newOverrideTime,
      pendingReason: newOverrideReason,
      allowedOriginalDates: availableOverrideOriginalDateSet,
    });

    const data: RecurrenceFormData = {
      id: defaultValues?.id || generateId(),
      startDate,
      timezone,
      rule: {
        frequency,
        interval: interval > 1 ? interval : undefined,
        byWeekday: frequency === 'weekly' && byWeekday.length > 0 ? byWeekday : undefined,
        weekdayTimes: selectedWeekdayTimes,
        count: endType === 'count' ? count : undefined,
        until: endType === 'until' && untilDate ? untilDate.toISOString() : undefined,
        timezone,
      },
      exceptions: submittedExceptions,
      overrides: submittedOverrides,
    };

    onSubmit?.(data);
  };

  const getIntervalLabel = () => {
    switch (frequency) {
      case 'daily':
        return interval === 1 ? 'day' : 'days';
      case 'weekly':
        return interval === 1 ? 'week' : 'weeks';
      case 'monthly':
        return interval === 1 ? 'month' : 'months';
      case 'yearly':
        return interval === 1 ? 'year' : 'years';
    }
  };

  const selectedWeekdays = WEEKDAYS.filter((day) => byWeekday.includes(day.value));
  const editingException = React.useMemo(
    () => exceptions.find((exception) => exception.id === editingExceptionId),
    [editingExceptionId, exceptions],
  );
  const availableExceptionDates = React.useMemo(() => {
    const upcomingDates = getUpcomingRecurrenceDates({
      startDate,
      frequency,
      interval,
      byWeekday,
      count: endType === 'count' ? count : undefined,
      until: endType === 'until' && untilDate ? untilDate.toISOString() : undefined,
      includeDates: editingException ? [editingException.date] : [],
    });
    const excludedDates = new Set(
      exceptions
        .filter((exception) => exception.id !== editingExceptionId)
        .map((exception) => exception.date),
    );

    return upcomingDates.filter((date) => !excludedDates.has(date));
  }, [
    byWeekday,
    count,
    editingException,
    editingExceptionId,
    endType,
    exceptions,
    frequency,
    interval,
    startDate,
    untilDate,
  ]);
  const availableExceptionDateSet = React.useMemo(
    () => new Set(availableExceptionDates),
    [availableExceptionDates],
  );
  const hasSelectableExceptionDates = availableExceptionDates.length > 0;
  const selectedExceptionDateKey = newExceptionDate ? format(newExceptionDate, 'yyyy-MM-dd') : '';
  const isSelectedExceptionDateAllowed = selectedExceptionDateKey
    ? availableExceptionDateSet.has(selectedExceptionDateKey)
    : false;
  const editingOverride = React.useMemo(
    () => overrides.find((override) => override.id === editingOverrideId),
    [editingOverrideId, overrides],
  );
  const availableOverrideOriginalDates = React.useMemo(() => {
    const upcomingDates = getUpcomingRecurrenceDates({
      startDate,
      frequency,
      interval,
      byWeekday,
      count: endType === 'count' ? count : undefined,
      until: endType === 'until' && untilDate ? untilDate.toISOString() : undefined,
      includeDates: editingOverride ? [editingOverride.originalDate] : [],
    });
    const excludedExceptionDates = new Set(exceptions.map((exception) => exception.date));
    const excludedOverrideDates = new Set(
      overrides
        .filter((override) => override.id !== editingOverrideId)
        .map((override) => override.originalDate),
    );

    return upcomingDates.filter(
      (date) => !excludedExceptionDates.has(date) && !excludedOverrideDates.has(date),
    );
  }, [
    byWeekday,
    count,
    editingOverride,
    editingOverrideId,
    endType,
    exceptions,
    frequency,
    interval,
    overrides,
    startDate,
    untilDate,
  ]);
  const availableOverrideOriginalDateSet = React.useMemo(
    () => new Set(availableOverrideOriginalDates),
    [availableOverrideOriginalDates],
  );
  const hasSelectableOverrideOriginalDates = availableOverrideOriginalDates.length > 0;
  const selectedOverrideOriginalDateKey = newOverrideOriginalDate
    ? format(newOverrideOriginalDate, 'yyyy-MM-dd')
    : '';
  const isSelectedOverrideOriginalDateAllowed = selectedOverrideOriginalDateKey
    ? availableOverrideOriginalDateSet.has(selectedOverrideOriginalDateKey)
    : false;

  return (
    <ScrollArea className={cn('max-h-[70vh]', className)}>
      <form onSubmit={handleSubmit} className="space-y-6 px-1">
        <div className="space-y-2">
          <Label htmlFor="start-date">
            Start Date <span className="text-destructive">*</span>
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="start-date"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'PPP') : 'Select a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
            </PopoverContent>
          </Popover>
          {startDateInvalid && (
            <p className="text-xs text-destructive">Start date is required.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">
            Timezone <span className="text-destructive">*</span>
          </Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {timezoneInvalid && (
            <p className="text-xs text-destructive">Timezone is required.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="frequency">Repeat</Label>
          <Select
            value={frequency}
            onValueChange={(value) => setFrequency(value as RecurrenceFrequencyVM)}
          >
            <SelectTrigger id="frequency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((frequencyOption) => (
                <SelectItem key={frequencyOption.value} value={frequencyOption.value}>
                  {frequencyOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="interval">Every</Label>
          <div className="flex items-center gap-2">
            <Input
              id="interval"
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(event) =>
                setInterval(Math.max(1, Number.parseInt(event.target.value) || 1))
              }
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">{getIntervalLabel()}</span>
          </div>
        </div>

        {frequency === 'weekly' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                On days <span className="text-destructive">*</span>
              </Label>
              <ToggleGroup
                type="multiple"
                value={byWeekday}
                onValueChange={(value) => setByWeekday(value as WeekdayVM[])}
                className="gap-1"
              >
                {WEEKDAYS.map((day) => (
                  <ToggleGroupItem
                    key={day.value}
                    value={day.value}
                    aria-label={day.label}
                    className="rounded-full"
                  >
                    {day.short}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {weekdayInvalid && (
                <p className="text-xs text-destructive">Select at least one day.</p>
              )}
            </div>

            {byWeekday.length > 0 && (
              <div className="space-y-3">
                <Label>Time for each day</Label>
                <div className="space-y-2">
                  {selectedWeekdays.map((day) => {
                    const dayTime = weekdayTimes.find((wt) => wt.day === day.value);
                    return (
                      <div key={day.value} className="flex items-center gap-3">
                        <span className="w-24 text-sm font-medium text-foreground">
                          {day.label}
                        </span>
                        <Input
                          type="time"
                          value={dayTime?.time || DEFAULT_WEEKDAY_TIME}
                          onChange={(event) =>
                            updateWeekdayTime(day.value, event.target.value)
                          }
                          className="w-32"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <Label>Ends</Label>
          <RadioGroup
            value={endType}
            onValueChange={(value) => setEndType(value as EndType)}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="never" id="end-never" />
              <Label htmlFor="end-never" className="cursor-pointer font-normal">
                Never
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="count" id="end-count" />
              <Label htmlFor="end-count" className="cursor-pointer font-normal">
                After
              </Label>
              <Input
                type="number"
                min={1}
                max={999}
                value={count}
                onChange={(event) =>
                  setCount(Math.max(1, Number.parseInt(event.target.value) || 1))
                }
                className="w-20"
                disabled={endType !== 'count'}
              />
              <span className="text-sm text-muted-foreground">occurrences</span>
            </div>

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="until" id="end-until" />
              <Label htmlFor="end-until" className="cursor-pointer font-normal">
                On
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={endType !== 'until'}
                    className={cn(
                      'justify-start text-left font-normal',
                      !untilDate && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {untilDate ? format(untilDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={untilDate}
                    onSelect={setUntilDate}
                    disabled={(date) => (startDate ? date < startDate : false)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        <Accordion type="multiple" className="w-full">
          <AccordionItem value="exceptions">
            <AccordionTrigger className="text-sm">
              Exceptions
              {exceptions.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {exceptions.length}
                </Badge>
              )}
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Skip specific dates from the recurrence schedule.
              </p>

              {exceptions.length > 0 && (
                <div className="space-y-2">
                  {exceptions.map((exception) => (
                    <div
                      key={exception.id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">
                          {format(parseISO(exception.date), 'PPP')}
                        </p>
                        {exception.reason && (
                          <p className="text-xs text-muted-foreground">
                            {exception.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => editException(exception)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeException(exception.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">
                    {editingExceptionId ? 'Edit Exception' : 'Add New Exception'}
                  </Label>
                  {editingExceptionId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={cancelEditException}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          'flex-1 justify-start text-left font-normal',
                          !newExceptionDate && 'text-muted-foreground',
                        )}
                        disabled={!hasSelectableExceptionDates}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newExceptionDate
                          ? format(newExceptionDate, 'PPP')
                          : hasSelectableExceptionDates
                            ? 'Select date'
                            : 'No future recurrence dates'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newExceptionDate}
                        onSelect={setNewExceptionDate}
                        disabled={(date) =>
                          !availableExceptionDateSet.has(format(date, 'yyyy-MM-dd'))
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    placeholder="Reason (optional)"
                    value={newExceptionReason}
                    onChange={(event) => setNewExceptionReason(event.target.value)}
                    className="flex-1"
                  />
                </div>
                {hasSelectableExceptionDates && (
                  <p className="text-xs text-muted-foreground">
                    Available future dates:{' '}
                    {availableExceptionDates
                      .slice(0, 6)
                      .map((date) => format(parseISO(date), 'MMM d'))
                      .join(', ')}
                    {availableExceptionDates.length > 6 ? '...' : ''}
                  </p>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={addException}
                  disabled={!newExceptionDate || !isSelectedExceptionDateAllowed}
                >
                  {editingExceptionId ? (
                    <>
                      <Check className="mr-1 h-4 w-4" /> Save
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 h-4 w-4" /> Add Exception
                    </>
                  )}
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="overrides">
            <AccordionTrigger className="text-sm">
              Overrides
              {overrides.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {overrides.length}
                </Badge>
              )}
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Reschedule specific occurrences to a different date/time.
              </p>

              {overrides.length > 0 && (
                <div className="space-y-2">
                  {overrides.map((override) => (
                    <div
                      key={override.id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm text-foreground">
                          <span className="line-through text-muted-foreground">
                            {format(parseISO(override.originalDate), 'PPP')}
                          </span>
                          <span className="mx-2">→</span>
                          <span className="font-medium">
                            {format(parseISO(override.newDate), 'PPP')}
                            {override.newTime && ` at ${override.newTime}`}
                          </span>
                        </p>
                        {override.reason && (
                          <p className="text-xs text-muted-foreground">
                            {override.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => editOverride(override)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeOverride(override.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">
                    {editingOverrideId ? 'Edit Override' : 'Add New Override'}
                  </Label>
                  {editingOverrideId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={cancelEditOverride}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Original date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !newOverrideOriginalDate && 'text-muted-foreground',
                        )}
                        disabled={!hasSelectableOverrideOriginalDates}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newOverrideOriginalDate
                          ? format(newOverrideOriginalDate, 'PP')
                          : hasSelectableOverrideOriginalDates
                            ? 'Select'
                            : 'No future recurrence dates'}
                      </Button>
                    </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newOverrideOriginalDate}
                          onSelect={setNewOverrideOriginalDate}
                          disabled={(date) =>
                            !availableOverrideOriginalDateSet.has(
                              format(date, 'yyyy-MM-dd'),
                            )
                          }
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">New date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !newOverrideNewDate && 'text-muted-foreground',
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newOverrideNewDate
                            ? format(newOverrideNewDate, 'PP')
                            : 'Select'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newOverrideNewDate}
                          onSelect={setNewOverrideNewDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                {hasSelectableOverrideOriginalDates && (
                  <p className="text-xs text-muted-foreground">
                    Available original dates:{' '}
                    {availableOverrideOriginalDates
                      .slice(0, 6)
                      .map((date) => format(parseISO(date), 'MMM d'))
                      .join(', ')}
                    {availableOverrideOriginalDates.length > 6 ? '...' : ''}
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    type="time"
                    placeholder="New time"
                    value={newOverrideTime}
                    onChange={(event) => setNewOverrideTime(event.target.value)}
                  />
                  <Input
                    placeholder="Reason (optional)"
                    value={newOverrideReason}
                    onChange={(event) => setNewOverrideReason(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={addOverride}
                  disabled={
                    !newOverrideOriginalDate ||
                    !newOverrideNewDate ||
                    !isSelectedOverrideOriginalDateAllowed
                  }
                >
                  {editingOverrideId ? (
                    <>
                      <Check className="mr-1 h-4 w-4" /> Save
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 h-4 w-4" /> Add Override
                    </>
                  )}
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex gap-2">
          {isEditing && onCancel && (
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" className="flex-1">
            {isEditing ? 'Update Schedule' : 'Save Schedule'}
          </Button>
        </div>
      </form>
    </ScrollArea>
  );
}

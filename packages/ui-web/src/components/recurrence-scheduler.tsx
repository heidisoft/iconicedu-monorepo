'use client';

import * as React from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Pencil, Trash2, CalendarDays, MapPin, RefreshCw } from 'lucide-react';

import { RecurrenceForm } from '@iconicedu/ui-web/components/recurrence-form';
import {
  RecurrenceFormData,
  WEEKDAYS,
  FREQUENCIES,
} from '@iconicedu/ui-web/lib/recurrence-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@iconicedu/ui-web/ui/card';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@iconicedu/ui-web/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@iconicedu/ui-web/ui/alert-dialog';

interface RecurrenceSchedulerProps {
  schedules?: RecurrenceFormData[];
  onSchedulesChange?: (schedules: RecurrenceFormData[]) => void;
  className?: string;
}

export function RecurrenceScheduler({
  schedules: controlledSchedules,
  onSchedulesChange,
  className,
}: RecurrenceSchedulerProps) {
  const [internalSchedules, setInternalSchedules] = React.useState<RecurrenceFormData[]>(
    [],
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingSchedule, setEditingSchedule] = React.useState<RecurrenceFormData | null>(
    null,
  );

  const isControlled = controlledSchedules !== undefined;
  const schedules = isControlled ? controlledSchedules : internalSchedules;

  const setSchedules = React.useCallback(
    (
      updater:
        | RecurrenceFormData[]
        | ((prev: RecurrenceFormData[]) => RecurrenceFormData[]),
    ) => {
      const newSchedules = typeof updater === 'function' ? updater(schedules) : updater;
      if (isControlled) {
        onSchedulesChange?.(newSchedules);
      } else {
        setInternalSchedules(newSchedules);
      }
    },
    [isControlled, onSchedulesChange, schedules],
  );

  const handleSubmit = (data: RecurrenceFormData) => {
    if (editingSchedule) {
      setSchedules((prev) => prev.map((s) => (s.id === editingSchedule.id ? data : s)));
    } else {
      setSchedules((prev) => [...prev, data]);
    }
    handleCloseDialog();
  };

  const handleEdit = (schedule: RecurrenceFormData) => {
    setEditingSchedule(schedule);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSchedule(null);
  };

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setDialogOpen(true);
  };

  const getFrequencyLabel = (freq: string) =>
    FREQUENCIES.find((f) => f.value === freq)?.label || freq;

  return (
    <div className={className}>
      <div className="mb-4 flex justify-end">
        <Button onClick={handleOpenCreate} type="button" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add schedule
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Edit Schedule' : 'Create Schedule'}
            </DialogTitle>
            <DialogDescription>
              {editingSchedule
                ? 'Modify your recurring schedule settings, exceptions, and overrides.'
                : 'Configure your recurring schedule with custom times, exceptions, and overrides.'}
            </DialogDescription>
          </DialogHeader>
          <RecurrenceForm
            key={editingSchedule?.id || 'new'}
            defaultValues={editingSchedule || undefined}
            onSubmit={handleSubmit}
            onCancel={handleCloseDialog}
            isEditing={Boolean(editingSchedule)}
          />
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {schedules.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
              <h4 className="mt-4 text-lg font-medium text-foreground">
                No schedules yet
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first recurring schedule to get started.
              </p>
            </CardContent>
          </Card>
        )}

        {schedules.length > 0 && (
          <div className="space-y-4">
            {schedules.map((schedule, index) => (
              <ScheduleCard
                key={schedule.id ?? `schedule-${index}`}
                schedule={schedule}
                onEdit={() => handleEdit(schedule)}
                onDelete={() => handleDelete(schedule.id ?? '')}
                getFrequencyLabel={getFrequencyLabel}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ScheduleCardProps {
  schedule: RecurrenceFormData;
  onEdit: () => void;
  onDelete: () => void;
  getFrequencyLabel: (freq: string) => string;
}

export function formatInlineScheduleTime(
  startDate: Date,
  startTime: string,
  endTime: string,
) {
  return `${format(startDate, 'EEE')} ${startTime} - ${endTime}`;
}

export function formatDaysSummary(byWeekday: string[]) {
  return byWeekday
    .map((day) => WEEKDAYS.find((weekday) => weekday.value === day)?.short)
    .filter(Boolean)
    .join(', ');
}

export function formatWeeklyRecurrenceSummary(byWeekday: string[]) {
  const labels = byWeekday
    .map((day) => WEEKDAYS.find((weekday) => weekday.value === day)?.label)
    .filter(Boolean);

  if (!labels.length) return 'Weekly';
  return `Weekly · Every ${labels.join(', ')}`;
}

export function formatTimeWithMeridiem(value: string) {
  const [rawHour, rawMinute] = value.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const period = hour >= 12 ? 'PM' : 'AM';
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:${String(minute).padStart(2, '0')} ${period}`;
}

export function formatTimeRangeWithMeridiem(startTime: string, endTime: string) {
  return `${formatTimeWithMeridiem(startTime)} - ${formatTimeWithMeridiem(endTime)}`;
}

export function formatScheduleSummaryWithTime(
  schedule: Pick<RecurrenceFormData, 'startDate' | 'startTime' | 'endTime' | 'rule'>,
) {
  const timeRange = formatTimeRangeWithMeridiem(schedule.startTime, schedule.endTime);
  if (!schedule.rule) {
    return `No repeat · ${timeRange}`;
  }

  if (schedule.rule.frequency === 'weekly') {
    return `${formatWeeklyRecurrenceSummary(schedule.rule.byWeekday ?? [])} · ${timeRange}`;
  }

  if (schedule.rule.frequency === 'daily') {
    return `Daily · Every day · ${timeRange}`;
  }

  if (schedule.rule.frequency === 'monthly') {
    return `Monthly · Every month · ${timeRange}`;
  }

  return `Yearly · Every year · ${timeRange}`;
}

export function formatWeeklyRecurrenceSummaryWithTime(
  byWeekday: string[],
  startTime: string,
  endTime: string,
) {
  return `${formatWeeklyRecurrenceSummary(byWeekday)} · ${formatTimeRangeWithMeridiem(startTime, endTime)}`;
}

function ScheduleCard({
  schedule,
  onEdit,
  onDelete,
  getFrequencyLabel,
}: ScheduleCardProps) {
  const { rule, exceptions, overrides, startDate, startTime, endTime, timezone } =
    schedule;
  const isNoRepeatSchedule = !rule;
  const scheduleTitle = isNoRepeatSchedule
    ? 'No repeat'
    : `${getFrequencyLabel(rule.frequency)} Schedule`;
  const scheduleDescription = isNoRepeatSchedule
    ? 'Single event'
    : rule.interval && rule.interval > 1
      ? `Every ${rule.interval} ${rule.frequency.replace('ly', '')}s`
      : `Every ${rule.frequency.replace('ly', '')}`;

  return (
    <Card className="gap-0">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm">{scheduleTitle}</CardTitle>
            {rule?.frequency !== 'weekly' && (
              <CardDescription className="mt-0.5 text-xs">
                {scheduleDescription}
              </CardDescription>
            )}
            {(rule?.frequency || !rule) && (
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>
                  {formatScheduleSummaryWithTime({
                    startDate,
                    startTime,
                    endTime,
                    rule,
                  })}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEdit}
              type="button"
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this schedule? This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{timezone}</span>
        </div>

        {rule?.byWeekday && rule.byWeekday.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Days: {formatDaysSummary(rule.byWeekday)}
          </p>
        )}

        {(rule?.count || rule?.until) && (
          <p className="text-xs text-muted-foreground">
            {rule?.count && `Ends after ${rule.count} occurrences`}
            {rule?.until && `Ends on ${format(parseISO(rule.until), 'PPP')}`}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {exceptions.length > 0 && (
            <Badge variant="outline" className="text-[11px]">
              {exceptions.length} exception{exceptions.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {overrides.length > 0 && (
            <Badge variant="outline" className="text-[11px]">
              {overrides.length} override{overrides.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { memo } from 'react';
import { Calendar, Clock, MapPin, Video, Users } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import type { EventReminderMessageVM as EventReminderMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { useScheduleDisplayTimeZone } from '@iconicedu/ui-web/components/shared/schedule-display-timezone-context';
import {
  formatScheduleDisplayValue,
  isSameScheduleDisplayDay,
  toScheduleDisplayDate,
} from '@iconicedu/ui-web/lib/schedule-display-timezone';

interface EventReminderMessageProps extends Omit<
  MessageBaseProps,
  'message' | 'children'
> {
  message: EventReminderMessageType;
}

export const EventReminderMessage = memo(function EventReminderMessage(
  props: EventReminderMessageProps,
) {
  const { message, ...baseProps } = props;
  const { event } = message;
  const timezone = useScheduleDisplayTimeZone();

  const formatEventTime = (start: Date, end?: Date, isAllDay?: boolean) => {
    if (isAllDay) return 'All day';

    const startStr = formatScheduleDisplayValue(start, timezone, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (!end) return startStr;

    const endStr = formatScheduleDisplayValue(end, timezone, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${startStr} - ${endStr}`;
  };

  const formatEventDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (isSameScheduleDisplayDay(date, today, timezone)) return 'Today';
    if (isSameScheduleDisplayDay(date, tomorrow, timezone)) return 'Tomorrow';

    return formatScheduleDisplayValue(date, timezone, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const startTime =
    toScheduleDisplayDate(event.startAt, timezone) ?? new Date(event.startAt);
  const endTime = event.endAt
    ? (toScheduleDisplayDate(event.endAt, timezone) ?? new Date(event.endAt))
    : undefined;

  return (
    <MessageBase message={message} {...baseProps} className="bg-primary/5">
      <div className="rounded-xl border border-primary/20 bg-card overflow-hidden max-w-sm">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span className="text-[10px] font-medium uppercase leading-none">
                  {formatScheduleDisplayValue(startTime, timezone, { month: 'short' })}
                </span>
                <span className="text-lg font-bold leading-tight">
                  {startTime.getDate()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{event.title}</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{formatEventDate(startTime)}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>{formatEventTime(startTime, endTime, event.isAllDay)}</span>
                </div>
              </div>
            </div>
          </div>

          {event.location && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <MapPin className="h-3 w-3" />
              <span>{event.location}</span>
            </div>
          )}

          {event.meetingLink && (
            <div className="flex items-center gap-2 text-xs text-primary mb-2">
              <Video className="h-3 w-3" />
              <a href={event.meetingLink} className="hover:underline truncate">
                Join video call
              </a>
            </div>
          )}

          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <Users className="h-3 w-3 text-muted-foreground" />
              <div className="flex -space-x-1.5">
                {event.attendees.slice(0, 4).map((attendee) => {
                  const attendeeName = getProfileDisplayName(attendee.profile);
                  return (
                    <AvatarWithStatus
                      key={attendee.ids.id}
                      name={attendeeName}
                      avatar={attendee.profile.avatar}
                      themeKey={attendee.ui?.themeKey}
                      showStatus={false}
                      sizeClassName="h-5 w-5 border-2 border-background"
                      fallbackClassName="text-[8px]"
                      initialsLength={1}
                    />
                  );
                })}
              </div>
              <span className="text-xs text-muted-foreground">
                {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-muted/50 border-t border-border flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 bg-transparent">
            Decline
          </Button>
          <Button size="sm" className="flex-1">
            Accept
          </Button>
        </div>
      </div>
    </MessageBase>
  );
});

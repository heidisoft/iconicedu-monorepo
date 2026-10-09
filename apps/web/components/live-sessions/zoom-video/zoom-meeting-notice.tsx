'use client';

import { CircleAlert, TriangleAlert } from 'lucide-react';

import { NotificationCard } from '@iconicedu/ui-web/ui/notification-card';
import { cn } from '@iconicedu/ui-web/lib/utils';

export type MeetingNoticeModel = {
  message: string;
  title?: string;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
  tone?: 'error' | 'warning';
};

export function ZoomMeetingNotice({
  message,
  title,
  onDismiss,
  action,
  className,
  tone = 'error',
}: MeetingNoticeModel & { className?: string }) {
  const Icon = tone === 'warning' ? TriangleAlert : CircleAlert;

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4',
        className,
      )}
    >
      <NotificationCard
        title={title}
        message={message}
        action={action}
        onDismiss={onDismiss}
        role={tone === 'error' ? 'alert' : 'status'}
        icon={
          <Icon className={tone === 'warning' ? 'text-warning' : 'text-destructive'} />
        }
      />
    </div>
  );
}

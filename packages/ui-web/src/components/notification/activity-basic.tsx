'use client';

import type React from 'react';
import { ActivityItemBase } from '@iconicedu/ui-web/components/notification/activity-item-base';
import type { ActivityFeedItemVM } from '@iconicedu/shared-types';

type ActivityBasicProps = {
  activity: ActivityFeedItemVM;
  onMarkRead: (id: string, event: React.MouseEvent) => void;
  onAutoRead?: (id: string) => void;
  isSubActivity?: boolean;
  parentExpanded?: boolean;
  showTimelineConnector?: boolean;
  className?: string;
};

export function ActivityBasic({
  activity,
  onMarkRead,
  onAutoRead,
  isSubActivity,
  parentExpanded,
  showTimelineConnector,
  className,
}: ActivityBasicProps) {
  return (
    <ActivityItemBase
      activity={activity}
      onMarkRead={onMarkRead}
      onAutoRead={onAutoRead}
      isSubActivity={isSubActivity}
      parentExpanded={parentExpanded}
      showTimelineConnector={showTimelineConnector}
      className={className}
    />
  );
}

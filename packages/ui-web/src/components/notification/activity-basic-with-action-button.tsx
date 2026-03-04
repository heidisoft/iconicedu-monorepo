'use client';

import type React from 'react';
import { ActivityItemBase } from '@iconicedu/ui-web/components/notification/activity-item-base';
import type { ActivityFeedItemVM } from '@iconicedu/shared-types';

type ActivityBasicWithActionButtonProps = {
  activity: ActivityFeedItemVM;
  onMarkRead: (id: string, event: React.MouseEvent) => void;
  onAutoRead?: (id: string) => void;
  isSubActivity?: boolean;
  parentExpanded?: boolean;
  className?: string;
};

export function ActivityBasicWithActionButton({
  activity,
  onMarkRead,
  onAutoRead,
  isSubActivity,
  parentExpanded,
  className,
}: ActivityBasicWithActionButtonProps) {
  return (
    <ActivityItemBase
      activity={activity}
      onMarkRead={onMarkRead}
      onAutoRead={onAutoRead}
      isSubActivity={isSubActivity}
      parentExpanded={parentExpanded}
      showActionButton
      className={className}
    />
  );
}

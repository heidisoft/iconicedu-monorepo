'use client';

import type React from 'react';
import { useState } from 'react';
import { ActivityItemBase } from '@iconicedu/ui-web/components/notification/activity-item-base';
import type { ActivityFeedItemVM } from '@iconicedu/shared-types';

type ActivityBasicWithExpandedContentProps = {
  activity: ActivityFeedItemVM;
  onMarkRead: (id: string, event: React.MouseEvent) => void;
  onAutoRead?: (id: string) => void;
  showActionButton?: boolean;
  isSubActivity?: boolean;
  parentExpanded?: boolean;
  showTimelineConnector?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function ActivityBasicWithExpandedContent({
  activity,
  onMarkRead,
  onAutoRead,
  showActionButton = false,
  isSubActivity,
  parentExpanded,
  showTimelineConnector,
  className,
  children,
}: ActivityBasicWithExpandedContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = (_event: React.MouseEvent) => {
    if (activity.content.expandedContent) {
      setIsExpanded((prev) => !prev);
    }
  };

  return (
    <ActivityItemBase
      activity={activity}
      onMarkRead={onMarkRead}
      onAutoRead={onAutoRead}
      onToggle={handleToggle}
      isSubActivity={isSubActivity}
      parentExpanded={parentExpanded}
      showTimelineConnector={showTimelineConnector}
      showActionButton={showActionButton}
      className={className}
      footer={
        <>
          {isExpanded && activity.content.expandedContent ? (
            <div className="animate-in slide-in-from-top-2 fade-in duration-300 rounded-md bg-muted/50 p-3 text-[12px] text-muted-foreground">
              {activity.content.expandedContent}
            </div>
          ) : null}
          {children}
        </>
      }
    />
  );
}

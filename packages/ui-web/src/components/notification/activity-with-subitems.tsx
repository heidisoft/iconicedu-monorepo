'use client';

import type React from 'react';
import { useState } from 'react';
import { cn } from '@iconicedu/ui-web/lib/utils';
import { ActivityBasicWithActionButton } from '@iconicedu/ui-web/components/notification/activity-basic-with-action-button';
import { ActivityBasicWithExpandedContent } from '@iconicedu/ui-web/components/notification/activity-basic-with-expanded-content';
import { ActivityItemBase } from '@iconicedu/ui-web/components/notification/activity-item-base';
import type {
  ActivityFeedGroupItemVM,
  ActivityFeedLeafItemVM,
} from '@iconicedu/shared-types';

type ActivityWithSubitemsProps = {
  activity: ActivityFeedGroupItemVM;
  isSubActivity?: boolean;
  parentExpanded?: boolean;
  onMarkRead: (id: string, event: React.MouseEvent) => void;
  onAutoRead?: (id: string) => void;
  showActionButton?: boolean;
  className?: string;
};

export function groupHasUnreadSubActivities(subActivities: ActivityFeedLeafItemVM[]) {
  return subActivities.some((sub: ActivityFeedLeafItemVM) => !sub.state?.isRead);
}

export function ActivityWithSubitems({
  activity,
  isSubActivity = false,
  parentExpanded = false,
  onMarkRead,
  onAutoRead,
  showActionButton = true,
  className,
}: ActivityWithSubitemsProps) {
  const subActivities = activity.subActivities?.items ?? [];
  const subActivityCount =
    activity.subActivityCount ?? activity.subActivities?.total ?? subActivities.length;
  const hasSubActivities = subActivityCount > 0;
  const hasUnreadSubActivities = groupHasUnreadSubActivities(subActivities);
  const [isCollapsed, setIsCollapsed] = useState(hasSubActivities);

  const handleToggle = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('button[data-action-button="true"]')) {
      return;
    }

    setIsCollapsed((prev) => !prev);
  };

  return (
    <div className={cn('relative', className)}>
      <ActivityItemBase
        activity={activity}
        onMarkRead={onMarkRead}
        onAutoRead={onAutoRead}
        onToggle={handleToggle}
        isSubActivity={isSubActivity}
        parentExpanded={parentExpanded}
        isCollapsed={isCollapsed}
        showSubActivityToggle={hasSubActivities}
        showActionButton={showActionButton && Boolean(activity.content.actionButton)}
        subActivityCount={subActivityCount}
        hasUnreadSubActivities={hasUnreadSubActivities}
      />

      {hasSubActivities && !isCollapsed && (
        <div className="relative ml-6 md:ml-[42px] animate-in slide-in-from-top-2 fade-in duration-300">
          {subActivities.map((sub: ActivityFeedLeafItemVM) => (
            <div key={sub.ids.id} className="relative">
              {sub.content.expandedContent ? (
                <ActivityBasicWithExpandedContent
                  activity={sub}
                  onMarkRead={onMarkRead}
                  onAutoRead={onAutoRead}
                  showActionButton={showActionButton && Boolean(sub.content.actionButton)}
                  isSubActivity
                  parentExpanded={!isCollapsed}
                />
              ) : showActionButton && sub.content.actionButton ? (
                <ActivityBasicWithActionButton
                  activity={sub}
                  onMarkRead={onMarkRead}
                  onAutoRead={onAutoRead}
                  isSubActivity
                  parentExpanded={!isCollapsed}
                />
              ) : (
                <ActivityItemBase
                  activity={sub}
                  onMarkRead={onMarkRead}
                  onAutoRead={onAutoRead}
                  isSubActivity
                  parentExpanded={!isCollapsed}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

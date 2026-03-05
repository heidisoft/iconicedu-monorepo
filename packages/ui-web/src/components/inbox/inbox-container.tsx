'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@iconicedu/ui-web/ui/tabs';
import { ActivityBasic } from '@iconicedu/ui-web/components/notification/activity-basic';
import { ActivityBasicWithExpandedContent } from '@iconicedu/ui-web/components/notification/activity-basic-with-expanded-content';
import { ActivityWithSubitems } from '@iconicedu/ui-web/components/notification/activity-with-subitems';
import type {
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedVM,
  ActivityFeedSectionVM,
  ActivityFeedTabVM,
  InboxTabKeyVM,
} from '@iconicedu/shared-types';

export function applyReadStateToSections(
  sections: ActivityFeedSectionVM[],
  ids: string[],
): ActivityFeedSectionVM[] {
  const readIds = new Set(ids);

  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (readIds.has(item.ids.id)) {
        return {
          ...item,
          state: {
            ...item.state,
            isRead: true,
          },
        };
      }
      if (item.kind === 'group' && item.subActivities?.items) {
        return {
          ...item,
          subActivities: {
            ...item.subActivities,
            items: item.subActivities.items.map((sub: ActivityFeedLeafItemVM) =>
              readIds.has(sub.ids.id)
                ? {
                    ...sub,
                    state: {
                      ...sub.state,
                      isRead: true,
                    },
                  }
                : sub,
            ),
          },
        };
      }
      return item;
    }),
  }));
}

function getUnreadCountForItem(item: ActivityFeedItemVM): number {
  if (item.kind === 'group') {
    return (
      item.subActivities?.items.filter(
        (sub: ActivityFeedLeafItemVM) => !sub.state?.isRead,
      ).length ?? (!item.state?.isRead ? 1 : 0)
    );
  }

  return item.state?.isRead ? 0 : 1;
}

export function buildUnreadTabCounts(
  tabs: ActivityFeedTabVM[],
  sections: ActivityFeedSectionVM[],
): Record<InboxTabKeyVM, number> {
  const counts = tabs.reduce(
    (acc, tab) => {
      acc[tab.key] = 0;
      return acc;
    },
    {} as Record<InboxTabKeyVM, number>,
  );

  sections.forEach((section) => {
    section.items.forEach((item) => {
      const unreadCount = getUnreadCountForItem(item);
      if (unreadCount === 0) {
        return;
      }

      counts.all += unreadCount;
      if (item.tabKey !== 'all') {
        counts[item.tabKey] += unreadCount;
      }
    });
  });

  return counts;
}

export function InboxContainer({
  feed,
  markReadEndpoint = '/api/activity-feed/read',
}: {
  feed: ActivityFeedVM;
  markReadEndpoint?: string;
}) {
  const [sections, setSections] = useState(feed.sections);
  const [activeTab, setActiveTab] = useState<InboxTabKeyVM>(feed.activeTab);
  const pendingAutoReadIdsRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyReadState = useCallback((ids: string[]) => {
    setSections((prev) => applyReadStateToSections(prev, ids));
  }, []);

  const persistReadState = useCallback(
    (ids: string[]) => {
      if (!ids.length) {
        return;
      }

      void fetch(markReadEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    },
    [markReadEndpoint],
  );

  const flushAutoReadQueue = useCallback(() => {
    const ids = Array.from(pendingAutoReadIdsRef.current);
    pendingAutoReadIdsRef.current.clear();
    flushTimerRef.current = null;
    if (!ids.length) {
      return;
    }

    applyReadState(ids);
    persistReadState(ids);
  }, [applyReadState, persistReadState]);

  useEffect(
    () => () => {
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
      }
    },
    [],
  );

  const tabCounts = buildUnreadTabCounts(feed.tabs, sections);

  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => activeTab === 'all' || item.tabKey === activeTab,
      ),
    }))
    .filter((section) => section.items.length > 0);

  const handleTabChange = (value: string) => {
    setActiveTab(value as InboxTabKeyVM);
  };

  const markAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    pendingAutoReadIdsRef.current.delete(id);
    applyReadState([id]);
    persistReadState([id]);
  };

  const autoMarkAsRead = useCallback(
    (id: string) => {
      pendingAutoReadIdsRef.current.add(id);
      if (flushTimerRef.current) {
        return;
      }

      flushTimerRef.current = setTimeout(() => {
        flushAutoReadQueue();
      }, 250);
    },
    [flushAutoReadQueue],
  );

  const renderActivity = (activity: ActivityFeedItemVM) => {
    if (activity.kind === 'group') {
      return (
        <ActivityWithSubitems
          activity={activity}
          onMarkRead={markAsRead}
          onAutoRead={autoMarkAsRead}
          showActionButton={false}
        />
      );
    }

    if (activity.content.expandedContent) {
      return (
        <ActivityBasicWithExpandedContent
          activity={activity}
          onMarkRead={markAsRead}
          onAutoRead={autoMarkAsRead}
          showActionButton={false}
        />
      );
    }

    return (
      <ActivityBasic
        activity={activity}
        onMarkRead={markAsRead}
        onAutoRead={autoMarkAsRead}
      />
    );
  };

  return (
    <Tabs
      value={activeTab}
      defaultValue="all"
      onValueChange={handleTabChange}
      className="flex size-full flex-col"
    >
      <div className="px-4 py-2">
        <TabsList>
          {feed.tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="gap-2">
              <span>{tab.label}</span>
              {tabCounts[tab.key] > 0 && (
                <Badge className="h-4 px-1.5 text-[10px] bg-rose-500 text-white">
                  {tabCounts[tab.key]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value={activeTab} className="mt-0">
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-4 space-y-8">
            {filteredSections.map((section) => (
              <div key={section.label} className="space-y-1">
                <h2 className="sticky top-0 z-30 -mx-4 mb-4 bg-background/95 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground shadow-sm backdrop-blur">
                  {section.label}
                </h2>
                <div className="space-y-1">
                  {section.items.map((activity) => (
                    <div key={activity.ids.id} className="relative">
                      {renderActivity(activity)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

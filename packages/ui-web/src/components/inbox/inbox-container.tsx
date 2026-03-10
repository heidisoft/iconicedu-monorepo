'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@iconicedu/ui-web/ui/tabs';
import { ActivityBasic } from '@iconicedu/ui-web/components/notification/activity-basic';
import { ActivityBasicWithExpandedContent } from '@iconicedu/ui-web/components/notification/activity-basic-with-expanded-content';
import { ActivityFeedbackRequest } from '@iconicedu/ui-web/components/notification/activity-feedback-request';
import { ActivityWithSubitems } from '@iconicedu/ui-web/components/notification/activity-with-subitems';
import type {
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedVM,
  ActivityFeedSectionVM,
  ActivityFeedTabVM,
  InboxTabKeyVM,
} from '@iconicedu/shared-types';

function getItemReadIds(item: ActivityFeedItemVM): string[] {
  const metadataReadIds = Array.isArray(item.metadata?.readItemIds)
    ? item.metadata.readItemIds
    : [];
  const ids = [item.ids.id, ...metadataReadIds].filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  return Array.from(new Set(ids));
}

function shouldMarkItemRead(item: ActivityFeedItemVM, readIds: Set<string>) {
  return getItemReadIds(item).some((id) => readIds.has(id));
}

export function applyReadStateToSections(
  sections: ActivityFeedSectionVM[],
  ids: string[],
): ActivityFeedSectionVM[] {
  const readIds = new Set(ids);

  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.kind === 'group' && item.subActivities?.items) {
        const markEntireGroup = readIds.has(item.ids.id);
        const nextSubItems = item.subActivities.items.map(
          (sub: ActivityFeedLeafItemVM) =>
            markEntireGroup || shouldMarkItemRead(sub, readIds)
              ? {
                  ...sub,
                  state: {
                    ...sub.state,
                    isRead: true,
                  },
                }
              : sub,
        );
        const allSubItemsRead = nextSubItems.every(
          (sub: ActivityFeedLeafItemVM) => sub.state?.isRead,
        );
        return {
          ...item,
          state: {
            ...item.state,
            isRead: markEntireGroup || allSubItemsRead || item.state?.isRead,
          },
          subActivities: {
            ...item.subActivities,
            items: nextSubItems,
          },
        };
      }
      if (shouldMarkItemRead(item, readIds)) {
        return {
          ...item,
          state: {
            ...item.state,
            isRead: true,
          },
        };
      }
      return item;
    }),
  }));
}

export function resolveReadIdsForActivity(
  sections: ActivityFeedSectionVM[],
  id: string,
): string[] {
  const dedupeIds = (ids: string[]) =>
    Array.from(
      new Set(ids.filter((entry) => typeof entry === 'string' && entry.length > 0)),
    );

  for (const section of sections) {
    for (const item of section.items) {
      if (item.ids.id === id) {
        if (item.kind === 'group') {
          const subIds =
            item.subActivities?.items.flatMap((sub: ActivityFeedLeafItemVM) =>
              getItemReadIds(sub),
            ) ?? [];
          return dedupeIds([id, ...subIds]);
        }
        return dedupeIds(getItemReadIds(item));
      }
      if (item.kind === 'group') {
        const matchedSub = item.subActivities?.items.find(
          (sub: ActivityFeedLeafItemVM) => sub.ids.id === id,
        );
        if (matchedSub) {
          return dedupeIds(getItemReadIds(matchedSub));
        }
      }
    }
  }
  return dedupeIds([id]);
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

export function applySessionParentLocalHeadline(
  activity: ActivityFeedItemVM,
): ActivityFeedItemVM {
  const metadata = activity.metadata as Record<string, unknown> | undefined;
  if (!metadata?.sessionGroupLocalTime) {
    return activity;
  }

  const occurrenceStart = metadata.occurrenceStart;
  if (typeof occurrenceStart !== 'string' || occurrenceStart.length === 0) {
    return activity;
  }

  const date = new Date(occurrenceStart);
  if (Number.isNaN(date.getTime())) {
    return activity;
  }

  const localLabel = date
    .toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .replace(',', ' at');

  return {
    ...activity,
    content: {
      ...activity.content,
      headline: {
        ...activity.content.headline,
        primary: `Class session ${localLabel}`,
      },
    },
  };
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
    const resolvedIds = resolveReadIdsForActivity(sections, id);
    resolvedIds.forEach((resolvedId) => {
      pendingAutoReadIdsRef.current.delete(resolvedId);
    });
    applyReadState(resolvedIds);
    persistReadState(resolvedIds);
  };

  const autoMarkAsRead = useCallback(
    (id: string) => {
      const resolvedIds = resolveReadIdsForActivity(sections, id);
      resolvedIds.forEach((resolvedId) => pendingAutoReadIdsRef.current.add(resolvedId));
      if (flushTimerRef.current) {
        return;
      }

      flushTimerRef.current = setTimeout(() => {
        flushAutoReadQueue();
      }, 250);
    },
    [flushAutoReadQueue, sections],
  );

  const renderActivity = (activity: ActivityFeedItemVM) => {
    const displayActivity = applySessionParentLocalHeadline(activity);

    if (displayActivity.kind === 'group') {
      return (
        <ActivityWithSubitems
          activity={displayActivity}
          onMarkRead={markAsRead}
          onAutoRead={autoMarkAsRead}
          showActionButton={Boolean(displayActivity.content.actionButton)}
        />
      );
    }

    if (displayActivity.verb === 'session.feedback_request.sent') {
      return (
        <ActivityBasicWithExpandedContent
          activity={displayActivity}
          onMarkRead={markAsRead}
          onAutoRead={autoMarkAsRead}
          showActionButton={false}
          className="pb-0"
        >
          <ActivityFeedbackRequest activity={displayActivity as ActivityFeedLeafItemVM} />
        </ActivityBasicWithExpandedContent>
      );
    }

    if (displayActivity.content.expandedContent) {
      return (
        <ActivityBasicWithExpandedContent
          activity={displayActivity}
          onMarkRead={markAsRead}
          onAutoRead={autoMarkAsRead}
          showActionButton={Boolean(displayActivity.content.actionButton)}
        />
      );
    }

    return (
      <ActivityBasic
        activity={displayActivity}
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

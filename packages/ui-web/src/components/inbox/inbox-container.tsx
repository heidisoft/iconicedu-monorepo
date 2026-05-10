'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BellOff } from 'lucide-react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Button } from '@iconicedu/ui-web/ui/button';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@iconicedu/ui-web/ui/tabs';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@iconicedu/ui-web/ui/empty';
import { ActivityBasic } from '@iconicedu/ui-web/components/notification/activity-basic';
import { ActivityBasicWithExpandedContent } from '@iconicedu/ui-web/components/notification/activity-basic-with-expanded-content';
import type {
  ActivityFeedItemVM,
  ActivityFeedVM,
  ActivityFeedSectionVM,
  ActivityFeedTabVM,
  InboxTabKeyVM,
} from '@iconicedu/shared-types';

const INBOX_PAGE_SIZE = 20;

export function limitSectionsByItemCount(
  sections: ActivityFeedSectionVM[],
  maxItems: number,
): ActivityFeedSectionVM[] {
  if (maxItems <= 0) {
    return [];
  }

  let remaining = maxItems;
  const limited: ActivityFeedSectionVM[] = [];

  for (const section of sections) {
    if (remaining <= 0) {
      break;
    }

    const items = section.items.slice(0, remaining);
    if (!items.length) {
      continue;
    }

    limited.push({
      ...section,
      items,
    });
    remaining -= items.length;
  }

  return limited;
}

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
    const matchedItem = section.items.find((item) => item.ids.id === id);
    if (matchedItem) {
      return dedupeIds(getItemReadIds(matchedItem));
    }
  }
  return dedupeIds([id]);
}

function getUnreadCountForItem(item: ActivityFeedItemVM): number {
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

export function resolveUnreadIdsForTab(
  sections: ActivityFeedSectionVM[],
  activeTab: InboxTabKeyVM,
): string[] {
  const unreadIds = new Set<string>();

  sections.forEach((section) => {
    section.items.forEach((item) => {
      if (activeTab !== 'all' && item.tabKey !== activeTab) {
        return;
      }

      if (!item.state?.isRead) {
        getItemReadIds(item).forEach((id) => unreadIds.add(id));
      }
    });
  });

  return Array.from(unreadIds);
}

export function InboxContainer({
  feed,
  markReadEndpoint = '/api/activity-feed/read',
  showMarkAllAsRead = false,
}: {
  feed: ActivityFeedVM;
  markReadEndpoint?: string;
  timezone?: string | null;
  showMarkAllAsRead?: boolean;
}) {
  const [sections, setSections] = useState(feed.sections);
  const [activeTab, setActiveTab] = useState<InboxTabKeyVM>(feed.activeTab);
  const [visibleItemCount, setVisibleItemCount] = useState(INBOX_PAGE_SIZE);
  const pendingAutoReadIdsRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
  const unreadIdsForActiveTab = resolveUnreadIdsForTab(sections, activeTab);
  const isMarkAllDisabled = unreadIdsForActiveTab.length === 0;

  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => activeTab === 'all' || item.tabKey === activeTab,
      ),
    }))
    .filter((section) => section.items.length > 0);
  const filteredItemCount = filteredSections.reduce(
    (total, section) => total + section.items.length,
    0,
  );
  const hasMore = filteredItemCount > visibleItemCount;
  const visibleSections = limitSectionsByItemCount(filteredSections, visibleItemCount);

  useEffect(() => {
    setVisibleItemCount(INBOX_PAGE_SIZE);
  }, [activeTab, sections]);

  useEffect(() => {
    if (!hasMore) {
      return;
    }

    const target = loadMoreRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleItemCount((current) =>
            Math.min(current + INBOX_PAGE_SIZE, filteredItemCount),
          );
        }
      },
      { rootMargin: '200px 0px', threshold: 0.1 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredItemCount, hasMore, visibleItemCount]);

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

  const markAllAsRead = useCallback(() => {
    if (unreadIdsForActiveTab.length === 0) {
      return;
    }

    unreadIdsForActiveTab.forEach((resolvedId) => {
      pendingAutoReadIdsRef.current.delete(resolvedId);
    });
    applyReadState(unreadIdsForActiveTab);
    persistReadState(unreadIdsForActiveTab);
  }, [applyReadState, persistReadState, unreadIdsForActiveTab]);

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
    const displayActivity = activity;

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
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <TabsList>
          {feed.tabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="gap-2">
              <span>{tab.label}</span>
              {tabCounts[tab.key] > 0 && (
                <Badge className="h-4 bg-rose-500 px-1.5 text-[10px] text-white">
                  {tabCounts[tab.key]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {showMarkAllAsRead ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={isMarkAllDisabled}
            onClick={markAllAsRead}
          >
            Mark all as read
          </Button>
        ) : null}
      </div>
      <TabsContent value={activeTab} className="mt-0">
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-4 space-y-8">
            {visibleSections.length === 0 ? (
              <Empty className="rounded-2xl border border-dashed border-border bg-background/60 px-6 py-12">
                <EmptyHeader className="max-w-none items-center text-center">
                  <EmptyMedia variant="icon">
                    <BellOff className="size-5" aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No alerts to display</EmptyTitle>
                  <EmptyDescription>
                    Your inbox is clear right now. New messages, mentions, and updates
                    will show up here.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent />
              </Empty>
            ) : (
              visibleSections.map((section) => (
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
              ))
            )}
            {hasMore ? (
              <div ref={loadMoreRef} aria-hidden className="h-6 w-full" />
            ) : null}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

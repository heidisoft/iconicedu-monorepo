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
import {
  ActivityFeedbackRequest,
  canRenderActivityFeedbackRequest,
} from '@iconicedu/ui-web/components/notification/activity-feedback-request';
import type {
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedVM,
  ActivityFeedSectionVM,
  ActivityFeedTabVM,
  InboxTabKeyVM,
} from '@iconicedu/shared-types';
import {
  formatScheduleDisplayTimeWithZone,
  formatScheduleDisplayValue,
  isSameScheduleDisplayDay,
  resolveScheduleDisplayTimeZone,
  type ScheduleDisplayTimeZoneInput,
} from '@iconicedu/ui-web/lib/schedule-display-timezone';

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

export function isFeedbackRequestActivity(activity: ActivityFeedItemVM) {
  return (
    activity.kind === 'leaf' &&
    (activity.verb === 'session.feedback_request.sent' ||
      activity.verb === 'sessions.feedback_request.sent')
  );
}

export function applySessionParentLocalHeadline(
  activity: ActivityFeedItemVM,
  timezone?: string | null,
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

  const metadataTimezone =
    typeof metadata.timezone === 'string' ? metadata.timezone : undefined;
  const displayTimezone: ScheduleDisplayTimeZoneInput = {
    viewerTimezone: timezone,
    scheduleTimezone: metadataTimezone,
  };
  const localLabel = formatScheduleDisplayTimeWithZone(date, displayTimezone, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })?.replace(',', ' at');

  if (!localLabel) {
    return activity;
  }

  const participantNamesLabel =
    typeof metadata.participantNamesLabel === 'string' &&
    metadata.participantNamesLabel.length > 0
      ? metadata.participantNamesLabel
      : undefined;

  return {
    ...activity,
    content: {
      ...activity.content,
      headline: {
        ...activity.content.headline,
        primary: `Class session${
          participantNamesLabel ? ` for ${participantNamesLabel}` : ''
        } ${localLabel}`,
      },
    },
  };
}

function formatLocalDateTimeLabel(
  value: string,
  timezone?: string | null,
  scheduleTimezone?: string | null,
) {
  return formatScheduleDisplayTimeWithZone(
    value,
    {
      viewerTimezone: timezone,
      scheduleTimezone,
    },
    {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    },
  )?.replace(',', ' at');
}

function formatLocalTimeLabel(
  value: string,
  timezone?: string | null,
  scheduleTimezone?: string | null,
) {
  return formatScheduleDisplayTimeWithZone(
    value,
    {
      viewerTimezone: timezone,
      scheduleTimezone,
    },
    {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    },
  );
}

function formatSchedulePart(
  value: string,
  timezone?: ScheduleDisplayTimeZoneInput,
  options?: Intl.DateTimeFormatOptions,
) {
  return formatScheduleDisplayValue(value, timezone, options ?? {});
}

function formatScheduleDayLabel(value: string, timezone?: ScheduleDisplayTimeZoneInput) {
  return formatSchedulePart(value, timezone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatScheduleTimeLabel(
  value: string,
  timezone?: ScheduleDisplayTimeZoneInput,
  includeZone = false,
) {
  if (includeZone) {
    return formatScheduleDisplayTimeWithZone(value, timezone, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  return formatSchedulePart(value, timezone, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatScheduleDateTimeLabel(
  value: string,
  timezone?: ScheduleDisplayTimeZoneInput,
  includeComma = true,
) {
  const dayLabel = formatScheduleDayLabel(value, timezone);
  const timeLabel = formatScheduleTimeLabel(value, timezone, true);
  if (!dayLabel || !timeLabel) {
    return null;
  }
  return includeComma ? `${dayLabel}, ${timeLabel}` : `${dayLabel} ${timeLabel}`;
}

function isSameScheduleDay(
  a: string,
  b: string,
  timezone?: ScheduleDisplayTimeZoneInput,
) {
  return isSameScheduleDisplayDay(a, b, timezone);
}

export function applyScheduleActivityLocalTime(
  activity: ActivityFeedItemVM,
  timezone?: string | null,
): ActivityFeedItemVM {
  const metadata = activity.metadata as Record<string, unknown> | undefined;
  if (metadata?.preserveActivitySummary === true) {
    return activity;
  }
  if (!metadata?.sessionLocalTime) {
    return activity;
  }

  if (activity.verb === 'class.session.rescheduled') {
    const title =
      typeof metadata.title === 'string'
        ? metadata.title
        : (activity.content.headline.secondary ?? 'Class');
    const scheduleTimezone =
      typeof metadata.firstSessionTimezone === 'string'
        ? metadata.firstSessionTimezone
        : typeof metadata.timezone === 'string'
          ? metadata.timezone
          : undefined;
    const displayTimezone = {
      viewerTimezone: timezone,
      scheduleTimezone,
    };
    const fromValue =
      typeof metadata.rescheduledFromStartAt === 'string'
        ? metadata.rescheduledFromStartAt
        : typeof metadata.startAt === 'string'
          ? metadata.startAt
          : undefined;
    const toValue =
      typeof metadata.rescheduledToStartAt === 'string'
        ? metadata.rescheduledToStartAt
        : undefined;
    const reason =
      typeof metadata.rescheduledReason === 'string'
        ? metadata.rescheduledReason
        : undefined;
    let summary = activity.content.summary;
    if (fromValue && toValue) {
      if (isSameScheduleDay(fromValue, toValue, displayTimezone)) {
        const dayLabel = formatScheduleDayLabel(fromValue, displayTimezone);
        const fromTime = formatScheduleTimeLabel(fromValue, displayTimezone);
        const toTime = formatScheduleTimeLabel(toValue, displayTimezone, true);
        if (dayLabel && fromTime && toTime) {
          summary = `Session: ${title} weekly session (${dayLabel}) moved from ${fromTime} to ${toTime}${
            reason ? ` due to ${reason}` : ''
          }`;
        }
      } else {
        const fromDateTime = formatScheduleDateTimeLabel(fromValue, displayTimezone);
        const toDateTime = formatScheduleDateTimeLabel(toValue, displayTimezone);
        if (fromDateTime && toDateTime) {
          summary = `Session: ${title} weekly session moved from ${fromDateTime} to ${toDateTime}${
            reason ? ` due to ${reason}` : ''
          }`;
        }
      }
    }
    return {
      ...activity,
      content: {
        ...activity.content,
        headline: {
          ...activity.content.headline,
          primary: 'Class session rescheduled',
        },
        summary,
      },
    };
  }

  if (activity.verb === 'class.session.canceled') {
    const title =
      typeof metadata.title === 'string'
        ? metadata.title
        : (activity.content.headline.secondary ?? 'Class');
    const scheduleTimezone =
      typeof metadata.firstSessionTimezone === 'string'
        ? metadata.firstSessionTimezone
        : typeof metadata.timezone === 'string'
          ? metadata.timezone
          : undefined;
    const displayTimezone = {
      viewerTimezone: timezone,
      scheduleTimezone,
    };
    const canceledValue =
      typeof metadata.canceledStartAt === 'string'
        ? metadata.canceledStartAt
        : typeof metadata.startAt === 'string'
          ? metadata.startAt
          : undefined;
    const reason =
      typeof metadata.canceledReason === 'string' ? metadata.canceledReason : undefined;
    let summary = activity.content.summary;
    if (canceledValue) {
      const canceledDateTime = formatScheduleDateTimeLabel(
        canceledValue,
        displayTimezone,
        false,
      );
      if (canceledDateTime) {
        summary = `Session: ${title} weekly session (${canceledDateTime}) canceled${
          reason ? ` due to ${reason}` : ''
        }`;
      }
    }
    return {
      ...activity,
      content: {
        ...activity.content,
        headline: {
          ...activity.content.headline,
          primary: 'Class session cancelled',
        },
        summary,
      },
    };
  }

  return activity;
}

export function InboxContainer({
  feed,
  markReadEndpoint = '/api/activity-feed/read',
  timezone,
  showMarkAllAsRead = false,
}: {
  feed: ActivityFeedVM;
  markReadEndpoint?: string;
  timezone?: string | null;
  showMarkAllAsRead?: boolean;
}) {
  const displayTimezone = resolveScheduleDisplayTimeZone(timezone);
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
    const displayActivity = applyScheduleActivityLocalTime(
      applySessionParentLocalHeadline(activity, displayTimezone),
      displayTimezone,
    );

    if (isFeedbackRequestActivity(displayActivity)) {
      if (!canRenderActivityFeedbackRequest(displayActivity as ActivityFeedLeafItemVM)) {
        return (
          <ActivityBasic
            activity={displayActivity}
            onMarkRead={markAsRead}
            onAutoRead={autoMarkAsRead}
          />
        );
      }

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

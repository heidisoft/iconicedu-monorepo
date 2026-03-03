'use client';

import type React from 'react';
import { useState } from 'react';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@iconicedu/ui-web/ui/tabs';
import { ActivityBasic } from '@iconicedu/ui-web/components/notification/activity-basic';
import { ActivityBasicWithActionButton } from '@iconicedu/ui-web/components/notification/activity-basic-with-action-button';
import { ActivityBasicWithExpandedContent } from '@iconicedu/ui-web/components/notification/activity-basic-with-expanded-content';
import { ActivityWithSubitems } from '@iconicedu/ui-web/components/notification/activity-with-subitems';
import type {
  ActivityFeedItemVM,
  ActivityFeedLeafItemVM,
  ActivityFeedVM,
  InboxTabKeyVM,
} from '@iconicedu/shared-types';

export function InboxContainer({ feed, markReadEndpoint = '/api/activity-feed/read' }: {
  feed: ActivityFeedVM;
  markReadEndpoint?: string;
}) {
  const [sections, setSections] = useState(feed.sections);
  const [activeTab, setActiveTab] = useState<InboxTabKeyVM>(feed.activeTab);

  const tabCounts = feed.tabs.reduce(
    (acc, tab) => {
      const count = sections.reduce((total, section) => {
        const sectionCount = section.items.filter(
          (item) =>
            (tab.key === 'all' || item.tabKey === tab.key) && !item.state?.isRead,
        ).length;
        return total + sectionCount;
      }, 0);
      acc[tab.key] = tab.badgeCount ?? count;
      return acc;
    },
    {} as Record<InboxTabKeyVM, number>,
  );

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
    void fetch(markReadEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    });
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        items: section.items.map((item) => {
          if (item.ids.id === id) {
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
                  sub.ids.id === id
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
      })),
    );
  };

  const renderActivity = (activity: ActivityFeedItemVM) => {
    if (activity.kind === 'group') {
      return <ActivityWithSubitems activity={activity} onMarkRead={markAsRead} />;
    }

    if (activity.content.expandedContent) {
      return (
        <ActivityBasicWithExpandedContent
          activity={activity}
          onMarkRead={markAsRead}
          showActionButton={Boolean(activity.content.actionButton)}
        />
      );
    }

    if (activity.content.actionButton) {
      return (
        <ActivityBasicWithActionButton activity={activity} onMarkRead={markAsRead} />
      );
    }

    return <ActivityBasic activity={activity} onMarkRead={markAsRead} />;
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

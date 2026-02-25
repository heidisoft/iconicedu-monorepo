'use client';

import { memo } from 'react';
import {
  CalendarDays,
  CircleDot,
  Eye,
  School,
  Tag,
  Users,
} from 'lucide-react';
import type { LearningSpaceVM, MessagesRightPanelIntent } from '@iconicedu/shared-types';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { ThemedIconBadge } from '@iconicedu/ui-web/components/shared/themed-icon';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import { getLearningSpaceIcon } from '@iconicedu/ui-web/lib/icons';

interface LearningSpaceInfoPanelProps {
  intent: MessagesRightPanelIntent;
  learningSpace?: LearningSpaceVM | null;
}

const LearningSpaceInfoPanelContent = memo(function LearningSpaceInfoPanelContent({
  learningSpace,
}: {
  learningSpace: LearningSpaceVM;
}) {
  const { channel } = useMessagesState();
  const iconKey = learningSpace.basics.iconKey ?? channel.basics.iconKey ?? 'sparkles';
  const Icon = getLearningSpaceIcon(iconKey);
  const createdAt = learningSpace.lifecycle?.createdAt
    ? new Date(learningSpace.lifecycle.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Unknown';

  const details = getLearningSpaceMetadata(learningSpace, channel, createdAt);

  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-col items-center gap-3 p-6 min-w-0 text-center">
        <ThemedIconBadge icon={Icon} themeKey={channel.ui?.themeKey ?? null} size="lg" />
        <div className="text-center min-w-0">
          <h2 className="text-lg font-semibold text-foreground break-words">
            {learningSpace.basics.title}
          </h2>
          {learningSpace.basics.description ? (
            <p className="mt-1 text-sm text-muted-foreground break-words">
              {learningSpace.basics.description}
            </p>
          ) : null}
        </div>
        <Badge variant="secondary" className="text-xs">
          {learningSpace.basics.kind.replace(/_/g, ' ')}
        </Badge>
      </div>

      <Separator />

      <div className="space-y-4 p-4 min-w-0">
        <h3 className="text-sm font-semibold text-foreground">Details</h3>
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          {details.map((item) => {
            const DetailIcon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <DetailIcon className="h-4 w-4" />
                  {item.label}
                </span>
                <span className="max-w-[60%] truncate text-right text-foreground">
                  {item.value}
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Tag className="h-4 w-4" />
              Channel ID
            </span>
            <span className="max-w-[60%] truncate text-right text-foreground">
              {channel.ids.id}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Tag className="h-4 w-4" />
              Space ID
            </span>
            <span className="max-w-[60%] truncate text-right text-foreground">
              {learningSpace.ids?.id ?? 'Unknown'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export function getLearningSpaceMetadata(
  learningSpace: LearningSpaceVM,
  channel: ReturnType<typeof useMessagesState>['channel'],
  createdAt: string,
) {
  return [
    { label: 'Created', value: createdAt, icon: CalendarDays },
    { label: 'Status', value: learningSpace.basics.status, icon: CircleDot },
    { label: 'Kind', value: learningSpace.basics.kind.replace(/_/g, ' '), icon: School },
    { label: 'Visibility', value: channel.basics.visibility, icon: Eye },
    { label: 'Purpose', value: channel.basics.purpose, icon: Tag },
    { label: 'Participants', value: String(learningSpace.participants.length), icon: Users },
  ];
}

export function LearningSpaceInfoPanel({
  learningSpace,
}: LearningSpaceInfoPanelProps) {
  if (!learningSpace) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <LearningSpaceInfoPanelContent learningSpace={learningSpace} />
    </div>
  );
}

'use client';

import { memo } from 'react';
import {
  Calculator,
  BookOpen,
  ChefHat,
  CalendarDays,
  ChessKnight,
  ClipboardCheck,
  Earth,
  Eye,
  GraduationCap,
  Languages,
  Landmark,
  LifeBuoy,
  Map,
  NotebookPen,
  NotebookText,
  Paintbrush,
  Palette,
  PenTool,
  Ruler,
  Scissors,
  Sparkles,
  SquarePi,
  Tag,
  User,
  Users,
  Shield,
  CircleDot,
} from 'lucide-react';
import type { MessagesRightPanelIntent } from '@iconicedu/shared-types';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { ThemedIconBadge } from '@iconicedu/ui-web/components/shared/themed-icon';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';

interface ChannelInfoPanelProps {
  intent: MessagesRightPanelIntent;
}

const CHANNEL_ICON_MAP = {
  sparkles: Sparkles,
  book: BookOpen,
  user: User,
  users: Users,
  languages: Languages,
  'square-pi': SquarePi,
  'chef-hat': ChefHat,
  earth: Earth,
  'chess-knight': ChessKnight,
  palette: Palette,
  paintbrush: Paintbrush,
  scissors: Scissors,
  calculator: Calculator,
  ruler: Ruler,
  'pen-tool': PenTool,
  'notebook-pen': NotebookPen,
  'notebook-text': NotebookText,
  'clipboard-check': ClipboardCheck,
  'graduation-cap': GraduationCap,
  landmark: Landmark,
  map: Map,
  'life-buoy': LifeBuoy,
  support: LifeBuoy,
} as const;

const ChannelInfoPanelContent = memo(function ChannelInfoPanelContent() {
  const { channel } = useMessagesState();
  const iconKey = channel.basics.iconKey ?? 'sparkles';
  const TopicIcon =
    CHANNEL_ICON_MAP[iconKey as keyof typeof CHANNEL_ICON_MAP] ?? Sparkles;
  const metadata = getChannelMetadata(channel);
  return (
    <div className="flex-1 min-w-0">
      <div className="flex flex-col items-center gap-3 p-6 min-w-0">
        <ThemedIconBadge
          icon={TopicIcon}
          themeKey={channel.ui?.themeKey ?? null}
          size="lg"
        />
        <div className="text-center min-w-0">
          <h2 className="text-lg font-semibold text-foreground break-words">
            {channel.basics.topic}
          </h2>
          {channel.basics.description ? (
            <p className="mt-1 text-sm text-muted-foreground break-words">
              {channel.basics.description}
            </p>
          ) : null}
        </div>
        {channel.basics.purpose ? (
          <Badge variant="secondary" className="text-xs">
            {channel.basics.purpose.replace('-', ' ')}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-4 p-4 min-w-0">
        <h3 className="text-sm font-semibold text-foreground">Details</h3>
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          {metadata.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
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
        </div>
      </div>
      <Separator />
    </div>
  );
});

export function getChannelMetadata(
  channel: ReturnType<typeof useMessagesState>['channel'],
) {
  const createdAt = channel.lifecycle?.createdAt
    ? new Date(channel.lifecycle.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Unknown';

  return [
    { label: 'Created', value: createdAt, icon: CalendarDays },
    {
      label: 'Visibility',
      value: channel.basics.visibility,
      icon: Eye,
    },
    {
      label: 'Purpose',
      value: channel.basics.purpose,
      icon: Tag,
    },
    {
      label: 'Posting',
      value: channel.postingPolicy.kind,
      icon: Shield,
    },
    {
      label: 'Status',
      value: channel.lifecycle.status,
      icon: CircleDot,
    },
  ];
}

export function ChannelInfoPanel(_: ChannelInfoPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <ChannelInfoPanelContent />
    </div>
  );
}

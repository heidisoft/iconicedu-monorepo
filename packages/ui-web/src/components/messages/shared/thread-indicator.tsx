import { memo } from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { MessageCircleMore } from 'lucide-react';
import type { ThreadVM } from '@iconicedu/shared-types';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';

interface ThreadIndicatorProps {
  thread: ThreadVM;
  onClick: () => void;
  unreadCount?: number;
}

export const ThreadIndicator = memo(function ThreadIndicator({
  thread,
  onClick,
  unreadCount = 0,
}: ThreadIndicatorProps) {
  const participantPreview = thread.participants.slice(0, 2);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-7 min-h-7 w-fit self-center gap-1.5 rounded-full border border-border bg-background/60 px-2 text-primary hover:bg-muted hover:text-primary"
    >
      <MessageCircleMore className="h-4 w-4" />
      <span className="text-[12px] font-semibold tracking-tight leading-none">
        {thread.stats.messageCount}{' '}
      </span>
      <span className="text-[12px] font-semibold leading-none">
        {thread.stats.messageCount === 1 ? 'reply' : 'replies'}
      </span>
      {unreadCount > 0 && (
        <Badge
          variant="secondary"
          className="h-5 px-1.5 text-[10px] font-semibold uppercase"
        >
          New
        </Badge>
      )}
      {unreadCount > 0 && (
        <Badge variant="destructive" className="h-5 min-w-[1.25rem] px-1.5 text-xs">
          {unreadCount}
        </Badge>
      )}
      <div className="flex -space-x-2">
        {participantPreview.map((participant) => {
          const participantName = getProfileDisplayName(participant.profile);
          return (
            <AvatarWithStatus
              key={participant.ids.id}
              name={participantName}
              avatar={participant.profile.avatar}
              themeKey={participant.ui?.themeKey}
              showStatus={false}
              sizeClassName="h-5 w-5 border-2 border-background"
              fallbackClassName="text-[11px]"
              initialsLength={1}
            />
          );
        })}
      </div>
    </Button>
  );
});

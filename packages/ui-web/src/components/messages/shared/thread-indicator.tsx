import { memo } from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { MessageCircle } from 'lucide-react';
import type { ThreadVM } from '@iconicedu/shared-types';
import { formatThreadTime } from '@iconicedu/ui-web/lib/message-utils';
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
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="mt-1 h-auto w-fit gap-2 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-sm text-primary hover:bg-muted hover:text-primary"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      <span className="font-medium">
        {thread.stats.messageCount}{' '}
        {thread.stats.messageCount === 1 ? 'reply' : 'replies'}
      </span>
      {unreadCount > 0 && (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold uppercase">
          New
        </Badge>
      )}
      {unreadCount > 0 && (
        <Badge variant="destructive" className="h-5 min-w-[1.25rem] px-1.5 text-xs">
          {unreadCount}
        </Badge>
      )}
      <div className="flex -space-x-2">
        {thread.participants.slice(0, 3).map((participant) => {
          const participantName = getProfileDisplayName(participant.profile);
          return (
            <AvatarWithStatus
              key={participant.ids.id}
              name={participantName}
              avatar={participant.profile.avatar}
              themeKey={participant.ui?.themeKey}
              showStatus={false}
              sizeClassName="h-5 w-5 border-2 border-background"
              fallbackClassName="text-[10px]"
              initialsLength={1}
            />
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        {formatThreadTime(thread.stats.lastReplyAt)}
      </span>
    </Button>
  );
});

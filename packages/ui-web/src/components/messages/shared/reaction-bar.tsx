'use client';

import { memo, useCallback } from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@iconicedu/ui-web/ui/tooltip';
import type { ReactionVM } from '@iconicedu/shared-types';
import { ANIMATION_DELAYS } from '@iconicedu/ui-web/constants/message-constants';
import { Loader2 } from 'lucide-react';

interface ReactionBarProps {
  reactions: ReactionVM[];
  onToggleReaction?: (emoji: string) => void;
  pendingEmojis?: string[];
}

export const ReactionBar = memo(function ReactionBar({
  reactions,
  onToggleReaction,
  pendingEmojis = [],
}: ReactionBarProps) {
  const hasReactions = reactions && reactions.length > 0;
  const pendingEmojiSet = new Set(pendingEmojis);

  const handleReactionClick = useCallback(
    (emoji: string) => {
      onToggleReaction?.(emoji);
    },
    [onToggleReaction],
  );

  return (
    <div
      className={`grid transition-all duration-300 ease-out ${
        hasReactions ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="overflow-visible">
        <div className="flex flex-wrap items-center gap-1.5">
          {reactions.map((reaction, index) => {
            const isUserReaction = reaction.reactedByMe ?? false;
            const isPending = pendingEmojiSet.has(reaction.emoji);
            return (
              <TooltipProvider key={reaction.emoji}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReactionClick(reaction.emoji)}
                      disabled={isPending}
                      className={`h-7 min-w-[2.4rem] rounded-full border px-2 text-[12px] leading-none border-muted-foreground/20 transition-all duration-200 hover:scale-[1.03] ${
                        isUserReaction
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-background/60 text-foreground'
                      } ${isPending ? 'opacity-80' : ''}`}
                      style={{
                        animationDelay: `${index * ANIMATION_DELAYS.REACTION_STAGGER}ms`,
                      }}
                      aria-label={`${reaction.emoji} reaction, ${reaction.count} ${reaction.count === 1 ? 'person' : 'people'}`}
                    >
                      <span className="mr-1 text-[13px] leading-none">{reaction.emoji}</span>
                      {isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <span className="text-[13px] font-semibold tracking-tight leading-none">
                          {reaction.count}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {reaction.count} {reaction.count === 1 ? 'person' : 'people'}{' '}
                      reacted
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    </div>
  );
});

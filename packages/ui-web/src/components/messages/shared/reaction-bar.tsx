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

interface ReactionBarProps {
  reactions: ReactionVM[];
  onToggleReaction?: (emoji: string) => void;
}

export const ReactionBar = memo(function ReactionBar({
  reactions,
  onToggleReaction,
}: ReactionBarProps) {
  const hasReactions = reactions && reactions.length > 0;

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
        <div className="flex flex-wrap gap-1.5 pb-1 pt-1">
          {reactions.map((reaction, index) => {
            const isUserReaction = reaction.reactedByMe ?? false;
            return (
              <TooltipProvider key={reaction.emoji}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReactionClick(reaction.emoji)}
                      className={`h-7 min-w-[2.4rem] rounded-full border px-2 text-[12px] leading-none border-muted-foreground/20 transition-all duration-200 hover:scale-[1.03] ${
                        isUserReaction
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-background/60 text-foreground'
                      }`}
                      style={{
                        animationDelay: `${index * ANIMATION_DELAYS.REACTION_STAGGER}ms`,
                      }}
                      aria-label={`${reaction.emoji} reaction, ${reaction.count} ${reaction.count === 1 ? 'person' : 'people'}`}
                    >
                      <span className="mr-1 text-[13px] leading-none">{reaction.emoji}</span>
                      <span className="text-[13px] font-semibold tracking-tight leading-none">
                        {reaction.count}
                      </span>
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

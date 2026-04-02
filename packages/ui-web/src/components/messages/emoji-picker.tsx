import type React from 'react';
import { useState, useEffect, useCallback, memo } from 'react';
import { reportObservedError } from '@iconicedu/utils';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@iconicedu/ui-web/ui/popover';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@iconicedu/ui-web/ui/tabs';
import { Clock } from 'lucide-react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  children: React.ReactNode;
}

export const EMOJI_PICKER_POPOVER_PROPS = {
  align: 'center' as const,
  side: 'bottom' as const,
  sideOffset: 10,
};

const emojiCategories = {
  smileys: {
    label: '😊',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😅',
      '😊',
      '😇',
      '🥰',
      '😍',
      '🤩',
      '😘',
      '😋',
      '😎',
      '🤓',
      '🧐',
      '🤔',
      '🤗',
      '🤭',
      '😌',
      '😔',
    ],
  },
  gestures: {
    label: '👍',
    emojis: [
      '👍',
      '👎',
      '👏',
      '🙌',
      '👊',
      '✊',
      '🤝',
      '🙏',
      '✋',
      '👋',
      '💪',
      '✌️',
      '🤞',
      '👌',
    ],
  },
  hearts: {
    label: '❤️',
    emojis: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '💕',
      '💞',
      '💓',
      '💗',
      '💖',
      '💘',
    ],
  },
  education: {
    label: '📚',
    emojis: [
      '📚',
      '📖',
      '📝',
      '✏️',
      '📌',
      '📍',
      '🎓',
      '🏆',
      '🥇',
      '⭐',
      '✨',
      '💡',
      '🔖',
      '📎',
    ],
  },
  celebrations: {
    label: '🎉',
    emojis: ['🎉', '🎊', '🎈', '🎁', '🏅', '🥈', '🥉', '🌟', '✅', '💯', '🔥', '👑'],
  },
} as const;

const RECENT_EMOJIS_KEY = 'messages-recent-emojis';
const MAX_RECENT_EMOJIS = 24;

const EmojiButton = memo(function EmojiButton({
  emoji,
  onClick,
}: {
  emoji: string;
  onClick: (emoji: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      className="h-9 w-9 p-0 text-xl hover:bg-accent"
      onClick={() => onClick(emoji)}
      type="button"
      aria-label={`Select ${emoji} emoji`}
    >
      {emoji}
    </Button>
  );
});

export const EmojiPicker = memo(function EmojiPicker({
  onEmojiSelect,
  children,
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = globalThis.localStorage?.getItem(RECENT_EMOJIS_KEY);
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      }
    } catch (error) {
      reportObservedError({
        error,
        source: 'web.messages.emoji_picker.load_recent',
        message: 'Failed to load recent emojis from local storage',
      });
    }
  }, []);

  const updateRecentEmojis = useCallback((emoji: string) => {
    setRecentEmojis((prev) => {
      const filtered = prev.filter((e) => e !== emoji);
      const updated = [emoji, ...filtered].slice(0, MAX_RECENT_EMOJIS);

      try {
        globalThis.localStorage?.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
      } catch (error) {
        reportObservedError({
          error,
          source: 'web.messages.emoji_picker.save_recent',
          message: 'Failed to persist recent emojis',
        });
      }

      return updated;
    });
  }, []);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      updateRecentEmojis(emoji);
      onEmojiSelect(emoji);
      setOpen(false);
    },
    [updateRecentEmojis, onEmojiSelect],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0"
        align={EMOJI_PICKER_POPOVER_PROPS.align}
        side={EMOJI_PICKER_POPOVER_PROPS.side}
        sideOffset={EMOJI_PICKER_POPOVER_PROPS.sideOffset}
        style={{ zIndex: 9999 }}
      >
        <Tabs
          defaultValue={recentEmojis.length > 0 ? 'recent' : 'smileys'}
          className="w-full"
        >
          <TabsList className="w-full justify-start rounded-none border-b-0 bg-transparent p-0">
            {recentEmojis.length > 0 && (
              <TabsTrigger
                value="recent"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent"
              >
                <Clock className="h-4 w-4" />
              </TabsTrigger>
            )}
            {Object.entries(emojiCategories).map(([key, { label }]) => (
              <TabsTrigger
                key={key}
                value={key}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {recentEmojis.length > 0 && (
            <TabsContent value="recent" className="m-0 p-2">
              <ScrollArea className="h-[240px]">
                <div className="grid grid-cols-8 gap-1">
                  {recentEmojis.map((emoji, index) => (
                    <EmojiButton
                      key={`recent-${emoji}-${index}`}
                      emoji={emoji}
                      onClick={handleEmojiSelect}
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {Object.entries(emojiCategories).map(([key, { emojis }]) => (
            <TabsContent key={key} value={key} className="m-0 p-2">
              <ScrollArea className="h-[240px]">
                <div className="grid grid-cols-8 gap-1">
                  {emojis.map((emoji, index) => (
                    <EmojiButton
                      key={`${emoji}-${index}`}
                      emoji={emoji}
                      onClick={handleEmojiSelect}
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
});

'use client';

import { useState, useRef, useCallback, useEffect, memo, type KeyboardEvent } from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@iconicedu/ui-web/ui/tooltip';
import { EmojiPicker } from '@iconicedu/ui-web/components/messages/emoji-picker';
import {
  Bold,
  Italic,
  Link2,
  AtSign,
  Smile,
  Paperclip,
  Send,
  Mic,
  ImageIcon,
  type LucideIcon,
} from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => void;
  placeholder?: string;
  sticky?: boolean;
  readOnly?: boolean;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  onFocus?: () => void;
  onInputKeyDown?: () => void;
}

const FormatButton = memo(function FormatButton({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
});

export const MessageInput = memo(function MessageInput({
  onSend,
  placeholder = 'Write a message...',
  sticky = true,
  readOnly = false,
  onTypingStart,
  onTypingStop,
  onFocus,
  onInputKeyDown,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const isTypingRef = useRef(false);

  const clearTypingTimeout = useCallback(() => {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  const notifyTypingStop = useCallback(() => {
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    onTypingStop?.();
  }, [onTypingStop]);

  const handleSend = useCallback(() => {
    if (readOnly) {
      return;
    }
    if (content.trim()) {
      onSend(content.trim());
      setContent('');
      clearTypingTimeout();
      notifyTypingStop();
      textareaRef.current?.focus();
    }
  }, [clearTypingTimeout, content, notifyTypingStop, onSend, readOnly]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) {
        return;
      }
      onInputKeyDown?.();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, onInputKeyDown, readOnly],
  );

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);

      setContent(newContent);

      window.setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    },
    [content],
  );

  const handleTyping = useCallback(
    (value: string) => {
      if (readOnly) {
        return;
      }
      if (!value.trim()) {
        clearTypingTimeout();
        notifyTypingStop();
        return;
      }
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTypingStart?.();
      }
      clearTypingTimeout();
      typingTimeoutRef.current = window.setTimeout(() => {
        notifyTypingStop();
      }, 1800);
    },
    [clearTypingTimeout, notifyTypingStop, onTypingStart, readOnly],
  );

  useEffect(() => {
    return () => {
      clearTypingTimeout();
      notifyTypingStop();
    };
  }, [clearTypingTimeout, notifyTypingStop]);

  const formatButtons = [
    { icon: Bold, label: 'Bold' },
    { icon: Italic, label: 'Italic' },
    { icon: Link2, label: 'Link' },
  ];

  return (
    <div
      className={
        sticky
          ? 'sticky bottom-0 z-10 w-full border-t border-border backdrop-blur p-4 rounded-xl'
          : 'w-full border-t border-border bg-card/95 backdrop-blur p-4'
      }
    >
      <div className="rounded-xl border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
        <Textarea
          ref={textareaRef}
          value={content}
          readOnly={readOnly}
          onChange={(e) => {
            const nextValue = e.target.value;
            setContent(nextValue);
            handleTyping(nextValue);
          }}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder={placeholder}
          className="min-h-[80px] resize-none border-0 bg-transparent px-3 py-2 text-base sm:text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
          <TooltipProvider>
            <div className="flex items-center gap-0.5">
              {formatButtons.map((btn) => (
                <FormatButton key={btn.label} icon={btn.icon} label={btn.label} />
              ))}
              <div className="mx-1 h-4 w-px bg-border" />
              <FormatButton icon={AtSign} label="Mention someone" />
              <EmojiPicker onEmojiSelect={handleEmojiSelect}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <Smile className="h-4 w-4" />
                </Button>
              </EmojiPicker>
              <FormatButton icon={ImageIcon} label="Attach image" />
              <FormatButton icon={Paperclip} label="Attach file" />
              <FormatButton icon={Mic} label="Record audio" />
            </div>
          </TooltipProvider>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={readOnly || !content.trim()}
            className="h-8 gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
});

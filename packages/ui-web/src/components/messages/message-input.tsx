'use client';

import * as React from 'react';
import type { MessageMentionVM, UserProfileVM } from '@iconicedu/shared-types';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import { EmojiPicker } from './emoji-picker';
import {
  cn,
} from '../../lib/utils';
import {
  getMentionCandidates,
  getMentionPopupPosition,
  getMentionState,
  matchesMentionQuery,
  type MentionCandidate,
  type MentionPopupPosition,
  type MentionState,
} from './message-input.utils';
import { extractMentionsFromMessageText } from './message-mentions.utils';
import {
  Bold,
  Italic,
  Link2,
  AtSign,
  Smile,
  Paperclip,
  Send,
  Loader2,
  Mic,
  ImageIcon,
  type LucideIcon,
} from 'lucide-react';

const TYPING_STOP_DELAY_MS = 3000;
const TYPING_KEEPALIVE_THROTTLE_MS = 1200;

interface MessageInputProps {
  onSend: (content: string, mentions?: MessageMentionVM[]) => void;
  placeholder?: string;
  sticky?: boolean;
  readOnly?: boolean;
  participants?: UserProfileVM[];
  currentUserId?: string | null;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  onFocus?: () => void;
  onInputKeyDown?: () => void;
  isLoading?: boolean;
}

function FormatButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label={label}
          title={label}
          onClick={onClick}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MessageInput({
  onSend,
  placeholder = 'Write a message...',
  sticky = true,
  readOnly = false,
  participants = [],
  currentUserId,
  onTypingStart,
  onTypingStop,
  onFocus,
  onInputKeyDown,
  isLoading = false,
}: MessageInputProps) {
  const [content, setContent] = React.useState('');
  const [mentionState, setMentionState] = React.useState<MentionState | null>(null);
  const [mentionPopupPosition, setMentionPopupPosition] =
    React.useState<MentionPopupPosition | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = React.useState(0);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = React.useRef<number | null>(null);
  const isTypingRef = React.useRef(false);
  const lastTypingSignalAtRef = React.useRef<number>(0);
  const mentionCandidates = React.useMemo(
    () => getMentionCandidates(participants, currentUserId),
    [participants, currentUserId],
  );
  const filteredMentionCandidates = React.useMemo(() => {
    if (!mentionState) return [];
    return mentionCandidates.filter((candidate) =>
      matchesMentionQuery(candidate, mentionState.query),
    );
  }, [mentionCandidates, mentionState]);
  const isMentionListOpen = mentionState !== null && filteredMentionCandidates.length > 0;

  const updateMentionPopupPosition = React.useCallback(
    (caretPosition: number | null) => {
      setMentionPopupPosition(
        getMentionPopupPosition(wrapperRef.current, textareaRef.current, caretPosition),
      );
    },
    [],
  );

  const clearTypingTimeout = React.useCallback(() => {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  const notifyTypingStop = React.useCallback(() => {
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    onTypingStop?.();
  }, [onTypingStop]);

  const handleTyping = React.useCallback(
    (value: string) => {
      if (readOnly) {
        return;
      }
      if (!value.trim()) {
        clearTypingTimeout();
        notifyTypingStop();
        return;
      }
      const now = Date.now();
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        lastTypingSignalAtRef.current = now;
        onTypingStart?.();
      } else if (now - lastTypingSignalAtRef.current >= TYPING_KEEPALIVE_THROTTLE_MS) {
        lastTypingSignalAtRef.current = now;
        onTypingStart?.();
      }
      clearTypingTimeout();
      typingTimeoutRef.current = window.setTimeout(() => {
        notifyTypingStop();
      }, TYPING_STOP_DELAY_MS);
    },
    [clearTypingTimeout, notifyTypingStop, onTypingStart, readOnly],
  );

  const syncMentionState = React.useCallback((value: string, caretPosition: number | null) => {
    const nextMentionState = getMentionState(value, caretPosition);
    setMentionState(nextMentionState);
    setActiveMentionIndex(0);
    setMentionPopupPosition(
      getMentionPopupPosition(wrapperRef.current, textareaRef.current, nextMentionState?.end ?? null),
    );
  }, []);

  const insertAtCursor = React.useCallback(
    (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = content.slice(0, start) + text + content.slice(end);

      setContent(nextValue);
      handleTyping(nextValue);
      window.setTimeout(() => {
        textarea.focus();
        const nextCaret = start + text.length;
        textarea.setSelectionRange(nextCaret, nextCaret);
        syncMentionState(nextValue, nextCaret);
        updateMentionPopupPosition(nextCaret);
      }, 0);
    },
    [content, handleTyping, syncMentionState, updateMentionPopupPosition],
  );

  const handleMentionSelect = React.useCallback(
    (candidate: MentionCandidate) => {
      const textarea = textareaRef.current;
      if (!textarea || !mentionState) return;

      const mentionText = `@${candidate.displayName} `;
      const nextValue =
        content.slice(0, mentionState.start) +
        mentionText +
        content.slice(mentionState.end);
      const nextCaret = mentionState.start + mentionText.length;

      setContent(nextValue);
      handleTyping(nextValue);
      setMentionState(null);
      setActiveMentionIndex(0);

      window.setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCaret, nextCaret);
        updateMentionPopupPosition(nextCaret);
      }, 0);
    },
    [content, handleTyping, mentionState, updateMentionPopupPosition],
  );

  const handleSend = React.useCallback(() => {
    if (readOnly || isLoading) {
      return;
    }
    if (content.trim()) {
      const trimmedContent = content.trim();
      const mentions = extractMentionsFromMessageText(
        trimmedContent,
        participants,
        currentUserId,
      );
      onSend(trimmedContent, mentions);
      setContent('');
      setMentionState(null);
      setMentionPopupPosition(null);
      setActiveMentionIndex(0);
      clearTypingTimeout();
      notifyTypingStop();
      textareaRef.current?.focus();
    }
  }, [
    clearTypingTimeout,
    content,
    currentUserId,
    isLoading,
    notifyTypingStop,
    onSend,
    participants,
    readOnly,
  ]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly || isLoading) {
        return;
      }
      onInputKeyDown?.();
      if (isMentionListOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveMentionIndex((index) =>
            filteredMentionCandidates.length === 0
              ? 0
              : (index + 1) % filteredMentionCandidates.length,
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveMentionIndex((index) =>
            filteredMentionCandidates.length === 0
              ? 0
              : (index - 1 + filteredMentionCandidates.length) %
                filteredMentionCandidates.length,
          );
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const candidate = filteredMentionCandidates[activeMentionIndex];
          if (candidate) {
            handleMentionSelect(candidate);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setMentionState(null);
          setActiveMentionIndex(0);
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [
      activeMentionIndex,
      filteredMentionCandidates,
      handleMentionSelect,
      handleSend,
      isLoading,
      isMentionListOpen,
      onInputKeyDown,
      readOnly,
    ],
  );

  const handleEmojiSelect = React.useCallback(
    (emoji: string) => {
      insertAtCursor(emoji);
    },
    [insertAtCursor],
  );

  React.useEffect(() => {
    return () => {
      clearTypingTimeout();
      notifyTypingStop();
    };
  }, [clearTypingTimeout, notifyTypingStop]);

  React.useEffect(() => {
    if (!isMentionListOpen) {
      setMentionPopupPosition(null);
      return;
    }

    updateMentionPopupPosition(mentionState?.end ?? textareaRef.current?.selectionStart ?? null);

    const handleViewportChange = () => {
      updateMentionPopupPosition(mentionState?.end ?? textareaRef.current?.selectionStart ?? null);
    };

    window.addEventListener('resize', handleViewportChange);
    const textarea = textareaRef.current;
    textarea?.addEventListener('scroll', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      textarea?.removeEventListener('scroll', handleViewportChange);
    };
  }, [isMentionListOpen, mentionState?.end, updateMentionPopupPosition]);

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
      <div className="mx-auto w-full max-w-[960px]">
        <div
          ref={wrapperRef}
          className="relative rounded-xl border border-input bg-background focus-within:ring-1 focus-within:ring-ring"
        >
          <Textarea
            ref={textareaRef}
            rows={1}
            value={content}
            readOnly={readOnly}
            onChange={(e) => {
              const nextValue = e.target.value;
              setContent(nextValue);
              handleTyping(nextValue);
              syncMentionState(nextValue, e.target.selectionStart);
            }}
            onClick={(e) => syncMentionState(e.currentTarget.value, e.currentTarget.selectionStart)}
            onKeyUp={(e) => syncMentionState(e.currentTarget.value, e.currentTarget.selectionStart)}
            onSelect={(e) => syncMentionState(e.currentTarget.value, e.currentTarget.selectionStart)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            placeholder={placeholder}
            className="min-h-[80px] max-h-[120px] resize-none border-0 bg-transparent px-3 py-2 text-base sm:text-sm focus-visible:ring-0 focus-visible:ring-offset-0 overflow-x-hidden placeholder:whitespace-nowrap placeholder:text-ellipsis"
          />
          {isMentionListOpen ? (
            <div
              role="listbox"
              aria-label="Mention suggestions"
              className="absolute z-20 max-h-56 w-max min-w-56 overflow-y-auto rounded-2xl border border-border bg-popover p-1 shadow-xl"
              style={{
                left: mentionPopupPosition?.left ?? 28,
                top: mentionPopupPosition?.top ?? 12,
                maxWidth: mentionPopupPosition?.maxWidth ?? undefined,
              }}
            >
              {filteredMentionCandidates.map((candidate, index) => {
                const isActive = index === activeMentionIndex;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={cn(
                      'flex min-w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                      isActive ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted',
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleMentionSelect(candidate);
                    }}
                    onMouseEnter={() => setActiveMentionIndex(index)}
                  >
                    <Avatar size="sm">
                      <AvatarImage src={candidate.avatarUrl} alt={candidate.displayName} />
                      <AvatarFallback>
                        {candidate.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{candidate.displayName}</div>
                      {candidate.email ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {candidate.email}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
            <TooltipProvider>
              <div className="flex items-center gap-0.5">
                {formatButtons.map((btn) => (
                  <FormatButton key={btn.label} icon={btn.icon} label={btn.label} />
                ))}
                <div className="mx-1 h-4 w-px bg-border" />
                <FormatButton
                  icon={AtSign}
                  label="Mention someone"
                  onClick={() => {
                    if (readOnly || isLoading) return;
                    insertAtCursor('@');
                  }}
                />
                <EmojiPicker onEmojiSelect={handleEmojiSelect}>
                  <Button
                    type="button"
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
              type="button"
              size="sm"
              onClick={handleSend}
              disabled={readOnly || isLoading || !content.trim()}
              className="h-8 gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

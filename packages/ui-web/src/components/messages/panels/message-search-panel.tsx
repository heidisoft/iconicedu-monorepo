'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Search, X } from 'lucide-react';
import type {
  MessageSearchResultVM,
  MessagesRightPanelIntent,
} from '@iconicedu/shared-types';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';
import { Button } from '@iconicedu/ui-web/ui/button';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import {
  AvatarWithStatus,
  getAvatarRoleLabel,
} from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { isTextMessage } from '@iconicedu/ui-web/lib/message-guards';
import { formatDistanceToNow } from 'date-fns';
import { useMessagesState } from '@iconicedu/ui-web/components/messages/context/messages-state-provider';
import { splitTextByMatchRanges } from '@iconicedu/ui-web/components/messages/message-search-highlight.utils';

interface MessageSearchPanelProps {
  intent: MessagesRightPanelIntent;
}

const SEARCH_DEBOUNCE_MS = 350;
const ALL_SENDERS_VALUE = '__all__';

export function MessageSearchPanel(_: MessageSearchPanelProps) {
  const { channel, scrollToMessage, close, messages } = useMessagesState();
  const participants = channel.collections.participants ?? [];
  const [query, setQuery] = useState('');
  const [senderProfileId, setSenderProfileId] = useState<string>(ALL_SENDERS_VALUE);
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');
  const [results, setResults] = useState<MessageSearchResultVM[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setSearchError(null);
      setIsSearching(false);
      return;
    }
    const requestId = ++requestSeqRef.current;
    setIsSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ channelId: channel.ids.id, query: trimmed });
      if (senderProfileId !== ALL_SENDERS_VALUE) {
        params.set('senderProfileId', senderProfileId);
      }
      if (createdAfter) {
        params.set('createdAfter', new Date(createdAfter).toISOString());
      }
      if (createdBefore) {
        params.set('createdBefore', new Date(createdBefore).toISOString());
      }
      const response = await window.fetch(`/api/messages/search?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        data?: MessageSearchResultVM[];
        message?: string;
      } | null;
      if (requestId !== requestSeqRef.current) {
        return; // A newer search superseded this one.
      }
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message ?? 'Unable to search messages');
      }
      setResults(payload.data ?? []);
    } catch (error) {
      if (requestId !== requestSeqRef.current) {
        return;
      }
      setSearchError(
        error instanceof Error ? error.message : 'Unable to search messages',
      );
      setResults(null);
    } finally {
      if (requestId === requestSeqRef.current) {
        setIsSearching(false);
      }
    }
  }, [channel.ids.id, createdAfter, createdBefore, query, senderProfileId]);

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void runSearch();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, senderProfileId, createdAfter, createdBefore]);

  const handleResultClick = useCallback(
    (messageId: string) => {
      const isLoaded = messages.some((message) => message.ids.id === messageId);
      close();
      if (isLoaded) {
        scrollToMessage?.(messageId);
      } else {
        toast.info('Scroll up to load older messages, then try again.');
      }
    },
    [close, messages, scrollToMessage],
  );

  const hasActiveQuery = query.trim().length > 0;
  const hasFilters = Boolean(
    createdAfter || createdBefore || senderProfileId !== ALL_SENDERS_VALUE,
  );

  const sortedParticipants = useMemo(
    () =>
      [...participants].sort((a, b) =>
        getProfileDisplayName(a.profile).localeCompare(getProfileDisplayName(b.profile)),
      ),
    [participants],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-border p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search messages"
            className="pl-8"
            aria-label="Search messages"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="absolute right-1.5 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
              onClick={() => setQuery('')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="message-search-sender" className="text-xs">
              Sender
            </Label>
            <Select value={senderProfileId} onValueChange={setSenderProfileId}>
              <SelectTrigger id="message-search-sender" className="h-8 text-xs">
                <SelectValue placeholder="Anyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENDERS_VALUE}>Anyone</SelectItem>
                {sortedParticipants.map((participant) => (
                  <SelectItem key={participant.ids.id} value={participant.ids.id}>
                    {getProfileDisplayName(participant.profile)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="message-search-after" className="text-xs">
                After
              </Label>
              <Input
                id="message-search-after"
                type="date"
                className="h-8 text-xs"
                value={createdAfter}
                onChange={(event) => setCreatedAfter(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="message-search-before" className="text-xs">
                Before
              </Label>
              <Input
                id="message-search-before"
                type="date"
                className="h-8 text-xs"
                value={createdBefore}
                onChange={(event) => setCreatedBefore(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-4">
          {!hasActiveQuery ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Type to search this channel&apos;s messages
              {hasFilters ? ' matching the selected filters' : ''}.
            </p>
          ) : isSearching ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : searchError ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{searchError}</p>
          ) : results && results.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No messages found.
            </p>
          ) : (
            (results ?? []).map((result) => {
              const message = result.message;
              const senderName = getProfileDisplayName(message.core.sender.profile);
              const text = isTextMessage(message) ? message.content.text : '';
              const segments = splitTextByMatchRanges(text, result.matchRanges);

              return (
                <button
                  key={message.ids.id}
                  type="button"
                  onClick={() => handleResultClick(message.ids.id)}
                  className="flex w-full gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
                >
                  <AvatarWithStatus
                    accountId={message.core.sender.ids.accountId}
                    profileId={message.core.sender.ids.id}
                    name={senderName}
                    avatar={message.core.sender.profile.avatar}
                    roleLabel={getAvatarRoleLabel(message.core.sender.kind)}
                    sizeClassName="h-9 w-9 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {senderName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.core.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {segments.map((segment, index) =>
                        segment.highlighted ? (
                          <strong key={index} className="font-semibold text-foreground">
                            {segment.text}
                          </strong>
                        ) : (
                          <span key={index}>{segment.text}</span>
                        ),
                      )}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

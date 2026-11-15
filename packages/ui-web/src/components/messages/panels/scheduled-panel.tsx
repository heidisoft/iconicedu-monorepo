'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Loader2, Pencil, Send, X } from 'lucide-react';
import type {
  MessagesRightPanelIntent,
  ScheduledMessageVM,
} from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';
import { Textarea } from '@iconicedu/ui-web/ui/textarea';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import {
  buildScheduleSendAt,
  isScheduleDraftInFuture,
  resolveBrowserTimezone,
  type ScheduleDraft,
} from '@iconicedu/ui-web/components/messages/message-schedule-send.utils';

interface ScheduledPanelProps {
  intent: MessagesRightPanelIntent;
}

function dateTimeToDraft(iso: string): ScheduleDraft {
  const date = new Date(iso);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

function formatScheduledTime(sendAt: string, timezone?: string | null): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone || resolveBrowserTimezone(),
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(sendAt));
  } catch {
    return new Date(sendAt).toLocaleString();
  }
}

async function parseJsonResponse<T>(response: Response) {
  return (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    message?: string;
  } | null;
}

function ScheduledMessageRow({
  item,
  onChanged,
  onRemoved,
}: {
  item: ScheduledMessageVM;
  onChanged: (updated: ScheduledMessageVM) => void;
  onRemoved: (id: string) => void;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'reschedule'>('view');
  const [draftContent, setDraftContent] = useState(item.content);
  const [draftSchedule, setDraftSchedule] = useState<ScheduleDraft>(() =>
    dateTimeToDraft(item.sendAt),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = item.status === 'pending';
  const isFailed = item.status === 'failed';
  const canMutate = isPending || isFailed;

  const handleSaveEdit = useCallback(async () => {
    const trimmed = draftContent.trim();
    if (!trimmed) {
      setError('Message cannot be empty.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await window.fetch(`/api/messages/scheduled/${item.ids.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      const payload = await parseJsonResponse<ScheduledMessageVM>(response);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.message ?? 'Unable to update scheduled message');
      }
      onChanged(payload.data);
      setMode('view');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update scheduled message');
    } finally {
      setIsSaving(false);
    }
  }, [draftContent, item.ids.id, onChanged]);

  const handleSaveReschedule = useCallback(async () => {
    const sendAt = buildScheduleSendAt(draftSchedule);
    if (!sendAt) {
      setError('Choose a date and time.');
      return;
    }
    if (!isScheduleDraftInFuture(draftSchedule)) {
      setError('Pick a time in the future.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await window.fetch(`/api/messages/scheduled/${item.ids.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendAt, timezone: resolveBrowserTimezone() }),
      });
      const payload = await parseJsonResponse<ScheduledMessageVM>(response);
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.message ?? 'Unable to reschedule message');
      }
      onChanged(payload.data);
      setMode('view');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reschedule message');
    } finally {
      setIsSaving(false);
    }
  }, [draftSchedule, item.ids.id, onChanged]);

  const handleSendNow = useCallback(async () => {
    setIsSendingNow(true);
    setError(null);
    try {
      const response = await window.fetch(
        `/api/messages/scheduled/${item.ids.id}/send-now`,
        { method: 'POST' },
      );
      const payload = await parseJsonResponse<ScheduledMessageVM>(response);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message ?? 'Unable to send message now');
      }
      onChanged(payload.data ?? { ...item, status: 'sent' });
      toast.success('Message sent');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send message now';
      setError(message);
      toast.error(message);
    } finally {
      setIsSendingNow(false);
    }
  }, [item, onChanged]);

  const handleCancel = useCallback(async () => {
    setIsCanceling(true);
    setError(null);
    try {
      const response = await window.fetch(`/api/messages/scheduled/${item.ids.id}`, {
        method: 'DELETE',
      });
      const payload = await parseJsonResponse<never>(response);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message ?? 'Unable to cancel scheduled message');
      }
      onRemoved(item.ids.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to cancel scheduled message';
      setError(message);
      toast.error(message);
    } finally {
      setIsCanceling(false);
    }
  }, [item.ids.id, onRemoved]);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {formatScheduledTime(item.sendAt, item.timezone)}
        </div>
        <Badge variant={isFailed ? 'destructive' : 'secondary'} className="text-[10px]">
          {item.status}
        </Badge>
      </div>

      {mode === 'edit' ? (
        <div className="space-y-2">
          <Textarea
            value={draftContent}
            onChange={(event) => setDraftContent(event.target.value)}
            rows={3}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMode('view');
                setDraftContent(item.content);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSaveEdit()}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      ) : mode === 'reschedule' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={draftSchedule.date}
                onChange={(event) =>
                  setDraftSchedule((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                value={draftSchedule.time}
                onChange={(event) =>
                  setDraftSchedule((current) => ({
                    ...current,
                    time: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMode('view');
                setDraftSchedule(dateTimeToDraft(item.sendAt));
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSaveReschedule()}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm text-foreground">{item.content}</p>
          {isFailed && item.lastError ? (
            <p className="mt-1 text-xs text-destructive">{item.lastError}</p>
          ) : null}
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={!isPending}
              onClick={() => setMode('edit')}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={!isPending}
              onClick={() => setMode('reschedule')}
            >
              <CalendarClock className="h-3 w-3" />
              Reschedule
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={!isPending || isSendingNow}
              onClick={() => void handleSendNow()}
            >
              {isSendingNow ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Send now
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
              disabled={!canMutate || isCanceling}
              onClick={() => void handleCancel()}
            >
              {isCanceling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function ScheduledPanel(_: ScheduledPanelProps) {
  const [items, setItems] = useState<ScheduledMessageVM[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadScheduled = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await window.fetch('/api/messages/scheduled');
      const payload = await parseJsonResponse<ScheduledMessageVM[]>(response);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message ?? 'Unable to load scheduled messages');
      }
      setItems(payload.data ?? []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Unable to load scheduled messages',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScheduled();
  }, [loadScheduled]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading scheduled messages...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {loadError}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <CalendarClock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            No scheduled messages
          </h3>
          <p className="text-xs text-muted-foreground">
            Messages you schedule to send later will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-2 p-4">
        {items.map((item) => (
          <ScheduledMessageRow
            key={item.ids.id}
            item={item}
            onChanged={(updated) =>
              setItems((current) =>
                (current ?? []).map((entry) =>
                  entry.ids.id === updated.ids.id ? updated : entry,
                ),
              )
            }
            onRemoved={(id) =>
              setItems((current) =>
                (current ?? []).filter((entry) => entry.ids.id !== id),
              )
            }
          />
        ))}
      </div>
    </ScrollArea>
  );
}

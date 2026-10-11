'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';
import { MeetingControlButton } from './zoom-meeting-controls';
import { ZoomMeetingDialog } from './zoom-meeting-dialog';

function getShareableMeetingUrl() {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function ZoomShareMeetingDialog({
  meetingTitle,
  meetingPasscode,
}: {
  meetingTitle: string;
  meetingPasscode?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [copiedTarget, setCopiedTarget] = useState<
    'link' | 'passcode' | 'invitation' | null
  >(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    setMeetingUrl(getShareableMeetingUrl());
    return () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    };
  }, []);

  const copyText = async (text: string, target: 'link' | 'passcode' | 'invitation') => {
    if (!text) return;
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    setCopiedTarget(null);
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      copyResetTimer.current = setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      setCopyError(true);
    }
  };

  const copyMeetingDetails = () => {
    if (!meetingUrl) return;
    const invitation = [
      meetingTitle,
      `Join link: ${meetingUrl}`,
      meetingPasscode ? `Passcode: ${meetingPasscode}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    return copyText(invitation, 'invitation');
  };

  return (
    <ZoomMeetingDialog
      open={open}
      onOpenChange={setOpen}
      title="Share meeting link"
      description="Copy the join link and passcode to share with participants."
      trigger={
        <MeetingControlButton
          label="Share meeting link"
          className="zoom-toolbar-share-link"
          tone={open ? 'active' : 'neutral'}
        >
          <Share className="size-4" />
        </MeetingControlButton>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="zoom-meeting-join-link">Join link</Label>
          <div className="flex items-center gap-2 rounded-2xl bg-muted p-1.5">
            <Input
              id="zoom-meeting-join-link"
              value={meetingUrl}
              type="text"
              readOnly
              aria-label="Meeting join link"
              className="h-11 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
              onFocus={(event) => event.currentTarget.select()}
            />
            <IconActionButton
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
              label="Copy join link"
              disabled={!meetingUrl}
              onClick={() => void copyText(meetingUrl, 'link')}
            >
              {copiedTarget === 'link' ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </IconActionButton>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="zoom-meeting-passcode">Passcode</Label>
          <div className="flex items-center gap-2 rounded-2xl bg-muted p-1.5">
            <Input
              id="zoom-meeting-passcode"
              value={meetingPasscode || 'Not available'}
              type="text"
              readOnly
              aria-label="Meeting passcode"
              className="h-11 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
              onFocus={(event) => event.currentTarget.select()}
            />
            <IconActionButton
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
              label="Copy passcode"
              disabled={!meetingPasscode}
              onClick={() => void copyText(meetingPasscode ?? '', 'passcode')}
            >
              {copiedTarget === 'passcode' ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </IconActionButton>
          </div>
        </div>

        <Button
          type="button"
          className="w-full rounded-full"
          onClick={() => void copyMeetingDetails()}
        >
          {copiedTarget === 'invitation' ? (
            <Check className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}
          {copiedTarget === 'invitation' ? 'Invitation copied' : 'Copy invitation'}
        </Button>
        {copyError ? (
          <p role="alert" className="px-2 text-xs text-destructive">
            The details couldn&apos;t be copied. Select the details above and copy them
            manually.
          </p>
        ) : null}
      </div>
    </ZoomMeetingDialog>
  );
}

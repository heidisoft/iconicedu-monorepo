'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
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
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    setMeetingUrl(getShareableMeetingUrl());
  }, []);

  const copyMeetingDetails = async () => {
    if (!meetingUrl) return;
    const invitation = [
      meetingTitle,
      `Join link: ${meetingUrl}`,
      meetingPasscode ? `Passcode: ${meetingPasscode}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(invitation);
      setCopyError(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
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
          tone={open ? 'active' : 'neutral'}
        >
          <Share2 className="size-4" />
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-full"
              aria-label="Copy meeting details"
              disabled={!meetingUrl}
              onClick={() => void copyMeetingDetails()}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="zoom-meeting-passcode">Passcode</Label>
          <Input
            id="zoom-meeting-passcode"
            value={meetingPasscode ?? 'Not available'}
            type="text"
            readOnly
            aria-label="Meeting passcode"
            className="h-11 rounded-xl bg-muted"
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>

        <Button
          type="button"
          className="w-full rounded-full"
          onClick={() => void copyMeetingDetails()}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Invitation copied' : 'Copy invitation'}
        </Button>
        {copyError ? (
          <p role="alert" className="px-2 text-xs text-destructive">
            The invitation couldn&apos;t be copied. Select the details above and copy them
            manually.
          </p>
        ) : null}
      </div>
    </ZoomMeetingDialog>
  );
}

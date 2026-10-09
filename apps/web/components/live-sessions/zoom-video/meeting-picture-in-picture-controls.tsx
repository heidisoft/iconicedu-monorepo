'use client';

import { createPortal } from 'react-dom';
import { useState, type ReactNode } from 'react';
import { PortalContainerProvider } from '@iconicedu/ui-web/ui/portal-container';
import { TooltipProvider } from '@iconicedu/ui-web/ui/tooltip';
import { ArrowUpRight, PictureInPicture2, Settings2, X } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { ZoomMeetingDialog } from './zoom-meeting-dialog';
import type {
  AutomaticPipMode,
  useMeetingPictureInPicture,
} from './use-meeting-picture-in-picture';

export function MeetingPipProviders({
  container,
  children,
}: {
  container?: HTMLElement;
  children: ReactNode;
}) {
  return (
    <PortalContainerProvider container={container}>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
    </PortalContainerProvider>
  );
}

export function MeetingPictureInPictureControls({
  pip,
  settingsOpen,
  onSettingsOpenChange,
  onCallSettings,
}: {
  pip: ReturnType<typeof useMeetingPictureInPicture>;
  onCallSettings?: () => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
}) {
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  return (
    <>
      {pip.pipWindow && (
        <div className="meeting-pip-bar flex h-11 items-center justify-between gap-2 border-b border-border bg-background px-3 text-foreground">
          <span className="text-xs font-medium">Live class</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={
                onCallSettings ? 'Call settings' : 'Picture-in-picture settings'
              }
              onClick={() =>
                onCallSettings ? onCallSettings() : onSettingsOpenChange(true)
              }
            >
              <Settings2 className="size-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={pip.restore}>
              <ArrowUpRight className="size-4" />
              Back to call
            </Button>
          </div>
        </div>
      )}
      {pip.pipWindow &&
        createPortal(
          <div
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center text-foreground"
            data-testid="meeting-pip-placeholder"
          >
            <PictureInPicture2 className="size-8 text-muted-foreground" />
            <h2 className="text-lg font-medium">Your call is in picture-in-picture</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Video, audio and shared content are still live in the floating window.
            </p>
            <Button onClick={pip.restore}>Bring call back here</Button>
          </div>,
          document.body,
        )}
      {!pip.pipWindow &&
        (pip.error ||
          ((pip.sharePrompt || pip.automaticBlocked) && !dismissedPrompt)) && (
          <div
            role={pip.error ? 'alert' : 'status'}
            className="fixed right-4 top-20 z-50 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm shadow-sm"
          >
            <span>
              {pip.error ??
                (pip.automaticBlocked
                  ? 'Allow Automatic picture-in-picture in your browser’s site settings to keep the call visible when switching tabs.'
                  : 'Keep your call visible while presenting.')}
            </span>
            {!pip.error && (
              <Button size="sm" onClick={() => void pip.open()}>
                Open floating call
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss picture-in-picture message"
              onClick={() => {
                pip.clearError();
                pip.dismissReturn();
                setDismissedPrompt(true);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      <ZoomMeetingDialog
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
        title="Picture-in-picture"
        description="Keep your call visible while using other tabs or presenting."
      >
        <MeetingPipSettings pip={pip} />
      </ZoomMeetingDialog>
      <style>{`
      [data-meeting-pip] .zoom-meeting-shell { top: 44px; }
      [data-meeting-pip] .zoom-meeting-header { top: .5rem; }
      [data-meeting-pip] .zoom-participant-gallery { top: 3.25rem; bottom: 5rem; }
      [data-meeting-pip] .zoom-meeting-shell { --zoom-meeting-gutter: .5rem; }
      [data-meeting-pip] .zoom-toolbar { justify-content: flex-start; }
      [data-meeting-pip] .zoom-meeting-gutter-padding { overflow-x: auto; }
    `}</style>
    </>
  );
}

export function MeetingPipSettings({
  pip,
}: {
  pip: ReturnType<typeof useMeetingPictureInPicture>;
}) {
  return (
    <>
      <label className="flex flex-col gap-2 text-sm" htmlFor="automatic-meeting-pip">
        Open automatically
        <select
          id="automatic-meeting-pip"
          className="h-10 rounded-md border border-input bg-background px-3"
          value={pip.mode}
          disabled={!pip.supported}
          onChange={(event) =>
            pip.setAutomaticMode(event.target.value as AutomaticPipMode)
          }
        >
          <option value="always">When switching tabs or sharing</option>
          <option value="tabs">When switching tabs</option>
          <option value="sharing">When sharing</option>
          <option value="never">Never</option>
        </select>
      </label>
      <p className="text-sm text-muted-foreground">
        {pip.supported
          ? 'Allow Automatic picture-in-picture in your browser’s site settings. If your browser asks for a click when sharing, use Open floating call.'
          : 'Use a supported desktop browser such as Chrome or Edge for a floating call window.'}
      </p>
    </>
  );
}

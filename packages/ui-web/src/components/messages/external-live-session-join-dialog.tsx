'use client';

import { useEffect, useState, useRef } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';

import { Alert, AlertDescription } from '@iconicedu/ui-web/ui/alert';
import { IconActionButton } from '@iconicedu/ui-web/ui/icon-action-button';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@iconicedu/ui-web/ui/dialog';

export type ExternalLiveSessionJoinTarget = {
  joinHref: string;
  providerLabel: string | null;
  isInternal?: boolean;
  copyHref?: string;
  passcode?: string | null;
  passcodeError?: boolean;
  linkLoading?: boolean;
};

export async function copyExternalLiveSessionJoinLink(
  joinHref: string,
  clipboard: Pick<Clipboard, 'writeText'> | null | undefined = navigator?.clipboard,
) {
  if (!clipboard?.writeText) {
    return false;
  }

  try {
    await clipboard.writeText(joinHref);
    return true;
  } catch {
    return false;
  }
}

// flag-exempt: restores access to passcodes removed from meeting URLs for secure sharing.
export function ExternalLiveSessionJoinDialog({
  target,
  onOpenChange,
}: {
  target: ExternalLiveSessionJoinTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [passcodeCopied, setPasscodeCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    setCopied(false);
    setPasscodeCopied(false);
    setCopyError(false);
  }, [target?.joinHref, target?.copyHref, target?.passcode]);

  const handleCopy = async () => {
    if (!target?.joinHref) {
      return;
    }

    const success = await copyExternalLiveSessionJoinLink(
      target.copyHref ?? target.joinHref,
    );
    setCopied(success);
    setCopyError(!success);
  };

  const primaryLabel = target?.providerLabel
    ? `Open ${target.providerLabel}`
    : 'Open session';

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        className="min-w-0 gap-4 sm:max-w-md [&>*]:min-w-0"
      >
        <DialogHeader className="pr-6">
          <DialogTitle>Session ready to join</DialogTitle>
          <DialogDescription>
            {target?.isInternal
              ? 'Open the session when you are ready.'
              : 'This session opens in an external provider.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-medium">Join link</p>
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-1.5">
              <p className="min-w-0 flex-1 break-all whitespace-normal text-sm select-all">
                {target?.copyHref ?? target?.joinHref}
              </p>
              <IconActionButton
                label={copied ? 'Copied' : 'Copy link'}
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                disabled={target?.linkLoading}
                onClick={() => void handleCopy()}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </IconActionButton>
            </div>
          </div>
          {target?.passcode ? (
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm font-medium">Session passcode</p>
              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-1.5">
                <p className="min-w-0 flex-1 break-all font-mono text-sm select-all">
                  {target.passcode}
                </p>
                <IconActionButton
                  label={passcodeCopied ? 'Passcode copied' : 'Copy passcode'}
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={async () => {
                    const success = await copyExternalLiveSessionJoinLink(
                      target.passcode!,
                    );
                    setPasscodeCopied(success);
                    setCopyError(!success);
                  }}
                >
                  {passcodeCopied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </IconActionButton>
              </div>
            </div>
          ) : null}
        </div>
        {target?.passcodeError || copyError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {target?.passcodeError
                ? 'Could not load the invitation. Close this dialog and try again.'
                : 'Could not copy. Select the text above and copy it manually.'}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          {target ? (
            <Button asChild className="w-full">
              <a href={target.joinHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                {primaryLabel}
              </a>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

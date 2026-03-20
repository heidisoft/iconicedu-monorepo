'use client';

import { useEffect, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';

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

export function ExternalLiveSessionJoinDialog({
  target,
  onOpenChange,
}: {
  target: ExternalLiveSessionJoinTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [target?.joinHref]);

  const handleCopy = async () => {
    if (!target?.joinHref) {
      return;
    }

    setCopied(await copyExternalLiveSessionJoinLink(target.joinHref));
  };

  const primaryLabel = target?.providerLabel
    ? `Open ${target.providerLabel}`
    : 'Open session';

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg space-y-4">
        <DialogHeader>
          <DialogTitle>Session ready to join</DialogTitle>
          <DialogDescription>
            This session opens in an external provider. Stay here until you are ready,
            then use the link below to join.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-3xl border border-border bg-muted/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Join link
          </p>
          <p className="mt-2 break-all text-sm text-foreground">{target?.joinHref}</p>
        </div>

        <DialogFooter showCloseButton>
          <Button type="button" variant="outline" onClick={() => void handleCopy()}>
            <Copy className="size-4" />
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          {target ? (
            <Button asChild>
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

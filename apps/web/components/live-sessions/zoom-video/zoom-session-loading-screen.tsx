'use client';

import { Loader2 } from 'lucide-react';

export function ZoomSessionLoadingScreen({
  label = 'Loading session…',
}: {
  label?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-background text-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}
